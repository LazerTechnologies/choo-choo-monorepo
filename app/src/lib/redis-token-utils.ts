import { redis } from '@/lib/kv';
import type { CurrentTokenTracker, LastMovedTimestamp, PendingNFT, TokenData } from '@/types/nft';

interface RedisWithSetOptions {
  set: (key: string, value: string, ...args: (string | number)[]) => Promise<string | null>;
  del: (key: string) => Promise<number>;
  get: (key: string) => Promise<string | null>;
}

/**
 * Redis key patterns for token data
 */
export const REDIS_KEYS = {
  token: (tokenId: number) => `token${tokenId}`,
  currentTokenId: 'current-token-id',
  lastMovedTimestamp: 'last-moved-timestamp',
  pendingNFT: (tokenId: number) => `pending-nft:${tokenId}`,
} as const;

/** Simple distributed lock helpers (best-effort, no Lua) */
export async function acquireLock(key: string, ttlMs: number): Promise<boolean> {
  try {
    const client = redis as unknown as RedisWithSetOptions;
    const result = await client.set(key, '1', 'NX', 'PX', ttlMs);
    return result === 'OK';
  } catch (error) {
    console.error('[redis-token-utils] acquireLock error:', error);
    return false;
  }
}

export async function releaseLock(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    console.warn('[redis-token-utils] releaseLock error:', error);
  }
}

/** Pending generation cache for idempotency while preserving randomness */
export async function getOrSetPendingGeneration(
  tokenId: number,
  producer: () => Promise<PendingNFT>,
  ttlSeconds: number = 15 * 60,
): Promise<PendingNFT> {
  const key = REDIS_KEYS.pendingNFT(tokenId);
  const genLockKey = `gen-lock:${tokenId}`;

  try {
    const existing = await redis.get(key);
    if (existing) return JSON.parse(existing) as PendingNFT;
  } catch (error) {
    console.warn('[redis-token-utils] getOrSetPendingGeneration read error:', error);
  }

  // Try to acquire generation lock
  let lockAcquired = false;
  try {
    const client = redis as unknown as RedisWithSetOptions;
    const result = await client.set(genLockKey, '1', 'NX', 'PX', 60000);
    lockAcquired = result === 'OK';
  } catch (error) {
    console.warn('[redis-token-utils] Generation lock acquisition error:', error);
  }

  if (lockAcquired) {
    // We acquired the lock, generate the NFT
    try {
      const payload = await producer();
      try {
        const client = redis as unknown as RedisWithSetOptions;
        await client.set(key, JSON.stringify(payload), 'EX', ttlSeconds);
      } catch (error) {
        console.warn('[redis-token-utils] getOrSetPendingGeneration write error:', error);
      }
      return payload;
    } finally {
      try {
        await redis.del(genLockKey);
      } catch (error) {
        console.warn('[redis-token-utils] Generation lock release error:', error);
      }
    }
  } else {
    // Someone else is generating, poll for result
    const maxPolls = 30; // 30 * 200ms = 6 seconds max wait
    for (let i = 0; i < maxPolls; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200));

      try {
        const existing = await redis.get(key);
        if (existing) return JSON.parse(existing) as PendingNFT;
      } catch (error) {
        console.warn('[redis-token-utils] Polling read error:', error);
      }
    }

    // Timeout fallback: try to generate ourselves
    console.warn(
      `[redis-token-utils] Generation timeout for token ${tokenId}, falling back to direct generation`,
    );
    const payload = await producer();
    try {
      const client = redis as unknown as RedisWithSetOptions;
      await client.set(key, JSON.stringify(payload), 'EX', ttlSeconds);
    } catch (error) {
      console.warn('[redis-token-utils] getOrSetPendingGeneration fallback write error:', error);
    }
    return payload;
  }
}

/** Write-once token data with monotonic tracker update */
export async function storeTokenDataWriteOnce(tokenData: TokenData): Promise<'created' | 'exists'> {
  const key = REDIS_KEYS.token(tokenData.tokenId);
  try {
    const client = redis as unknown as RedisWithSetOptions;
    const setnx = await client.set(key, JSON.stringify(tokenData), 'NX');
    const created = setnx === 'OK';

    // Update tracker monotonically if needed (best-effort)
    try {
      const data = await redis.get(REDIS_KEYS.currentTokenId);
      let current = 0;
      if (data) {
        const tracker = JSON.parse(data) as CurrentTokenTracker;
        current = tracker.currentTokenId;
      }
      if (tokenData.tokenId > current) {
        const tracker: CurrentTokenTracker = {
          currentTokenId: tokenData.tokenId,
          lastUpdated: new Date().toISOString(),
        };
        await redis.set(REDIS_KEYS.currentTokenId, JSON.stringify(tracker));
      }
    } catch (err) {
      console.warn('[redis-token-utils] tracker update error:', err);
    }

    return created ? 'created' : 'exists';
  } catch (error) {
    console.error('[redis-token-utils] storeTokenDataWriteOnce error:', error);
    // Fallback to exists to avoid overwrites
    return 'exists';
  }
}

/**
 * @deprecated Use getContractService().getNextOnChainTicketId() instead
 *
 * Get the next available token ID for minting
 * This function is deprecated in favor of using the contract as the authoritative source of truth
 */
export async function getNextTokenId(): Promise<number> {
  console.warn(
    '[redis-token-utils] getNextTokenId() is deprecated. Use getContractService().getNextOnChainTicketId() instead',
  );

  try {
    const { getContractService } = await import('@/lib/services/contract');
    const contractService = getContractService();
    const nextTokenId = await contractService.getNextOnChainTicketId();
    console.log(
      '[redis-token-utils] Next token ID from contract (via deprecated function):',
      nextTokenId,
    );
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
    // Only log parse errors in development to reduce log volume
    if (process.env.NODE_ENV === 'development') {
      console.error(`Failed to parse token data for token ${tokenId}:`, error);
    } else {
      // In production, only log once per unique token to prevent spam
      console.warn(`[redis-token-utils] Corrupted data for token ${tokenId} (use repair endpoint)`);
    }
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
  _tokenId: number,
  transactionHash: string,
  timestamp: string = new Date().toISOString(),
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
