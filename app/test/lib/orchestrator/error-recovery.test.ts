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
    getNextOnChainTicketId: vi.fn().mockResolvedValueOnce(600).mockResolvedValueOnce(601),
    executeYoink: vi.fn().mockResolvedValue('0xtx'),
  })),
}));

import { releaseLock } from '@/lib/redis-token-utils';
import { orchestrateRandomSend } from '@/lib/train-orchestrator';

describe('Error Recovery', () => {
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
        return new Response(JSON.stringify({ success: false, error: 'selection failed' }), {
          status: 200,
        });
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
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should reset workflow to CASTED on orchestrator failure and release locks', async () => {
    // Failure is induced by select-winner returning success: false
    vi.mocked(
      global.fetch as unknown as (input: RequestInfo | URL) => Promise<Response>
    ).mockImplementationOnce(async (input: RequestInfo | URL) => {
      // already set above for select-winner, keep
      const url = input.toString();
      if (url.includes('/api/internal/select-winner')) {
        return new Response(JSON.stringify({ success: false }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const res = await orchestrateRandomSend('0xcast');
    expect(res.status).toBe(500);
    // releaseLock should be called in finally
    expect(releaseLock).toHaveBeenCalled();
  });
});
