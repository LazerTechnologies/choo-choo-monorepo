/* eslint-disable @typescript-eslint/no-explicit-any */
import Redis from 'ioredis';

// Initialize Redis client with Railway public URL for better compatibility
// Railway recommends using REDIS_PUBLIC_URL when private network has issues
// @see: https://docs.railway.com/reference/errors/enotfound-redis-railway-internal#connecting-to-a-redis-database-locally
const redis = new Redis(
  process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL || 'redis://localhost:6379'
);

// Export redis instance for direct access
export { redis };

// =============================================================================
// REDIS KEYS DOCUMENTATION
// =============================================================================
// All Redis keys used by the ChooChoo app for reference and documentation

// Current train holder data (JSON: fid, username, displayName, pfpUrl, address, timestamp)
// Written by: /api/internal/mint-token, /api/admin-set-initial-holder, /api/yoink
// Read by: /api/current-holder, /api/webhook/cast-detection, /api/admin-check-holder-status
// Used by: useCurrentHolder hook, CurrentHolderItem component
export const CURRENT_HOLDER_KEY = 'current-holder';

// Hash of the current holder's cast that people react to for winner selection
// Written by: /api/cast, /api/webhook/cast-detection
// Read by: /api/cast-status, /api/send-train, WinnerSelectionWidget
// Cleared by: All train movement endpoints when train moves
export const CURRENT_CAST_HASH_KEY = 'current-cast-hash';

// Flag indicating if current holder has posted their "I'm riding ChooChoo" cast
// Written by: /api/webhook/cast-detection, /api/set-user-casted
// Read by: /api/cast-status, /api/get-user-casted
// Cleared by: All train movement endpoints when train moves
export const HAS_CURRENT_USER_CASTED_KEY = 'hasCurrentUserCasted';

// Flag for random winner mode vs manual selection mode
// Written by: /api/enable-random-winner, WinnerSelectionWidget via /api/redis
// Read by: WinnerSelectionWidget via /api/redis
// Cleared by: All train movement endpoints when train moves
export const USE_RANDOM_WINNER_KEY = 'useRandomWinner';

// Timestamp when random winner mode was enabled (30 min timer starts)
// Written by: /api/enable-random-winner
// Read by: WinnerSelectionWidget via /api/redis
// Cleared by: All train movement endpoints when train moves, WinnerSelectionWidget when disabling
export const WINNER_SELECTION_START_KEY = 'winnerSelectionStart';

// Flag indicating if public random winner button should be enabled
// Written by: /api/enable-public-send, WinnerSelectionWidget (auto-enable after timer)
// Read by: WinnerSelectionWidget via /api/redis
// Cleared by: All train movement endpoints when train moves, WinnerSelectionWidget when disabling
export const IS_PUBLIC_SEND_ENABLED_KEY = 'isPublicSendEnabled';

// Health Check
export async function healthCheck(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
}> {
  try {
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;

    return {
      connected: true,
      latency,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
