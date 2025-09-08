/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

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
  })),
}));

import { acquireLock, releaseLock, storeTokenDataWriteOnce } from '@/lib/redis-token-utils';
import { getContractService } from '@/lib/services/contract';
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
        return new Response(JSON.stringify({ success: true, actualTokenId: 100, txHash: '0xtx' }), {
          status: 200,
        });
      }
      if (url.includes('/api/internal/send-cast')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url.includes('/api/workflow-state')) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
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
    vi.mocked(global.fetch).mockImplementationOnce(
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
    );
    const res = await orchestrateManualSend(123, 456);
    expect(res.status).toBe(200);
    expect(storeTokenDataWriteOnce).toHaveBeenCalledWith(
      expect.objectContaining({ holderAddress: '0xwinner' })
    );
  });

  it('should validate tokenId consistency after minting and return 500 on mismatch', async () => {
    const mockedService = {
      getNextOnChainTicketId: vi.fn().mockResolvedValueOnce(100).mockResolvedValueOnce(103),
    } as { getNextOnChainTicketId: () => Promise<number> };
    vi.mocked(getContractService).mockReturnValueOnce(mockedService as any);
    const res = await orchestrateManualSend(123, 456);
    expect(res.status).toBe(500);
  });
});
