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
    getNextOnChainTicketId: vi.fn().mockResolvedValueOnce(100).mockResolvedValueOnce(101),
    getMintedTokenIdFromTx: vi.fn().mockResolvedValue(100),
    hasBeenPassenger: vi.fn().mockResolvedValue(false),
    getCurrentTrainHolder: vi.fn().mockResolvedValue('0xholder'),
  })),
}));

vi.mock('@/lib/staging-manager', () => ({
  __esModule: true,
  createStaging: vi.fn().mockResolvedValue(undefined),
  updateStaging: vi.fn().mockResolvedValue({
    tokenId: 100,
    status: 'pinata_uploaded',
    version: 2,
    orchestrator: 'manual-send',
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
    imageHash: 'img',
    metadataHash: 'meta',
    tokenURI: 'ipfs://uri',
    attributes: [],
  }),
  getStaging: vi
    .fn()
    .mockResolvedValueOnce({
      tokenId: 100,
      status: 'pinata_uploaded',
      version: 2,
      orchestrator: 'manual-send',
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
      imageHash: 'img',
      metadataHash: 'meta',
      tokenURI: 'ipfs://uri',
      attributes: [],
    })
    .mockResolvedValue({
      tokenId: 100,
      status: 'completed',
      version: 4,
      orchestrator: 'manual-send',
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
        sourceType: staging.orchestrator === 'manual-send' ? 'manual' : 'send-train',
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
import { orchestrateManualSend } from '@/lib/train-orchestrator';

describe('orchestrateManualSend', () => {
  beforeAll(() => {
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default fetch mock handlers
    vi.mocked(global.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = input.toString();
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
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('api.neynar.com')) {
        return new Response(
          JSON.stringify({
            users: [
              {
                fid: 456,
                username: 'winner',
                display_name: 'Winner',
                pfp_url: 'https://example.com/winner.jpg',
                verified_addresses: {
                  primary: { eth_address: '0xwinner' },
                  eth_addresses: ['0xwinner'],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
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
            actualTokenId: 100,
            txHash: '0xtx',
          }),
          {
            status: 200,
          }
        );
      }
      if (url.includes('/api/internal/send-cast')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url.includes('/api/workflow-state')) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should acquire and release distributed lock correctly', async () => {
    const res = await orchestrateManualSend(123, 456);
    expect(res.status).toBe(200);
    expect(acquireLock).toHaveBeenCalledWith('lock:manual:123:456', expect.any(Number));
    expect(releaseLock).toHaveBeenCalledWith('lock:manual:123:456');
  });

  it('should handle lock acquisition failure with 409 status', async () => {
    vi.mocked(acquireLock).mockResolvedValueOnce(false);
    const res = await orchestrateManualSend(123, 456);
    expect(res.status).toBe(409);
  });

  it('should store token data with departing passenger as holder and update current-holder', async () => {
    const res = await orchestrateManualSend(123, 456);
    expect(res.status).toBe(200);
    expect(storeTokenDataWriteOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenURI: 'ipfs://uri',
        holderUsername: 'currentholder',
        holderAddress: '0xholder',
      })
    );
  });

  it('should fallback to Neynar for departing passenger address when missing', async () => {
    // First fetch to current-holder returns missing address
    vi.mocked(global.fetch)
      .mockImplementationOnce(
        async () =>
          new Response(
            JSON.stringify({
              hasCurrentHolder: true,
              currentHolder: {
                fid: 123,
                username: 'currentholder',
                displayName: 'Current Holder',
                pfpUrl: 'https://example.com/holder.jpg',
                address: null,
              },
            }),
            { status: 200 }
          )
      )
      // Neynar fetch for winner (targetFid: 456)
      .mockImplementationOnce(
        async () =>
          new Response(
            JSON.stringify({
              users: [
                {
                  fid: 456,
                  username: 'winner',
                  display_name: 'Winner',
                  pfp_url: 'https://example.com/winner.jpg',
                  verified_addresses: {
                    primary: { eth_address: '0xwinner' },
                  },
                },
              ],
            }),
            { status: 200 }
          )
      )
      // Neynar fetch for departing passenger (currentHolderFid: 123) - fallback
      .mockImplementationOnce(
        async () =>
          new Response(
            JSON.stringify({
              users: [
                {
                  fid: 123,
                  username: 'currentholder',
                  display_name: 'Current Holder',
                  pfp_url: 'https://example.com/holder.jpg',
                  verified_addresses: {
                    primary: { eth_address: '0xwinner' },
                  },
                },
              ],
            }),
            { status: 200 }
          )
      );

    // Update getStaging mock to return staging with the Neynar-fetched address
    vi.mocked(getStaging)
      .mockReset()
      .mockResolvedValueOnce({
        tokenId: 100,
        status: 'pinata_uploaded',
        version: 2,
        orchestrator: 'manual-send',
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
          address: '0xwinner', // Address from Neynar fallback
        },
        imageHash: 'img',
        metadataHash: 'meta',
        tokenURI: 'ipfs://uri',
        attributes: [],
      })
      .mockResolvedValue({
        tokenId: 100,
        status: 'completed',
        version: 4,
        orchestrator: 'manual-send',
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
          address: '0xwinner', // Address from Neynar fallback
        },
        imageHash: 'img',
        metadataHash: 'meta',
        tokenURI: 'ipfs://uri',
        attributes: [],
        txHash: '0xtx',
        blockNumber: 12345,
      });

    const res = await orchestrateManualSend(123, 456);
    expect(res.status).toBe(200);
    expect(storeTokenDataWriteOnce).toHaveBeenCalledWith(
      expect.objectContaining({ holderAddress: '0xwinner' })
    );
  });
});
