import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

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
  storeTokenDataWriteOnce: vi.fn().mockResolvedValue('created'),
  storeLastMovedTimestamp: vi.fn().mockResolvedValue(undefined),
  REDIS_KEYS: { pendingNFT: (id: number) => `pending-nft:${id}` },
}));

vi.mock('@/lib/services/contract', () => ({
  __esModule: true,
  getContractService: vi.fn(() => ({
    getNextOnChainTicketId: vi.fn().mockResolvedValueOnce(400).mockResolvedValueOnce(401),
  })),
}));

import { storeTokenDataWriteOnce } from '@/lib/redis-token-utils';
import { orchestrateRandomSend, orchestrateManualSend } from '@/lib/train-orchestrator';

describe('Data Consistency', () => {
  const currentHolderFID = 69;
  const targetFID = 420;
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
        return new Response(JSON.stringify({ success: true, actualTokenId: 400, txHash: '0xtx' }), {
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
    expect(storeTokenDataWriteOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        holderUsername: 'currentholder',
        sourceType: 'manual',
      })
    );
  });

  it('should preserve sourceCastHash and totalEligibleReactors in random send', async () => {
    await orchestrateRandomSend('0xcast');
    expect(storeTokenDataWriteOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceCastHash: '0xcast',
        totalEligibleReactors: 5,
        sourceType: 'send-train',
      })
    );
  });
});
