/* eslint-disable @typescript-eslint/no-explicit-any */
import Redis from 'ioredis';

// Initialize Redis client with Railway public URL for better compatibility
// Railway recommends using REDIS_PUBLIC_URL when private network has issues
// @see: https://docs.railway.com/reference/errors/enotfound-redis-railway-internal#connecting-to-a-redis-database-locally
const redis = new Redis(
  process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL || 'redis://localhost:6379'
);

// Dedicated pub/sub clients
export const redisPub = redis;
export const redisSub = redis.duplicate();
export const CURRENT_HOLDER_CHANNEL = 'current-holder:updates';

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

// Single workflow state key containing complete workflow data as JSON
// Contains: { state: WorkflowState, winnerSelectionStart: string|null, currentCastHash: string|null }
// Written by: /api/workflow-state, webhook endpoints, train movement endpoints
// Read by: /api/workflow-state, useWorkflowState hook
export const WORKFLOW_STATE_KEY = 'workflowState';

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
