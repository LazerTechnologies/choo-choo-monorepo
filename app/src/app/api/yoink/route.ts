import { NextResponse } from "next/server";
import { withAppPauseProtection } from "@/lib/middleware/app-maintenance";
import type { ApiHandler } from "@/lib/middleware/internal-auth";
import { orchestrateYoink } from "@/lib/train-orchestrator";

/**
 * POST /api/yoink
 *
 * Yoink endpoint using centralized orchestrator. Allows users to yoink the train if they have not ridden the train before and the cooldown has passed.
 * Uses orchestrateYoink for centralized state management and single-writer semantics.
 *
 * @param request - The HTTP request object with body containing { targetAddress, userFid }
 * @returns 200 with { success: true, txHash, tokenId, tokenURI, yoinkedBy } on success, or 400/500 with error message.
 */
const handlePost: ApiHandler = async (request) => {
	try {
		console.log("[yoink] 🫡 Yoink request received");

		// 1. Parse request body
		let targetAddress: string;
		let userFid: number;
		try {
			const body = await request.json();
			targetAddress = body.targetAddress;
			userFid = body.userFid;

			if (!targetAddress) {
				return NextResponse.json(
					{ error: "targetAddress is required in request body" },
					{ status: 400 },
				);
			}

			if (!userFid) {
				return NextResponse.json(
					{ error: "userFid is required in request body" },
					{ status: 400 },
				);
			}

			if (!/^0x[a-fA-F0-9]{40}$/i.test(targetAddress)) {
				return NextResponse.json(
					{ error: "Invalid address format" },
					{ status: 400 },
				);
			}
		} catch (err) {
			console.error("[yoink] Failed to parse request body:", err);
			return NextResponse.json(
				{ error: "Invalid request body" },
				{ status: 400 },
			);
		}

		// 2. Call centralized yoink orchestrator
		const outcome = await orchestrateYoink(userFid, targetAddress);
		if (outcome.status === 409) {
			return NextResponse.json(
				{ error: "Yoink already in progress" },
				{ status: 409 },
			);
		}
		if (outcome.status !== 200) {
			return NextResponse.json(
				{ error: outcome.body.error || "Yoink failed" },
				{ status: 500 },
			);
		}

		return NextResponse.json(outcome.body);
	} catch (error) {
		console.error("[yoink] Orchestration failed:", error);
		return NextResponse.json(
			{ error: "Failed to process yoink" },
			{ status: 500 },
		);
	}
};

export const POST = withAppPauseProtection(handlePost);
