import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { z } from "zod";
import { APP_URL } from "@/lib/constants";
import { redis } from "@/lib/kv";
import { withAppPauseProtection } from "@/lib/middleware/app-maintenance";
import type { ApiHandler } from "@/lib/middleware/internal-auth";
import { getContractService } from "@/lib/services/contract";
import { orchestrateManualSend } from "@/lib/train-orchestrator";
import type { NeynarBulkUsersResponse } from "@/types/neynar";

// axios no longer needed after orchestrator refactor

// INTERNAL_SECRET no longer used here after orchestrator refactor
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

// Validation schema
const userSendTrainBodySchema = z.object({
	targetFid: z.number().positive("Target FID must be positive"),
});

interface UserSendTrainRequest {
	targetFid: number;
}

// Response shape is returned directly from orchestrator outcome

/**
 * Fetches user data from Neynar by FID
 *
 * @param fid - The FID of the user to fetch data for.
 * @returns The user data if found, otherwise null.
 */
async function fetchUserByFid(fid: number): Promise<{
	address: string;
	username: string;
	fid: number;
	displayName: string;
	pfpUrl: string;
} | null> {
	if (!NEYNAR_API_KEY) {
		throw new Error("Neynar API key is not configured");
	}

	try {
		const response = await fetch(
			`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
			{
				headers: {
					accept: "application/json",
					"x-api-key": NEYNAR_API_KEY,
				},
			},
		);

		if (!response.ok) {
			if (response.status === 404) {
				return null;
			}
			throw new Error(`Neynar API error: ${response.statusText}`);
		}

		const data: NeynarBulkUsersResponse = await response.json();
		const users = data?.users || [];

		if (users.length === 0) {
			return null;
		}

		const user = users[0];
		const verifiedAddresses = user.verified_addresses;

		if (!verifiedAddresses) {
			throw new Error("User has no verified Ethereum addresses");
		}

		// Use primary ETH address if available, otherwise first ETH address
		const address =
			verifiedAddresses.primary?.eth_address ||
			verifiedAddresses.eth_addresses?.[0];

		// Validate Ethereum address exists and is valid
		if (!address || !isAddress(address)) {
			throw new Error("User has no verified Ethereum addresses");
		}

		return {
			address,
			username: user.username,
			fid: user.fid,
			displayName: user.display_name,
			pfpUrl: user.pfp_url,
		};
	} catch (error) {
		console.error("[user-send-train] Failed to fetch user data:", error);
		throw error;
	}
}

/**
 * POST /api/user-send-train
 *
 * User version of send-train that works with just a FID instead of requiring a cast hash.
 * Orchestrates the next stop for the ChooChoo train journey for current holders.
 * Only accessible by current holders who have already sent a cast.
 *
 * @param request - The HTTP request object with body containing { targetFid: number }.
 * @returns 200 with { success: true, winner, tokenId, txHash, tokenURI } on success, or 400/500 with error message.
 */
const handlePost: ApiHandler = async (request) => {
	try {
		// 0. Parse request body early for deduplication
		let body: UserSendTrainRequest;
		try {
			const rawBody = await request.json();
			const parsed = userSendTrainBodySchema.safeParse(rawBody);

			if (!parsed.success) {
				return NextResponse.json(
					{
						success: false,
						error: "Invalid request body",
						details: parsed.error.flatten(),
					},
					{ status: 400 },
				);
			}

			body = parsed.data as UserSendTrainRequest;
		} catch (err) {
			console.error("[user-send-train] Error parsing request body:", err);
			return NextResponse.json(
				{ success: false, error: "Invalid JSON body" },
				{ status: 400 },
			);
		}

		const { targetFid } = body;

		// 1. Get current holder info to verify authentication
		const currentHolderResponse = await fetch(`${APP_URL}/api/current-holder`);

		if (!currentHolderResponse.ok) {
			return NextResponse.json(
				{ error: "Failed to verify current holder status" },
				{ status: 500 },
			);
		}

		const currentHolderData = await currentHolderResponse.json();
		if (!currentHolderData.hasCurrentHolder) {
			return NextResponse.json(
				{ error: "No current holder found" },
				{ status: 403 },
			);
		}

		// Note: Authentication is handled via the current holder check since this endpoint
		// should only be accessible to the current holder in the UI

		// 2. Check workflow state - user must be in CASTED state (not chance mode)
		const workflowStateJson = await redis.get("workflowState");
		if (!workflowStateJson) {
			return NextResponse.json(
				{ error: "No workflow state found. Please send a cast first." },
				{ status: 400 },
			);
		}

		const workflowData = JSON.parse(workflowStateJson);
		if (
			workflowData.state !== "CASTED" &&
			workflowData.state !== "MANUAL_SEND"
		) {
			if (
				workflowData.state === "CHANCE_ACTIVE" ||
				workflowData.state === "CHANCE_EXPIRED"
			) {
				return NextResponse.json(
					{ error: "Manual sending is disabled in chance mode" },
					{ status: 400 },
				);
			}
			return NextResponse.json(
				{
					error:
						"You must send a cast first before manually selecting the next passenger",
				},
				{ status: 400 },
			);
		}

		// 3. Check USDC deposit requirement for current holder
		const currentUserFid = currentHolderData.currentHolder.fid;
		try {
			const contractService = getContractService();
			const hasDeposited =
				await contractService.hasDepositedEnough(currentUserFid);

			if (!hasDeposited) {
				const [deposited, required] = await Promise.all([
					contractService.getFidDeposited(currentUserFid),
					contractService.getDepositCost(),
				]);

				return NextResponse.json(
					{
						error:
							"Insufficient USDC deposit. You must deposit at least 1 USDC to manually send the train.",
						depositStatus: {
							required: required.toString(),
							deposited: deposited.toString(),
							satisfied: false,
						},
					},
					{ status: 402 }, // Payment Required
				);
			}
		} catch (err) {
			console.error("[user-send-train] Failed to check deposit status:", err);
			return NextResponse.json(
				{ error: "Failed to verify deposit status" },
				{ status: 500 },
			);
		}

		console.log(
			`[user-send-train] 🚂 Manual selection request for target FID: ${targetFid}`,
		);

		// Get current holder data for orchestrator
		const currentHolder = {
			username: currentHolderData.currentHolder.username,
			fid: currentHolderData.currentHolder.fid,
			displayName: currentHolderData.currentHolder.displayName,
			pfpUrl: currentHolderData.currentHolder.pfpUrl,
		};

		// Call new single-writer orchestrator (it will fetch target user internally)
		const outcome = await orchestrateManualSend(currentHolder.fid, targetFid);
		if (outcome.status === 409) {
			return NextResponse.json(
				{ error: "Manual send already in progress" },
				{ status: 409 },
			);
		}
		if (outcome.status !== 200) {
			return NextResponse.json(
				{ error: outcome.body.error || "Manual send failed" },
				{ status: 500 },
			);
		}

		// Fetch winner data for response (orchestrator already validated it exists)
		let fetchedWinner: Awaited<ReturnType<typeof fetchUserByFid>> = null;
		try {
			fetchedWinner = await fetchUserByFid(targetFid);
		} catch {
			// Ignore fetch failure and fall back to minimal winner details below
		}

		const winnerData = fetchedWinner ?? {
			username: "unknown",
			fid: targetFid,
			displayName: "Unknown",
			pfpUrl: "",
			address: "",
		};

		return NextResponse.json({
			success: true,
			winner: winnerData,
			tokenId: outcome.body.tokenId,
			txHash: outcome.body.txHash,
			tokenURI: outcome.body.tokenURI,
		});
	} catch (error) {
		console.error("[user-send-train] User orchestration failed:", error);
		return NextResponse.json(
			{ error: "Failed to process user train movement" },
			{ status: 500 },
		);
	}
};
export const POST = withAppPauseProtection(handlePost);
