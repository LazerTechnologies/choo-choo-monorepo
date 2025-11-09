import { NextResponse } from "next/server";
import { logger } from "@/lib/event-log";
import { redis } from "@/lib/kv";

/**
 * GET /api/health/staging
 *
 * Health check endpoint that monitors staging queue status
 * Returns count of staging entries and identifies stuck entries (>10 minutes old)
 */
export async function GET() {
	try {
		const keys = await redis.keys("staging:*");
		const stagingEntries = [];

		for (const key of keys) {
			const data = await redis.get(key);
			if (data) {
				try {
					stagingEntries.push(JSON.parse(data));
				} catch {
					// Skip invalid JSON
				}
			}
		}

		const stuckEntries = stagingEntries.filter((s) => {
			const age = Date.now() - new Date(s.createdAt).getTime();
			return age > 600000; // Older than 10 minutes
		});

		const status = stuckEntries.length === 0 ? "healthy" : "degraded";

		return NextResponse.json({
			status,
			totalStaging: stagingEntries.length,
			stuckCount: stuckEntries.length,
			stuck: stuckEntries.map((s) => ({
				tokenId: s.tokenId,
				status: s.status,
				orchestrator: s.orchestrator,
				createdAt: s.createdAt,
				ageMinutes: Math.round(
					(Date.now() - new Date(s.createdAt).getTime()) / 60000,
				),
				lastError: s.lastError,
			})),
		});
	} catch (error) {
		logger.error({
			domain: "health",
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
