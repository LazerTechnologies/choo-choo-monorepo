import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NEXT_PUBLIC_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

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
  REDIS_KEYS: {
    pendingNFT: (id: number) => `pending-nft:${id}`,
    token: (id: number) => `token:${id}`,
    lastMovedTimestamp: 'last-moved-timestamp',
    currentTokenId: 'current-token-id',
  },
}));

vi.mock('@/lib/staging-manager', () => ({
  __esModule: true,
  createStaging: vi.fn().mockResolvedValue(undefined),
  updateStaging: vi.fn().mockResolvedValue({
    tokenId: 400,
    status: 'pinata_uploaded',
    version: 2,
    orchestrator: 'manual-send',
    createdAt: new Date().toISOString(),
    retryCount: 0,
    newHolder: {
      fid: 420,
      username: 'winner',
      displayName: 'Winner',
      pfpUrl: 'https://example.com/winner.jpg',
      address: '0xwinner',
    },
    departingPassenger: {
      fid: 69,
      username: 'currentholder',
      displayName: 'Current Holder',
      pfpUrl: '',
      address: '0xholder',
    },
    imageHash: 'img',
    metadataHash: 'meta',
    tokenURI: 'ipfs://uri',
    attributes: [],
  }),
  getStaging: vi.fn().mockImplementation((tokenId: number) => {
    if (tokenId === 400) {
      return Promise.resolve({
        tokenId: 400,
        status: 'pinata_uploaded',
        version: 2,
        orchestrator: 'manual-send',
        createdAt: new Date().toISOString(),
        retryCount: 0,
        newHolder: {
          fid: 420,
          username: 'winner',
          displayName: 'Winner',
          pfpUrl: 'https://example.com/winner.jpg',
          address: '0xwinner',
        },
        departingPassenger: {
          fid: 69,
          username: 'currentholder',
          displayName: 'Current Holder',
          pfpUrl: '',
          address: '0xholder',
        },
        imageHash: 'img',
        metadataHash: 'meta',
        tokenURI: 'ipfs://uri',
        attributes: [],
      });
    }
    // For random-send test
    return Promise.resolve({
      tokenId: 400,
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
        pfpUrl: '',
        address: '0xholder',
      },
      sourceCastHash: '0xcast',
      totalEligibleReactors: 5,
      imageHash: 'img',
      metadataHash: 'meta',
      tokenURI: 'ipfs://uri',
      attributes: [],
    });
  }),
  promoteStaging: vi.fn().mockResolvedValue(undefined),
  isStagingStuck: vi.fn().mockReturnValue(false),
  abandonStaging: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/services/contract', () => ({
  __esModule: true,
  getContractService: vi.fn(() => ({
    getNextOnChainTicketId: vi.fn().mockResolvedValueOnce(400).mockResolvedValueOnce(401),
    getMintedTokenIdFromTx: vi.fn().mockResolvedValue(400),
    hasBeenPassenger: vi.fn().mockResolvedValue(false),
    getCurrentTrainHolder: vi.fn().mockResolvedValue('0xholder'),
  })),
}));

vi.mock('@/lib/services/neynar-score', () => ({
  __esModule: true,
  checkNeynarScore: vi.fn().mockResolvedValue({ meetsMinimum: true, score: 0.8 }),
  MIN_NEYNAR_SCORE: 0.5,
}));

import { createStaging, promoteStaging } from '@/lib/staging-manager';
import { orchestrateManualSend, orchestrateRandomSend } from '@/lib/train-orchestrator';

describe('Data Consistency', () => {
  const currentHolderFID = 69;
  const targetFID = 420;
  beforeAll(() => {
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset staging manager mocks
    vi.mocked(promoteStaging).mockResolvedValue(undefined);
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
            totalEligibleReactors: 5,
          }),
          { status: 200 }
        );
      }
      if (url.includes('api.neynar.com')) {
        return new Response(
          JSON.stringify({
            users: [
              {
                fid: targetFID,
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
              pfpUrl: '',
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
            actualTokenId: 400,
            txHash: '0xtx',
          }),
          {
            status: 200,
          }
        );
      }
      if (url.includes('/api/internal/send-cast')) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
        });
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

  it('should store departing passenger as NFT ticket holder (manual send)', async () => {
    await orchestrateManualSend(currentHolderFID, targetFID);
    // Verify staging was created with departing passenger data
    expect(createStaging).toHaveBeenCalledWith(
      400,
      expect.objectContaining({
        orchestrator: 'manual-send',
        departingPassenger: expect.objectContaining({
          username: 'currentholder',
        }),
      })
    );
    // Verify promotion was called (which stores the data)
    expect(promoteStaging).toHaveBeenCalled();
  });

  it('should preserve sourceCastHash and totalEligibleReactors in random send', async () => {
    await orchestrateRandomSend('0xcast');
    // Verify staging was created with sourceCastHash and totalEligibleReactors
    expect(createStaging).toHaveBeenCalledWith(
      400,
      expect.objectContaining({
        orchestrator: 'random-send',
        sourceCastHash: '0xcast',
        totalEligibleReactors: 5,
      })
    );
    // Verify promotion was called (which stores the data)
    expect(promoteStaging).toHaveBeenCalled();
  });
});
