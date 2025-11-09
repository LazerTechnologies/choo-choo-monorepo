import { NextResponse } from "next/server";
import { stagingLog } from "@/lib/event-log";
import { isStagingStuck, listStagingEntries } from "@/lib/staging-manager";

const STAGING_STUCK_THRESHOLD_MS = 10 * 60 * 1000;

export async function GET() {
	try {
		const entries = await listStagingEntries();
		const stuckEntries = entries.filter((entry) =>
			isStagingStuck(entry, STAGING_STUCK_THRESHOLD_MS),
		);

		return NextResponse.json({
			status: stuckEntries.length === 0 ? "healthy" : "degraded",
			totalStaging: entries.length,
			stuckCount: stuckEntries.length,
			stuck: stuckEntries.map((entry) => ({
				tokenId: entry.tokenId,
				status: entry.status,
				orchestrator: entry.orchestrator,
				createdAt: entry.createdAt,
				ageMinutes: Math.round(
					Math.max(
						0,
						(Date.now() - new Date(entry.createdAt).getTime()) / 60000,
					),
				),
				lastError: entry.lastError,
			})),
		});
	} catch (error) {
		stagingLog.error("health_check.failed", {
			error,
			msg: "Staging health check failed",
		});
		return NextResponse.json(
			{
				status: "error",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
