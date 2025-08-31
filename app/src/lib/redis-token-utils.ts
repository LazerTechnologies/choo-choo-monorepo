import { redis } from '@/lib/kv';
import type { TokenData, CurrentTokenTracker, LastMovedTimestamp } from '@/types/nft';

/**
 * Redis key patterns for token data
 */
export const REDIS_KEYS = {
  token: (tokenId: number) => `token${tokenId}`,
  currentTokenId: 'current-token-id',
  lastMovedTimestamp: 'last-moved-timestamp',
} as const;

/**
 * @deprecated Use getContractService().getNextOnChainTicketId() instead
 * 
 * Get the next available token ID for minting
 * This function is deprecated in favor of using the contract as the authoritative source of truth
 */
export async function getNextTokenId(): Promise<number> {
  console.warn('[redis-token-utils] getNextTokenId() is deprecated. Use getContractService().getNextOnChainTicketId() instead');
  
  try {
    const { getContractService } = await import('@/lib/services/contract');
    const contractService = getContractService();
    const nextTokenId = await contractService.getNextOnChainTicketId();
    console.log('[redis-token-utils] Next token ID from contract (via deprecated function):', nextTokenId);
    return nextTokenId;
  } catch (error) {
    console.error('[redis-token-utils] Failed to get next token ID from contract:', error);
    throw new Error('Failed to get next token ID from contract');
  }
}

/**
 * Store comprehensive token data in Redis and update the token ID tracker
 */
export async function storeTokenData(tokenData: TokenData): Promise<void> {
  const key = REDIS_KEYS.token(tokenData.tokenId);
  await redis.set(key, JSON.stringify(tokenData));

  // Update current token ID tracker to this token ID
  const tracker: CurrentTokenTracker = {
    currentTokenId: tokenData.tokenId,
    lastUpdated: new Date().toISOString(),
  };
  await redis.set(REDIS_KEYS.currentTokenId, JSON.stringify(tracker));

  console.log(`[redis-token-utils] Updated token ID tracker to: ${tokenData.tokenId}`);
}

/**
 * Retrieve token data from Redis
 */
export async function getTokenData(tokenId: number): Promise<TokenData | null> {
  const key = REDIS_KEYS.token(tokenId);
  const data = await redis.get(key);

  if (!data) return null;

  try {
    return JSON.parse(data) as TokenData;
  } catch (error) {
    console.error(`Failed to parse token data for token ${tokenId}:`, error);
    return null;
  }
}

/**
 * Get current token ID from Redis
 */
export async function getCurrentTokenId(): Promise<number | null> {
  const data = await redis.get(REDIS_KEYS.currentTokenId);

  if (!data) return null;

  try {
    const tracker = JSON.parse(data) as CurrentTokenTracker;
    return tracker.currentTokenId;
  } catch (error) {
    console.error('Failed to parse current token ID tracker:', error);
    return null;
  }
}

/**
 * Get current token tracker with metadata
 */
export async function getCurrentTokenTracker(): Promise<CurrentTokenTracker | null> {
  const data = await redis.get(REDIS_KEYS.currentTokenId);

  if (!data) return null;

  try {
    return JSON.parse(data) as CurrentTokenTracker;
  } catch (error) {
    console.error('Failed to parse current token ID tracker:', error);
    return null;
  }
}

/**
 * Get multiple token data entries
 */
export async function getTokenDataRange(startId: number, endId: number): Promise<TokenData[]> {
  const promises: Promise<TokenData | null>[] = [];

  for (let tokenId = startId; tokenId <= endId; tokenId++) {
    promises.push(getTokenData(tokenId));
  }

  const results = await Promise.all(promises);
  return results.filter((data): data is TokenData => data !== null);
}

/**
 * Check if token data exists in Redis
 */
export async function tokenDataExists(tokenId: number): Promise<boolean> {
  const key = REDIS_KEYS.token(tokenId);
  const exists = await redis.exists(key);
  return exists === 1;
}

/**
 * Store the last moved timestamp after a train movement
 */
export async function storeLastMovedTimestamp(
  tokenId: number,
  transactionHash: string,
  timestamp: string = new Date().toISOString()
): Promise<void> {
  const lastMoved: LastMovedTimestamp = {
    timestamp,
    transactionHash,
  };
  await redis.set(REDIS_KEYS.lastMovedTimestamp, JSON.stringify(lastMoved));
}

/**
 * Get the last moved timestamp
 */
export async function getLastMovedTimestamp(): Promise<LastMovedTimestamp | null> {
  const data = await redis.get(REDIS_KEYS.lastMovedTimestamp);

  if (!data) return null;

  try {
    return JSON.parse(data) as LastMovedTimestamp;
  } catch (error) {
    console.error('Failed to parse last moved timestamp:', error);
    return null;
  }
}

/**
 * Initialize or fix the Redis token tracker based on existing token data
 * This can be used to fix sync issues
 */
export async function syncTokenTracker(): Promise<number> {
  try {
    // Find the highest token ID in Redis
    let highestTokenId = 0;

    // Check tokens 1-10 (should cover most cases)
    for (let i = 1; i <= 10; i++) {
      const tokenData = await getTokenData(i);
      if (tokenData) {
        highestTokenId = i;
      }
    }

    console.log(`[redis-token-utils] Found highest token ID in Redis: ${highestTokenId}`);

    // Update the tracker
    if (highestTokenId > 0) {
      const tracker: CurrentTokenTracker = {
        currentTokenId: highestTokenId,
        lastUpdated: new Date().toISOString(),
      };
      await redis.set(REDIS_KEYS.currentTokenId, JSON.stringify(tracker));
      console.log(`[redis-token-utils] Synced token tracker to: ${highestTokenId}`);
    }

    return highestTokenId;
  } catch (error) {
    console.error('[redis-token-utils] Failed to sync token tracker:', error);
    throw error;
  }
}
