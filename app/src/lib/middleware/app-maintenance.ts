import { NextResponse } from "next/server";
import { isAppPaused } from "@/lib/maintenance";
import type { ApiHandler } from "@/lib/middleware/internal-auth";

interface MaintenanceOptions {
	allowWhenPaused?: boolean;
}

const maintenanceHeaders = {
	"Cache-Control": "no-store",
	"Retry-After": "60",
};

export function withAppPauseProtection(
	handler: ApiHandler,
	options: MaintenanceOptions = {},
): ApiHandler {
	return async (request: Request) => {
		if (options.allowWhenPaused) {
			return handler(request);
		}

		const paused = await isAppPaused();
		if (paused) {
			return NextResponse.json(
				{
					error: "Service temporarily unavailable",
					code: "APP_PAUSED",
					isPaused: true,
				},
				{
					status: 503,
					headers: maintenanceHeaders,
				},
			);
		}

		return handler(request);
	};
}
