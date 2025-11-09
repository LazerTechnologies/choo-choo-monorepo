import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { stagingLog } from "@/lib/event-log";
import {
	isStagingStuck,
	listStagingEntries,
	promoteStaging,
} from "@/lib/staging-manager";

const STAGING_STUCK_THRESHOLD_MS = 10 * 60 * 1000;

export async function GET(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.ok) return auth.response;

	try {
		const entries = await listStagingEntries();
		const stuckEntries = entries.filter((entry) =>
			isStagingStuck(entry, STAGING_STUCK_THRESHOLD_MS),
		);

		return NextResponse.json({
			success: true,
			total: entries.length,
			stuckCount: stuckEntries.length,
			entries,
			stuckEntries,
		});
	} catch (error) {
		stagingLog.error("listing.parse_failed", {
			error,
			msg: "Failed to list staging entries",
		});
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}

export async function POST(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.ok) return auth.response;

	let tokenId: number | undefined;

	try {
		const body = await request.json();
		const rawTokenId = Number(body?.tokenId);

		if (!Number.isInteger(rawTokenId) || rawTokenId <= 0) {
			return NextResponse.json(
				{ success: false, error: "tokenId must be a positive integer" },
				{ status: 400 },
			);
		}

		tokenId = rawTokenId;

		await promoteStaging(tokenId);
		stagingLog.info("promotion.success", {
			tokenId,
			msg: "Staging entry manually promoted via admin endpoint",
		});

		return NextResponse.json({ success: true, tokenId });
	} catch (error) {
		stagingLog.error("promotion.failed", {
			error,
			msg: "Failed to promote staging entry via admin endpoint",
			tokenId,
		});
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
