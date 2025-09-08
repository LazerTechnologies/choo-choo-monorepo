import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

process.env.NEXT_PUBLIC_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

vi.mock('@/lib/kv', () => ({
  __esModule: true,
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  redisPub: { publish: vi.fn() },
  CURRENT_HOLDER_CHANNEL: 'current-holder',
}));

vi.mock('@/lib/kv', () => ({
  __esModule: true,
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn(), exists: vi.fn() },
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
    getNextOnChainTicketId: vi.fn().mockResolvedValueOnce(500).mockResolvedValueOnce(501),
    executeYoink: vi.fn().mockResolvedValue('0xtx'),
    getMintedTokenIdFromTx: vi.fn().mockResolvedValue(500),
  })),
}));

import { acquireLock } from '@/lib/redis-token-utils';
import { orchestrateRandomSend, orchestrateYoink } from '@/lib/train-orchestrator';

describe('Concurrent Protection', () => {
  beforeAll(() => {
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(
      global.fetch as unknown as (input: RequestInfo | URL) => Promise<Response>
    ).mockImplementation(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/api/internal/select-winner')) {
        return new Response(
          JSON.stringify({
            success: true,
            winner: {
              fid: 456,
              username: 'winner',
              displayName: 'Winner',
              pfpUrl: '',
              address: '0xwinner',
            },
            totalEligibleReactors: 3,
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
        return new Response(JSON.stringify({ success: true, actualTokenId: 500, txHash: '0xtx' }), {
          status: 200,
        });
      }
      if (url.includes('/api/internal/send-cast')) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      if (url.includes('/api/workflow-state')) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should allow first request and block second with 409 (random send lock)', async () => {
    // First acquire succeeds, second fails
    vi.mocked(acquireLock).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const first = await orchestrateRandomSend('0xcast');
    const second = await orchestrateRandomSend('0xcast');
    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
  });

  it('should prevent double minting with mint locks in yoink', async () => {
    // Simulate mint lock failure by throwing when acquire mint lock is attempted
    // We patch acquireLock to fail on the mint lock path by sequence: main lock ok, mint lock fail
    vi.mocked(acquireLock)
      .mockResolvedValueOnce(true) // yoink main lock
      .mockResolvedValueOnce(false); // mint lock

    const res = await orchestrateYoink(999, '0x1234567890123456789012345678901234567890');
    expect(res.status).toBe(500);
  });
});
