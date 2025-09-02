/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

process.env.NEXT_PUBLIC_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
process.env.NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || 'test-neynar-key';
let yoinkNextId = 300;

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

vi.mock('@/lib/services/contract', () => {
  const mockService = {
    isYoinkable: vi.fn().mockResolvedValue({ canYoink: true, reason: null }),
    hasRiddenTrain: vi.fn().mockResolvedValue(false),
    hasDepositedEnough: vi.fn().mockResolvedValue(true),
    getNextOnChainTicketId: vi.fn(() => Promise.resolve(yoinkNextId++)),
    executeYoink: vi.fn().mockResolvedValue('0xtx'),
  };
  return {
    __esModule: true,
    getContractService: vi.fn(() => mockService),
  };
});

import { acquireLock, releaseLock, storeTokenDataWriteOnce } from '@/lib/redis-token-utils';
import { getContractService } from '@/lib/services/contract';
import { orchestrateYoink } from '@/lib/train-orchestrator';

describe('orchestrateYoink', () => {
  beforeAll(() => {
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn();
    process.env.INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'test-secret';
  });

  beforeEach(() => {
    vi.clearAllMocks();
    yoinkNextId = 300;
    vi.mocked(global.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/api/current-holder')) {
        return new Response(
          JSON.stringify({
            hasCurrentHolder: true,
            currentHolder: {
              fid: 111,
              username: 'depart',
              displayName: 'Depart',
              pfpUrl: '',
              address: '0xdepart',
            },
          }),
          { status: 200 }
        );
      }
      if (url.includes('api.neynar.com')) {
        return new Response(
          JSON.stringify({
            users: [
              {
                fid: 999,
                username: 'yoinker',
                display_name: 'Yoinker',
                pfp_url: '',
                verified_addresses: {
                  primary: { eth_address: '0xyoinker' },
                  eth_addresses: ['0xyoinker'],
                },
              },
            ],
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
      if (url.includes('/api/internal/send-cast') || url.includes('/api/workflow-state')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should acquire and release distributed lock by userFid and targetAddress', async () => {
    const res = await orchestrateYoink(999, '0x1234567890123456789012345678901234567890');
    expect(res.status).toBe(200);
    expect(acquireLock).toHaveBeenCalledWith(
      'lock:yoink:999:0x1234567890123456789012345678901234567890',
      expect.any(Number)
    );
    expect(releaseLock).toHaveBeenCalledWith(
      'lock:yoink:999:0x1234567890123456789012345678901234567890'
    );
  });

  it('should validate contract checks and execute yoink', async () => {
    const cs = vi.mocked(getContractService)();
    const res = await orchestrateYoink(999, '0x1234567890123456789012345678901234567890');
    expect(cs.isYoinkable).toHaveBeenCalled();
    expect(cs.hasRiddenTrain).toHaveBeenCalled();
    expect(cs.hasDepositedEnough).toHaveBeenCalled();
    expect(cs.executeYoink).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890');
    expect(res.status).toBe(200);
  });

  it('should store token data with departing passenger as holder and update current-holder', async () => {
    const res = await orchestrateYoink(999, '0x1234567890123456789012345678901234567890');
    expect(res.status).toBe(200);
    expect(storeTokenDataWriteOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        holderUsername: 'depart',
        holderAddress: '0xdepart',
      })
    );
  });

  it('should return 500 when tokenId mismatch occurs', async () => {
    const mockedService = {
      getNextOnChainTicketId: vi.fn().mockResolvedValueOnce(300).mockResolvedValueOnce(305),
      isYoinkable: vi.fn().mockResolvedValue({ canYoink: true, reason: null }),
      hasRiddenTrain: vi.fn().mockResolvedValue(false),
      hasDepositedEnough: vi.fn().mockResolvedValue(true),
      executeYoink: vi.fn().mockResolvedValue('0xtx'),
    } as {
      getNextOnChainTicketId: () => Promise<number>;
      isYoinkable: () => Promise<{ canYoink: boolean; reason: string | null }>;
      hasRiddenTrain: (addr: `0x${string}`) => Promise<boolean>;
      hasDepositedEnough: (fid: number) => Promise<boolean>;
      executeYoink: (addr: `0x${string}`) => Promise<string>;
    };
    vi.mocked(getContractService).mockReturnValueOnce(mockedService as any);
    const res = await orchestrateYoink(999, '0x1234567890123456789012345678901234567890');
    expect(res.status).toBe(500);
  });
});
