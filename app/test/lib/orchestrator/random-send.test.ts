/* eslint-disable @typescript-eslint/no-explicit-any */
/** biome-ignore-all lint/style/noNonNullAssertion: fine in tests */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NEXT_PUBLIC_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
process.env.NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || 'test-neynar-key';

vi.mock('@/lib/kv', () => ({
  __esModule: true,
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  redisPub: { publish: vi.fn() },
  CURRENT_HOLDER_CHANNEL: 'current-holder',
}));

vi.mock('@/lib/redis-token-utils', () => ({
  __esModule: true,
  acquireLock: vi.fn().mockResolvedValue(true),
  releaseLock: vi.fn().mockResolvedValue(undefined),
  getOrSetPendingGeneration: vi.fn().mockResolvedValue({
    imageHash: 'img',
    metadataHash: 'meta',
    tokenURI: 'ipfs://uri',
    attributes: [],
    passengerUsername: 'currentholder',
  }),
  storeTokenDataWriteOnce: vi.fn().mockResolvedValue('created'),
  storeLastMovedTimestamp: vi.fn().mockResolvedValue(undefined),
  REDIS_KEYS: { pendingNFT: (id: number) => `pending-nft:${id}` },
}));

vi.mock('@/lib/services/contract', () => ({
  __esModule: true,
  getContractService: vi.fn(() => ({
    getNextOnChainTicketId: vi.fn().mockResolvedValueOnce(200).mockResolvedValueOnce(201),
    getMintedTokenIdFromTx: vi.fn().mockResolvedValue(200),
    hasBeenPassenger: vi.fn().mockResolvedValue(false),
    getCurrentTrainHolder: vi.fn().mockResolvedValue('0xholder'),
  })),
}));

vi.mock('@/lib/staging-manager', () => ({
  __esModule: true,
  createStaging: vi.fn().mockResolvedValue(undefined),
  updateStaging: vi.fn().mockResolvedValue({
    tokenId: 200,
    status: 'pinata_uploaded',
    version: 2,
    orchestrator: 'random-send',
    createdAt: new Date().toISOString(),
    retryCount: 0,
    newHolder: {
      fid: 456,
      username: 'winner',
      displayName: 'Winner',
      pfpUrl: 'https://example.com/winner.jpg',
      address: '0xwinner',
    },
    departingPassenger: {
      fid: 123,
      username: 'currentholder',
      displayName: 'Current Holder',
      pfpUrl: 'https://example.com/holder.jpg',
      address: '0xholder',
    },
    sourceCastHash: '0xcast',
    totalEligibleReactors: 10,
    imageHash: 'img',
    metadataHash: 'meta',
    tokenURI: 'ipfs://uri',
    attributes: [],
  }),
  getStaging: vi
    .fn()
    .mockResolvedValueOnce({
      tokenId: 200,
      status: 'pinata_uploaded',
      version: 2,
      orchestrator: 'random-send',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      newHolder: {
        fid: 456,
        username: 'winner',
        displayName: 'Winner',
        pfpUrl: 'https://example.com/winner.jpg',
        address: '0xwinner',
      },
      departingPassenger: {
        fid: 123,
        username: 'currentholder',
        displayName: 'Current Holder',
        pfpUrl: 'https://example.com/holder.jpg',
        address: '0xholder',
      },
      sourceCastHash: '0xcast',
      totalEligibleReactors: 10,
      imageHash: 'img',
      metadataHash: 'meta',
      tokenURI: 'ipfs://uri',
      attributes: [],
    })
    .mockResolvedValue({
      tokenId: 200,
      status: 'completed',
      version: 4,
      orchestrator: 'random-send',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      newHolder: {
        fid: 456,
        username: 'winner',
        displayName: 'Winner',
        pfpUrl: 'https://example.com/winner.jpg',
        address: '0xwinner',
      },
      departingPassenger: {
        fid: 123,
        username: 'currentholder',
        displayName: 'Current Holder',
        pfpUrl: 'https://example.com/holder.jpg',
        address: '0xholder',
      },
      sourceCastHash: '0xcast',
      totalEligibleReactors: 10,
      imageHash: 'img',
      metadataHash: 'meta',
      tokenURI: 'ipfs://uri',
      attributes: [],
      txHash: '0xtx',
      blockNumber: 12345,
    }),
  promoteStaging: vi.fn().mockImplementation(async (tokenId: number) => {
    const staging = await getStaging(tokenId);
    if (staging && staging.status === 'completed' && staging.txHash) {
      await storeTokenDataWriteOnce({
        tokenId: staging.tokenId,
        imageHash: staging.imageHash!,
        metadataHash: staging.metadataHash!,
        tokenURI: staging.tokenURI!,
        holderAddress: staging.departingPassenger.address,
        holderUsername: staging.departingPassenger.username,
        holderFid: staging.departingPassenger.fid,
        holderDisplayName: staging.departingPassenger.displayName,
        holderPfpUrl: staging.departingPassenger.pfpUrl,
        transactionHash: staging.txHash,
        timestamp: new Date().toISOString(),
        blockNumber: staging.blockNumber,
        attributes: staging.attributes,
        sourceType: 'send-train',
        sourceCastHash: staging.sourceCastHash,
        totalEligibleReactors: staging.totalEligibleReactors,
      });
    }
  }),
  isStagingStuck: vi.fn().mockReturnValue(false),
  abandonStaging: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/services/neynar-score', () => ({
  __esModule: true,
  checkNeynarScore: vi.fn().mockResolvedValue({ meetsMinimum: true, score: 0.8 }),
  MIN_NEYNAR_SCORE: 0.5,
}));

import { acquireLock, releaseLock, storeTokenDataWriteOnce } from '@/lib/redis-token-utils';
import { getStaging } from '@/lib/staging-manager';
import { orchestrateRandomSend } from '@/lib/train-orchestrator';

describe('orchestrateRandomSend', () => {
  beforeAll(() => {
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/api/internal/select-winner')) {
        return new Response(
          JSON.stringify({
            success: true,
            winner: {
              fid: 456,
              username: 'winner',
              displayName: 'Winner',
              pfpUrl: 'https://example.com/winner.jpg',
              address: '0xwinner',
            },
            totalEligibleReactors: 10,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/current-holder')) {
        return new Response(
          JSON.stringify({
            hasCurrentHolder: true,
            currentHolder: {
              fid: 123,
              username: 'currentholder',
              displayName: 'Current Holder',
              pfpUrl: 'https://example.com/holder.jpg',
              address: '0xholder',
            },
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/internal/generate-nft')) {
        return new Response(
          JSON.stringify({
            success: true,
            tokenURI: 'ipfs://uri',
            imageHash: 'img',
            metadataHash: 'meta',
            metadata: { attributes: [] },
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/internal/mint-token')) {
        return new Response(
          JSON.stringify({
            success: true,
            actualTokenId: 200,
            txHash: '0xtx',
          }),
          {
            status: 200,
          }
        );
      }
      if (url.includes('/api/internal/send-cast') || url.includes('/api/workflow-state')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should acquire and release distributed lock by castHash', async () => {
    const res = await orchestrateRandomSend('0xcast');
    expect(res.status).toBe(200);
    expect(acquireLock).toHaveBeenCalledWith('lock:random:0xcast', expect.any(Number));
    expect(releaseLock).toHaveBeenCalledWith('lock:random:0xcast');
  });

  it('should store token data with sourceCastHash and totalEligibleReactors', async () => {
    const res = await orchestrateRandomSend('0xcast');
    expect(res.status).toBe(200);
    expect(storeTokenDataWriteOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceCastHash: '0xcast',
        totalEligibleReactors: 10,
      })
    );
  });

  it('should handle winner selection failure', async () => {
    vi.mocked(global.fetch).mockImplementationOnce(
      async () => new Response(JSON.stringify({ success: false }), { status: 200 })
    );
    const res = await orchestrateRandomSend('0xcast');
    expect(res.status).toBe(500);
  });
});
