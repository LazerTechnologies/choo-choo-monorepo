import { NextResponse } from "next/server";
import { isAddress } from "viem";
import {
	checkNeynarScore,
	MIN_NEYNAR_SCORE,
} from "@/lib/services/neynar-score";

interface NeynarConversationResponse {
	conversation: {
		cast: {
			direct_replies: Array<{
				author: {
					fid: number;
					username: string;
					display_name: string;
					pfp_url: string;
					custody_address: string;
					verifications: string[];
					verified_addresses: {
						eth_addresses?: string[];
					};
				};
			}>;
		};
	};
	next?: {
		cursor: string;
	};
}

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

interface SelectWinnerRequest {
	castHash: string;
}

interface SelectWinnerResponse {
	success: boolean;
	winner: {
		address: string;
		username: string;
		fid: number;
		displayName: string;
		pfpUrl: string;
	};
	totalEligibleReactors: number;
	error?: string;
}

/**
 * Fetches replies to a given cast from Neynar, along with each reply author's primary wallet address.
 * Uses the conversation API which includes full user data in a single call.
 */
async function fetchReplies(castHash: string): Promise<
	Array<{
		primaryWallet: string;
		fid: number;
		username: string;
		displayName: string;
		pfpUrl: string;
	}>
> {
	if (!NEYNAR_API_KEY) throw new Error("Missing NEYNAR_API_KEY");

	// Validate cast hash
	console.log(`[internal/select-winner] Processing cast hash: ${castHash}`);
	if (!castHash || typeof castHash !== "string") {
		throw new Error(`Invalid cast hash: ${castHash}`);
	}

	// Fetch all replies to the cast with pagination
	let allReplies: Array<{
		author: {
			fid: number;
			username: string;
			display_name: string;
			pfp_url: string;
			custody_address: string;
			verifications: string[];
			verified_addresses: {
				eth_addresses?: string[];
			};
		};
	}> = [];
	let cursor: string | undefined;

	do {
		const url = new URL(
			`https://api.neynar.com/v2/farcaster/cast/conversation/`,
		);
		url.searchParams.set("identifier", castHash);
		url.searchParams.set("type", "hash");
		url.searchParams.set("reply_depth", "1");
		url.searchParams.set("limit", "50");
		url.searchParams.set("include_chronological_parent_casts", "false");
		url.searchParams.set("fold", "above"); // fold replies above threshold
		if (cursor) url.searchParams.set("cursor", cursor);

		console.log(
			`[internal/select-winner] Making Neynar API request to: ${url.toString()}`,
		);

		const conversationRes = await fetch(url.toString(), {
			headers: { accept: "application/json", "x-api-key": NEYNAR_API_KEY },
		});

		if (!conversationRes.ok) {
			let errorDetails = "";
			try {
				const errorBody = await conversationRes.text();
				errorDetails = errorBody;
				console.error(
					`[internal/select-winner] Neynar API error response: ${errorBody}`,
				);
			} catch {
				console.error(
					`[internal/select-winner] Could not read error response body`,
				);
			}

			throw new Error(
				`Failed to fetch conversation from Neynar: ${conversationRes.status} ${conversationRes.statusText}. Response: ${errorDetails}`,
			);
		}

		const conversationData: NeynarConversationResponse =
			await conversationRes.json();
		const replies = conversationData?.conversation?.cast?.direct_replies ?? [];
		console.log(
			`[internal/select-winner] Fetched ${replies.length} replies in this batch`,
		);
		allReplies = allReplies.concat(replies);
		cursor = conversationData?.next?.cursor || undefined;
		console.log(
			`[internal/select-winner] Next cursor: ${cursor ? "exists" : "none"}`,
		);
	} while (cursor);

	console.log(
		`[internal/select-winner] Total raw replies fetched: ${allReplies.length}`,
	);

	// Collect unique users who replied (deduplicate by FID)
	const uniqueUsers: Map<
		number,
		{
			fid: number;
			username: string;
			displayName: string;
			pfpUrl: string;
			primaryWallet: string;
		}
	> = new Map();

	for (const reply of allReplies) {
		const user = reply.author;
		const fid = user?.fid;
		if (!fid) continue;

		if (uniqueUsers.has(fid)) continue;

		// Try to get a valid Ethereum address from various sources
		let primaryWallet: string | undefined;

		// First try verified_addresses.eth_addresses (most reliable)
		if (user.verified_addresses?.eth_addresses?.length) {
			primaryWallet = user.verified_addresses.eth_addresses[0];
		}
		// Fallback to verifications array (legacy format)
		else if (user.verifications?.length > 0) {
			// Find first valid Ethereum address in verifications
			primaryWallet = user.verifications.find(
				(addr) => typeof addr === "string" && isAddress(addr),
			);
		}
		// Last resort: custody address
		else if (user.custody_address && isAddress(user.custody_address)) {
			primaryWallet = user.custody_address;
		}

		if (!primaryWallet || !isAddress(primaryWallet)) {
			console.log(
				`[internal/select-winner] Skipping user ${user.username} (${user.fid}) - no valid wallet address`,
			);
			continue;
		}

		uniqueUsers.set(fid, {
			fid,
			username: user.username || "",
			displayName: user.display_name || "",
			pfpUrl: user.pfp_url || "",
			primaryWallet,
		});
	}

	const finalRepliers = Array.from(uniqueUsers.values());
	console.log(
		`[internal/select-winner] Final eligible repliers: ${finalRepliers.length}`,
	);
	console.log(
		`[internal/select-winner] Filtered out ${allReplies.length - finalRepliers.length} replies (duplicates/no-wallet)`,
	);

	if (finalRepliers.length > 0) {
		console.log(
			`[internal/select-winner] Sample repliers:`,
			finalRepliers.slice(0, 3).map((r) => `${r.username} (${r.fid})`),
		);
	}

	return finalRepliers;
}

/**
 * POST /api/internal/select-winner
 * Internal endpoint for selecting a winner from Farcaster cast replies
 */
export async function POST(request: Request) {
	try {
		const authHeader = request.headers.get("x-internal-secret");
		if (!INTERNAL_SECRET || authHeader !== INTERNAL_SECRET) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Parse request body
		let body: SelectWinnerRequest;
		try {
			body = await request.json();
		} catch (err) {
			console.error(
				"[internal/select-winner] Error parsing request body:",
				err,
			);
			return NextResponse.json(
				{ success: false, error: "Invalid JSON body" },
				{ status: 400 },
			);
		}

		const { castHash } = body;
		if (!castHash || typeof castHash !== "string") {
			return NextResponse.json(
				{ success: false, error: "Missing or invalid castHash" },
				{ status: 400 },
			);
		}

		console.log(
			`[internal/select-winner] Selecting winner for cast: ${castHash}`,
		);

		// Fetch replies and select winner
		const repliers = await fetchReplies(castHash);

		if (repliers.length === 0) {
			return NextResponse.json(
				{ success: false, error: "No eligible repliers found" },
				{ status: 400 },
			);
		}

		// Filter repliers by Neynar score
		let winner = null;
		let skippedForScore = 0;
		const candidates = [...repliers]; // Create a copy to avoid mutating original array

		while (candidates.length > 0) {
			const candidateIndex = Math.floor(Math.random() * candidates.length);
			const [candidate] = candidates.splice(candidateIndex, 1);

			try {
				// Check Neynar score
				const scoreCheck = await checkNeynarScore(candidate.fid);
				if (scoreCheck.meetsMinimum) {
					winner = candidate;
					break;
				}

				skippedForScore += 1;
				console.log(
					`[select-winner] Skipping ${candidate.username} (FID: ${candidate.fid}) - Neynar score too low (${scoreCheck.score}, minimum: ${MIN_NEYNAR_SCORE})`,
				);
			} catch (error) {
				skippedForScore += 1;
				console.warn(
					`[select-winner] Failed to verify Neynar score for ${candidate.username}:`,
					error,
				);
			}
		}

		if (!winner) {
			console.warn(
				`[select-winner] No repliers met the minimum Neynar score requirement. Skipped ${skippedForScore} candidates.`,
			);
			return NextResponse.json(
				{
					success: false,
					error:
						"No eligible repliers meet the minimum Neynar score requirement",
				},
				{ status: 400 },
			);
		}

		const response: SelectWinnerResponse = {
			success: true,
			winner: {
				address: winner.primaryWallet,
				username: winner.username,
				fid: winner.fid,
				displayName: winner.displayName,
				pfpUrl: winner.pfpUrl,
			},
			totalEligibleReactors: repliers.length,
		};

		console.log(
			`[internal/select-winner] Selected winner: ${winner.username} (${winner.primaryWallet})`,
		);
		return NextResponse.json(response);
	} catch (error) {
		console.error("[internal/select-winner] Error:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to select winner",
			},
			{ status: 500 },
		);
	}
}
