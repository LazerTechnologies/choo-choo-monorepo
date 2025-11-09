import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { type NextRequest, NextResponse } from "next/server";

const neynarClient = new NeynarAPIClient({
	apiKey: process.env.NEYNAR_API_KEY!,
});

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const {
			title,
			body: notificationBody,
			targetUrl,
			targetFids = [],
			filters = {},
		} = body;

		// Validate required fields
		if (!title || !notificationBody) {
			return NextResponse.json(
				{ error: "Title and body are required" },
				{ status: 400 },
			);
		}

		// Send notification using Neynar SDK
		const response = await neynarClient.publishFrameNotifications({
			targetFids,
			filters,
			notification: {
				title,
				body: notificationBody,
				target_url: targetUrl || process.env.NEXT_PUBLIC_URL!,
			},
		});

		return NextResponse.json({
			success: true,
			message: "Notification sent successfully",
			data: response,
		});
	} catch (error) {
		console.error("Error sending notification:", error);
		return NextResponse.json(
			{
				error: "Failed to send notification",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
