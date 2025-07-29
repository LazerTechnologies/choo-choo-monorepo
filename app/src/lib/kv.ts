/* eslint-disable @typescript-eslint/no-explicit-any */
import { Redis } from '@upstash/redis';
import { Address } from 'viem';

// Initialize Redis client with environment variables
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Types for KV data structures
export interface ChooChooHolder {
  farcasterUsername: string;
  walletAddress: Address;
  timestamp: number; // Unix timestamp when they received it
  tokenId: number;
  ipfsHash: string; // IPFS hash for the NFT image
  fid?: number; // Farcaster ID (optional)
  castHash?: string; // The cast hash that led to them winning (optional)
}

export interface ProcessingState {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  castHash: string;
  startedAt: number;
  completedAt?: number;
  winner?: Address;
  tokenId?: number;
  txHash?: string;
  ipfsHash?: string;
  error?: string;
}

export interface IdempotencyRecord {
  processedAt: number;
  result: any; // The original response data
  status: 'success' | 'error';
}

// KV Store Keys
const KEYS = {
  // Active cast hash for determining next stop winner
  ACTIVE_CAST_HASH: 'choochoo:active_cast_hash',

  // All holders history (sorted set by timestamp)
  HOLDERS_HISTORY: 'choochoo:holders_history',

  // Individual holder data
  HOLDER: (tokenId: number) => `choochoo:holder:${tokenId}`,

  // Current holder (latest token)
  CURRENT_HOLDER: 'choochoo:current_holder',

  // Processing state for transactions
  PROCESSING_STATE: (castHash: string) => `choochoo:processing:${castHash}`,

  // Idempotency tracking
  IDEMPOTENCY: (key: string) => `choochoo:idempotency:${key}`,

  // Token metadata cache
  TOKEN_METADATA: (tokenId: number) => `choochoo:token:${tokenId}`,

  // General stats
  STATS: 'choochoo:stats',
} as const;

// TTL values (in seconds)
const TTL = {
  IDEMPOTENCY: 24 * 60 * 60, // 24 hours
  PROCESSING_STATE: 7 * 24 * 60 * 60, // 7 days
  TOKEN_METADATA: 30 * 24 * 60 * 60, // 30 days
} as const;

// Cast Hash Management
export async function setCastHash(castHash: string): Promise<void> {
  await redis.set(KEYS.ACTIVE_CAST_HASH, castHash);
}

export async function getCastHash(): Promise<string | null> {
  return await redis.get(KEYS.ACTIVE_CAST_HASH);
}

// Holder Management
export async function addHolder(holder: ChooChooHolder): Promise<void> {
  const holderData = {
    ...holder,
    timestamp: Date.now(),
  };

  // Store individual holder data
  await redis.set(KEYS.HOLDER(holder.tokenId), holderData);

  // Add to sorted history (score = timestamp for chronological order)
  await redis.zadd(KEYS.HOLDERS_HISTORY, {
    score: holderData.timestamp,
    member: JSON.stringify({ tokenId: holder.tokenId, ...holderData }),
  });

  // Update current holder
  await redis.set(KEYS.CURRENT_HOLDER, holderData);
}

export async function getHolder(tokenId: number): Promise<ChooChooHolder | null> {
  return await redis.get(KEYS.HOLDER(tokenId));
}

export async function getCurrentHolder(): Promise<ChooChooHolder | null> {
  return await redis.get(KEYS.CURRENT_HOLDER);
}

export async function getHoldersHistory(
  limit: number = 50,
  offset: number = 0
): Promise<ChooChooHolder[]> {
  // Get holders in reverse chronological order (newest first)
  const holders = await redis.zrevrange(KEYS.HOLDERS_HISTORY, offset, offset + limit - 1);

  return holders.map((holder) => JSON.parse(holder as string));
}

export async function getTotalHolders(): Promise<number> {
  return await redis.zcard(KEYS.HOLDERS_HISTORY);
}

// Processing State Management
export async function setProcessingState(castHash: string, state: ProcessingState): Promise<void> {
  await redis.setex(KEYS.PROCESSING_STATE(castHash), TTL.PROCESSING_STATE, JSON.stringify(state));
}

export async function getProcessingState(castHash: string): Promise<ProcessingState | null> {
  const state = await redis.get(KEYS.PROCESSING_STATE(castHash));
  return state ? JSON.parse(state as string) : null;
}

export async function updateProcessingState(
  castHash: string,
  updates: Partial<ProcessingState>
): Promise<void> {
  const currentState = await getProcessingState(castHash);
  if (currentState) {
    const newState = { ...currentState, ...updates };
    await setProcessingState(castHash, newState);
  }
}

// Idempotency Management
export async function setIdempotencyRecord(key: string, record: IdempotencyRecord): Promise<void> {
  await redis.setex(KEYS.IDEMPOTENCY(key), TTL.IDEMPOTENCY, JSON.stringify(record));
}

export async function getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null> {
  const record = await redis.get(KEYS.IDEMPOTENCY(key));
  return record ? JSON.parse(record as string) : null;
}

export async function checkIdempotency(key: string): Promise<{
  exists: boolean;
  record?: IdempotencyRecord;
}> {
  const record = await getIdempotencyRecord(key);
  return {
    exists: !!record,
    record: record || undefined,
  };
}

// Token Metadata Management
export async function setTokenMetadata(
  tokenId: number,
  metadata: {
    ipfsHash: string;
    attributes: any[];
    image: string;
    name: string;
    description: string;
  }
): Promise<void> {
  await redis.setex(KEYS.TOKEN_METADATA(tokenId), TTL.TOKEN_METADATA, JSON.stringify(metadata));
}

export async function getTokenMetadata(tokenId: number): Promise<any | null> {
  const metadata = await redis.get(KEYS.TOKEN_METADATA(tokenId));
  return metadata ? JSON.parse(metadata as string) : null;
}

// Stats Management
export async function updateStats(stats: {
  totalMints?: number;
  totalHolders?: number;
  lastMintTimestamp?: number;
  lastCastHash?: string;
}): Promise<void> {
  const currentStats = await getStats();
  const newStats = { ...currentStats, ...stats };
  await redis.set(KEYS.STATS, JSON.stringify(newStats));
}

export async function getStats(): Promise<{
  totalMints: number;
  totalHolders: number;
  lastMintTimestamp: number | null;
  lastCastHash: string | null;
}> {
  const stats = await redis.get(KEYS.STATS);
  if (stats) {
    return JSON.parse(stats as string);
  }

  // Return default stats
  return {
    totalMints: 0,
    totalHolders: 0,
    lastMintTimestamp: null,
    lastCastHash: null,
  };
}

// Utility Functions
export async function clearProcessingStates(): Promise<void> {
  // Get all processing state keys
  const keys = await redis.keys('choochoo:processing:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

export async function clearExpiredIdempotencyKeys(): Promise<number> {
  // Redis handles TTL automatically, but this function can be used for manual cleanup
  const keys = await redis.keys('choochoo:idempotency:*');
  let deletedCount = 0;

  for (const key of keys) {
    const ttl = await redis.ttl(key);
    if (ttl === -1 || ttl === -2) {
      // -1 = no TTL, -2 = expired
      await redis.del(key);
      deletedCount++;
    }
  }

  return deletedCount;
}

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

// Initialize function to set up any required data structures
export async function initializeKV(): Promise<void> {
  try {
    // Initialize stats if they don't exist
    const stats = await getStats();
    if (stats.totalMints === 0) {
      await updateStats({
        totalMints: 0,
        totalHolders: 0,
        lastMintTimestamp: null,
        lastCastHash: null,
      });
    }
  } catch (error) {
    console.error('Failed to initialize KV store:', error);
    throw error;
  }
}
