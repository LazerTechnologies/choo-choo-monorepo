import { redis } from "@/lib/kv";

export const APP_PAUSE_KEY = "app-paused";

const CACHE_TTL_MS = 2_000;
const ERROR_CACHE_TTL_MS = 500;

interface PauseCacheEntry {
	isPaused: boolean;
	expiresAt: number;
}

let pauseCache: PauseCacheEntry | null = null;

export async function isAppPaused(): Promise<boolean> {
	const now = Date.now();

	if (pauseCache && pauseCache.expiresAt > now) {
		return pauseCache.isPaused;
	}

	try {
		const value = await redis.get(APP_PAUSE_KEY);
		const isPaused = value === "true";

		pauseCache = {
			isPaused,
			expiresAt: now + CACHE_TTL_MS,
		};

		return isPaused;
	} catch (error) {
		console.error("[maintenance] Failed to read app pause state:", error);

		pauseCache = {
			isPaused: false,
			expiresAt: now + ERROR_CACHE_TTL_MS,
		};

		return false;
	}
}

export function setAppPauseCache(isPaused: boolean): void {
	pauseCache = {
		isPaused,
		expiresAt: Date.now() + CACHE_TTL_MS,
	};
}

export function clearAppPauseCache(): void {
	pauseCache = null;
}
