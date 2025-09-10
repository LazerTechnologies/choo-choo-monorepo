/* eslint-disable @typescript-eslint/no-explicit-any */
import Redis from 'ioredis';

// Initialize Redis client using private networking to avoid egress charges
// Use REDIS_PRIVATE_URL for Railway private network, fallback to public for local dev
// @see: https://docs.railway.com/guides/private-networking#communicating-over-the-private-network
const redis = new Redis(
  process.env.REDIS_PRIVATE_URL || process.env.REDIS_URL || 'redis://localhost:6379',
  {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
    // IPv6 support for Railway private networking
    family: 0, // Support both IPv4 and IPv6
    // Enhanced reconnection settings
    reconnectOnError: (err) => {
      // Reconnect on connection reset errors and readonly errors
      const reconnectErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
      return reconnectErrors.some(errorType => err.message.includes(errorType));
    },
    // Retry strategy for failed connections
    retryStrategy: (times) => {
      // Limit retries to prevent log flooding
      if (times > 10) {
        console.error(`[Redis] Max retries (10) exceeded, stopping retries`);
        return null; // Stop retrying
      }
      const delay = Math.min(times * 50, 2000);
      console.log(`[Redis] Retrying connection in ${delay}ms (attempt ${times})`);
      return delay;
    },
    // Connection timeout settings
    connectTimeout: 10000,
    commandTimeout: 5000,
  }
);

// Add error handling to prevent unhandled error events
redis.on('error', (err) => {
  console.warn('[Redis] Connection error:', err.message);
});

redis.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

redis.on('ready', () => {
  console.log('[Redis] Ready to accept commands');
});

redis.on('close', () => {
  console.log('[Redis] Connection closed');
});

redis.on('reconnecting', () => {
  console.log('[Redis] Attempting to reconnect...');
});

// Dedicated pub/sub clients with error handling
export const redisPub = redis;
export const redisSub = redis.duplicate();

// Add error handling to pub/sub clients
redisSub.on('error', (err) => {
  console.warn('[Redis Sub] Connection error:', err.message);
});

redisSub.on('connect', () => {
  console.log('[Redis Sub] Connected successfully');
});

redisSub.on('ready', () => {
  console.log('[Redis Sub] Ready to accept commands');
});
export const CURRENT_HOLDER_CHANNEL = 'current-holder:updates';

// Export redis instance for direct access
export { redis };

// =============================================================================
// REDIS KEYS DOCUMENTATION
// =============================================================================
// All Redis keys used by the ChooChoo app for reference and documentation

// Current train holder data (JSON: fid, username, displayName, pfpUrl, address, timestamp)
// Written by: /api/internal/mint-token, /api/admin/initial-holder, /api/yoink
// Read by: /api/current-holder, /api/webhook/cast-detection, /api/admin/holder-status
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
