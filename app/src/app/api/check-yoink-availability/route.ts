import { NextResponse } from "next/server";
import { APP_URL } from "@/lib/constants";
import { redis } from "@/lib/kv";
import { withAppPauseProtection } from "@/lib/middleware/app-maintenance";
import type { ApiHandler } from "@/lib/middleware/internal-auth";
import { sendChooChooNotification } from "@/lib/notifications";
import { getContractService } from "@/lib/services/contract";

const YOINK_NOTIFICATION_SENT_KEY = "yoink_notification_sent";

/**
 * POST /api/check-yoink-availability
 *
 * Internal endpoint to check if yoink is available and send notifications if needed.
 * This endpoint should be called periodically by a scheduled job.
 *
 * Protected by INTERNAL_SECRET to prevent unauthorized access.
 */
const handlePost: ApiHandler = async (request) => {
	try {
		// Verify internal secret for security
		const authHeader = request.headers.get("authorization");
		const expectedAuth = `Bearer ${process.env.INTERNAL_SECRET}`;

		if (!authHeader || authHeader !== expectedAuth) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const contractService = getContractService();

		// Check if yoink is available
		const yoinkStatus = await contractService.isYoinkable();

		if (!yoinkStatus.canYoink) {
			// Yoink is not available, clear any previous notification flag
			await redis.del(YOINK_NOTIFICATION_SENT_KEY);
			return NextResponse.json({
				success: true,
				yoinkAvailable: false,
				reason: yoinkStatus.reason,
				notificationSent: false,
			});
		}

		// Yoink is available - check if we've already sent a notification for this availability window
		const notificationSent = await redis.get(YOINK_NOTIFICATION_SENT_KEY);

		if (notificationSent === "true") {
			return NextResponse.json({
				success: true,
				yoinkAvailable: true,
				reason: yoinkStatus.reason,
				notificationSent: false,
				message: "Notification already sent for this yoink availability window",
			});
		}

		// Get current holder information for the notification
		const currentHolderRes = await fetch(`${APP_URL}/api/current-holder`);
		if (!currentHolderRes.ok) {
			throw new Error("Failed to fetch current holder");
		}

		const currentHolderData = await currentHolderRes.json();
		if (!currentHolderData.hasCurrentHolder) {
			throw new Error("No current holder found");
		}

		const currentHolderUsername = currentHolderData.currentHolder.username;

		// Send yoink availability notification
		const notificationSuccess = await sendChooChooNotification(
			"yoinkAvailable",
			currentHolderUsername,
		);

		if (notificationSuccess) {
			// Mark notification as sent for this availability window
			// Set with expiration to automatically clear after yoink timer + buffer
			const yoinkTimerHours = await contractService.getYoinkTimerHours();
			const expirationSeconds = (yoinkTimerHours + 1) * 60 * 60; // Add 1 hour buffer

			await redis.setex(YOINK_NOTIFICATION_SENT_KEY, expirationSeconds, "true");

			console.log(
				`[check-yoink-availability] Yoink availability notification sent for holder: ${currentHolderUsername}`,
			);
		}

		return NextResponse.json({
			success: true,
			yoinkAvailable: true,
			reason: yoinkStatus.reason,
			notificationSent: notificationSuccess,
			currentHolder: currentHolderUsername,
		});
	} catch (error) {
		console.error("[check-yoink-availability] Error:", error);
		return NextResponse.json(
			{
				error: "Failed to check yoink availability",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
};

export const POST = withAppPauseProtection(handlePost);
