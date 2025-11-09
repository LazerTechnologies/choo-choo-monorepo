import { NextResponse } from "next/server";
import { redis } from "@/lib/kv";
import { withAppPauseProtection } from "@/lib/middleware/app-maintenance";
import type { ApiHandler } from "@/lib/middleware/internal-auth";
import { orchestrateRandomSend } from "@/lib/train-orchestrator";

/**
 * POST /api/send-train
 *
 * Public random winner selection endpoint. Anyone can call this when chance mode is active.
 * Uses orchestrateRandomSend for centralized state management.
 *
 * @param request - The HTTP request object (no body required).
 * @returns 200 with { success: true, winner, tokenId, txHash, tokenURI, totalEligibleReactors } on success, or 400/500 with error message.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handlePost: ApiHandler = async (_request) => {
	try {
		console.log("[send-train] 🫡 Public random winner selection request");

		// 1. Get current workflow state and validate timer
		// biome-ignore lint/suspicious/noImplicitAnyLet: neynar returns a valid hash, okay here
		let castHash, workflowData;
		try {
			const workflowStateJson = await redis.get("workflowState");
			if (!workflowStateJson) {
				console.error("[send-train] No workflow state found in Redis");
				return NextResponse.json(
					{ error: "No active workflow state found." },
					{ status: 400 },
				);
			}

			workflowData = JSON.parse(workflowStateJson);
			castHash = workflowData.currentCastHash;

			if (!castHash) {
				console.error(
					"[send-train] No current cast hash found in workflow state",
				);
				return NextResponse.json(
					{
						error:
							"No active cast found. The current holder must publish a cast first.",
					},
					{ status: 400 },
				);
			}

			// 2. Validate timer has expired
			if (
				workflowData.state === "CHANCE_ACTIVE" &&
				workflowData.winnerSelectionStart
			) {
				const now = Date.now();
				const targetTime = new Date(
					workflowData.winnerSelectionStart,
				).getTime();

				if (now < targetTime) {
					const remainingMs = targetTime - now;
					const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
					console.log(
						`[send-train] Timer has not expired yet. ${remainingMinutes} minutes remaining.`,
					);
					return NextResponse.json(
						{
							error: `Timer has not expired yet. Please wait ${remainingMinutes} more minutes.`,
						},
						{ status: 400 },
					);
				}

				// Timer has expired, transition to CHANCE_EXPIRED
				console.log(
					"[send-train] Timer expired, transitioning to CHANCE_EXPIRED",
				);
				workflowData.state = "CHANCE_EXPIRED";
				await redis.set("workflowState", JSON.stringify(workflowData));
			}

			// 3. Validate we're in the correct state for random selection
			if (workflowData.state !== "CHANCE_EXPIRED") {
				console.error(
					`[send-train] Invalid state for random selection: ${workflowData.state}`,
				);
				return NextResponse.json(
					{ error: "Random selection is not currently available." },
					{ status: 400 },
				);
			}
		} catch (err) {
			console.error("[send-train] Failed to validate workflow state:", err);
			return NextResponse.json(
				{ error: "Failed to validate current state" },
				{ status: 500 },
			);
		}

		console.log(`[send-train] Starting orchestration for cast: ${castHash}`);

		// 2. Call centralized random send orchestrator
		const outcome = await orchestrateRandomSend(castHash);
		if (outcome.status === 409) {
			return NextResponse.json(
				{ error: "Random send already in progress" },
				{ status: 409 },
			);
		}
		if (outcome.status !== 200) {
			return NextResponse.json(
				{ error: outcome.body.error || "Random send failed" },
				{ status: 500 },
			);
		}

		return NextResponse.json(outcome.body);
	} catch (error) {
		console.error("[send-train] Orchestration failed:", error);
		return NextResponse.json(
			{ error: "Failed to process train movement" },
			{ status: 500 },
		);
	}
};

export const POST = withAppPauseProtection(handlePost);
