const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
// Adjust this threshold based on your needs (0.5-0.6 is typical)
export const MIN_NEYNAR_SCORE = 0.55;

export interface NeynarScoreCheck {
	score: number;
	meetsMinimum: boolean;
}

interface NeynarUser {
	fid: number;
	username: string;
	score?: number;
}

export async function checkNeynarScore(fid: number): Promise<NeynarScoreCheck> {
	if (!NEYNAR_API_KEY) {
		throw new Error("NEYNAR_API_KEY environment variable is required");
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
			console.error(
				`[neynar-score] Failed to fetch user data: ${response.status}`,
			);
			throw new Error("Failed to fetch Neynar user data");
		}

		const data = await response.json();
		const user = data?.users?.[0] as NeynarUser | undefined;

		if (!user) {
			throw new Error(`User with FID ${fid} not found`);
		}

		// Use the main 'score' field (not experimental.neynar_user_score which is deprecated)
		const score = user.score ?? 0;
		const meetsMinimum = score >= MIN_NEYNAR_SCORE;

		console.log(
			`[neynar-score] User ${user.username} (FID: ${fid}) has score: ${score} (minimum: ${MIN_NEYNAR_SCORE})`,
		);

		return {
			score,
			meetsMinimum,
		};
	} catch (error) {
		console.error(
			`[neynar-score] Failed to check score for FID ${fid}:`,
			error,
		);
		throw new Error(
			`Failed to check Neynar score: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}
