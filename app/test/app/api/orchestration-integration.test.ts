/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

process.env.NEXT_PUBLIC_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
process.env.NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || 'test-neynar-key';
process.env.INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'test-internal-secret';
process.env.NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS =
  process.env.NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS || '0x0000000000000000000000000000000000000001';

vi.mock('@/lib/train-orchestrator', () => ({
  __esModule: true,
  orchestrateManualSend: vi.fn(),
  orchestrateRandomSend: vi.fn(),
  orchestrateYoink: vi.fn(),
}));

vi.mock('@/lib/kv', () => ({
  __esModule: true,
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
  redisPub: { publish: vi.fn() },
  CURRENT_HOLDER_CHANNEL: 'current-holder',
}));

vi.mock('@/lib/auth/require-admin', () => ({
  __esModule: true,
  requireAdmin: vi.fn(),
}));

// Mock the entire module
vi.mock('@/app/api/admin/send-train/route', async () => {
  const actual = await vi.importActual('@/app/api/admin/send-train/route');
  return {
    ...actual,
    __esModule: true,
    fetchUserByFid: vi.fn(),
  };
});

vi.mock('@/lib/services/contract', () => ({
  __esModule: true,
  getContractService: vi.fn(() => ({
    hasDepositedEnough: vi.fn(),
    getFidDeposited: vi.fn(),
    getDepositCost: vi.fn(),
  })),
}));

import {
  orchestrateManualSend,
  orchestrateRandomSend,
  orchestrateYoink,
} from '@/lib/train-orchestrator';
import { redis } from '@/lib/kv';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getContractService } from '@/lib/services/contract';

// Handlers under test (safe to import after mocks)
import { POST as userSendTrainPOST } from '@/app/api/user-send-train/route';
import { POST as adminSendTrainPOST } from '@/app/api/admin/send-train/route';
import { POST as sendTrainPOST } from '@/app/api/send-train/route';
import { POST as yoinkPOST } from '@/app/api/yoink/route';
import { fetchUserByFid } from '@/app/api/admin/send-train/route';

describe('API Route Integration', () => {
  beforeAll(() => {
    global.fetch = vi.fn();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset all orchestrator mocks to ensure clean state
    vi.mocked(orchestrateManualSend).mockReset();
    vi.mocked(orchestrateRandomSend).mockReset();
    vi.mocked(orchestrateYoink).mockReset();
    vi.mocked(requireAdmin).mockReset();

    // Default mocks
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
              pfpUrl: 'https://example.com/pfp.jpg',
              address: '0x1234567890123456789012345678901234567890',
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
                display_name: 'Winner User',
                pfp_url: 'https://example.com/winner.jpg',
                verified_addresses: {
                  primary: { eth_address: '0x4567890123456789012345678901234567890123' },
                  eth_addresses: ['0x4567890123456789012345678901234567890123'],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/api/internal/send-cast')) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // Default fallback for any other API calls
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('/api/user-send-train', () => {
    it('should call orchestrateManualSend with correct parameters', async () => {
      vi.mocked(redis.get).mockResolvedValue(
        JSON.stringify({ state: 'CASTED', winnerSelectionStart: null, currentCastHash: '0xabc' })
      );
      const contractMock = {
        hasDepositedEnough: vi.fn().mockResolvedValue(true),
        getFidDeposited: vi.fn(),
        getDepositCost: vi.fn(),
      } as any;
      vi.mocked(getContractService).mockReturnValue(contractMock);
      vi.mocked(orchestrateManualSend).mockResolvedValue({
        status: 200,
        body: { success: true, tokenId: 1, txHash: '0xhash', tokenURI: 'ipfs://uri' },
      } as any);

      const req = new Request('http://localhost/api/user-send-train', {
        method: 'POST',
        body: JSON.stringify({ targetFid: 456 }),
      });
      const res = await userSendTrainPOST(req);
      const json = await res.json();

      expect(orchestrateManualSend).toHaveBeenCalledWith(123, 456);
      expect(json.success).toBe(true);
      expect(json.tokenId).toBe(1);
      expect(json.txHash).toBe('0xhash');
      expect(json.tokenURI).toBe('ipfs://uri');
    });

    it('should handle 409 responses as in-progress', async () => {
      vi.mocked(redis.get).mockResolvedValue(
        JSON.stringify({ state: 'CASTED', winnerSelectionStart: null, currentCastHash: '0xabc' })
      );
      const contractMock = {
        hasDepositedEnough: vi.fn().mockResolvedValue(true),
        getFidDeposited: vi.fn(),
        getDepositCost: vi.fn(),
      } as any;
      vi.mocked(getContractService).mockReturnValue(contractMock);
      vi.mocked(orchestrateManualSend).mockResolvedValue({
        status: 409,
        body: { success: false },
      } as any);

      const req = new Request('http://localhost/api/user-send-train', {
        method: 'POST',
        body: JSON.stringify({ targetFid: 456 }),
      });
      const res = await userSendTrainPOST(req);

      expect(res.status).toBe(409);
    });

    it('should validate request body schema', async () => {
      const req = new Request('http://localhost/api/user-send-train', {
        method: 'POST',
        body: JSON.stringify({ targetFid: -5 }),
      });
      const res = await userSendTrainPOST(req);
      expect(res.status).toBe(400);
    });

    it('should require user authentication', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ hasCurrentHolder: false }), { status: 200 })
      );
      const req = new Request('http://localhost/api/user-send-train', {
        method: 'POST',
        body: JSON.stringify({ targetFid: 456 }),
      });
      const res = await userSendTrainPOST(req);
      expect(res.status).toBe(403);
    });

    it('should handle deposit requirements (402)', async () => {
      vi.mocked(redis.get).mockResolvedValue(
        JSON.stringify({ state: 'CASTED', winnerSelectionStart: null, currentCastHash: '0xabc' })
      );
      const contractMock = {
        hasDepositedEnough: vi.fn().mockResolvedValue(false),
        getFidDeposited: vi.fn().mockResolvedValue(BigInt(0)),
        getDepositCost: vi.fn().mockResolvedValue(BigInt(1_000_000)),
      } as any;
      vi.mocked(getContractService).mockReturnValue(contractMock);

      const req = new Request('http://localhost/api/user-send-train', {
        method: 'POST',
        body: JSON.stringify({ targetFid: 456 }),
      });
      const res = await userSendTrainPOST(req);
      expect(res.status).toBe(402);
      const json = await res.json();
      expect(json.depositStatus.satisfied).toBe(false);
    });
  });

  describe('/api/admin/send-train', () => {
    it('should require admin authentication', async () => {
      vi.mocked(requireAdmin).mockResolvedValue({
        ok: false,
        response: new Response('Unauthorized', { status: 401 }),
      } as any);
      const req = new Request('http://localhost/api/admin/send-train', {
        method: 'POST',
        body: JSON.stringify({ targetFid: 456 }),
      });
      const res = await adminSendTrainPOST(req);
      expect(res.status).toBe(401);
    });

    it.skip(
      'should call orchestrateManualSend with current holder FID',
      { timeout: 10000 },
      async () => {
        vi.mocked(requireAdmin).mockResolvedValue({ ok: true, adminFid: 1 } as any);

        // Mock the user fetch
        vi.mocked(fetchUserByFid).mockResolvedValue({
          address: '0x456',
          username: 'winner',
          fid: 456,
          displayName: 'Winner',
          pfpUrl: 'pfp',
        });

        vi.mocked(orchestrateManualSend).mockResolvedValue({
          status: 200,
          body: { success: true, tokenId: 2, txHash: '0xabc', tokenURI: 'ipfs://t' },
        } as any);

        const req = new Request('http://localhost/api/admin/send-train', {
          method: 'POST',
          body: JSON.stringify({ targetFid: 456 }),
        });

        const res = await adminSendTrainPOST(req);
        const json = await res.json();

        // Ensure all promises are resolved
        await vi.waitFor(() => {
          expect(orchestrateManualSend).toHaveBeenCalledWith(123, 456);
        });

        expect(json.success).toBe(true);
        expect(json.tokenId).toBe(2);
      }
    );

    it.skip('should handle orchestrator 409 responses', { timeout: 10000 }, async () => {
      // Ensure admin auth passes
      vi.mocked(requireAdmin).mockResolvedValue({ ok: true, adminFid: 1 } as any);

      // Mock the user fetch
      vi.mocked(fetchUserByFid).mockResolvedValue({
        address: '0x456',
        username: 'winner',
        fid: 456,
        displayName: 'Winner',
        pfpUrl: 'pfp',
      });

      // Mock orchestrateManualSend to return 409 conflict
      vi.mocked(orchestrateManualSend).mockResolvedValue({
        status: 409,
        body: { success: false, error: 'Manual send already in progress' },
      } as any);
      const req = new Request('http://localhost/api/admin/send-train', {
        method: 'POST',
        body: JSON.stringify({ targetFid: 456 }),
      });

      const res = await adminSendTrainPOST(req);

      // Ensure all promises are resolved
      await vi.waitFor(() => {
        expect(orchestrateManualSend).toHaveBeenCalled();
      });

      expect(res.status).toBe(409);
    });

    it('should validate admin request body', async () => {
      vi.mocked(requireAdmin).mockResolvedValue({ ok: true, adminFid: 1 } as any);
      const req = new Request('http://localhost/api/admin/send-train', {
        method: 'POST',
        body: JSON.stringify({ targetFid: -1 }),
      });
      const res = await adminSendTrainPOST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('/api/send-train', () => {
    it('should call orchestrateRandomSend with castHash from workflow state', async () => {
      vi.mocked(redis.get).mockResolvedValue(
        JSON.stringify({ state: 'CHANCE_EXPIRED', currentCastHash: '0xcast' })
      );
      vi.mocked(orchestrateRandomSend).mockResolvedValue({
        status: 200,
        body: {
          success: true,
          winner: { username: 'w' },
          tokenId: 3,
          txHash: '0x3',
          tokenURI: 'ipfs://3',
          totalEligibleReactors: 10,
        },
      } as any);

      const res = await sendTrainPOST();
      expect(orchestrateRandomSend).toHaveBeenCalledWith('0xcast');
      expect(res.status).toBe(200);
    });

    it('should handle missing workflow state', async () => {
      vi.mocked(redis.get).mockResolvedValue(null as any);
      const res = await sendTrainPOST();
      expect(res.status).toBe(400);
    });

    it('should handle missing castHash in workflow', async () => {
      vi.mocked(redis.get).mockResolvedValue(
        JSON.stringify({ state: 'CHANCE_EXPIRED', currentCastHash: null })
      );
      const res = await sendTrainPOST();
      expect(res.status).toBe(400);
    });

    it('should handle orchestrator 409 responses', async () => {
      vi.mocked(redis.get).mockResolvedValue(
        JSON.stringify({ state: 'CHANCE_EXPIRED', currentCastHash: '0xcast' })
      );
      vi.mocked(orchestrateRandomSend).mockResolvedValue({
        status: 409,
        body: { success: false },
      } as any);
      const res = await sendTrainPOST();
      expect(res.status).toBe(409);
    });
  });

  describe('/api/yoink', () => {
    it('should validate request body format and required fields', async () => {
      const badJson = new Request('http://localhost/api/yoink', {
        method: 'POST',
        body: 'not-json',
      });
      const r1 = await yoinkPOST(badJson as any);
      expect(r1.status).toBe(400);

      const missingFields = new Request('http://localhost/api/yoink', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const r2 = await yoinkPOST(missingFields as any);
      expect(r2.status).toBe(400);

      const invalidAddress = new Request('http://localhost/api/yoink', {
        method: 'POST',
        body: JSON.stringify({ targetAddress: 'not-an-address', userFid: 1 }),
      });
      const r3 = await yoinkPOST(invalidAddress as any);
      expect(r3.status).toBe(400);
    });

    it('should call orchestrateYoink with correct parameters and return success', async () => {
      vi.mocked(orchestrateYoink).mockResolvedValue({
        status: 200,
        body: { success: true, tokenId: 7, txHash: '0x7', tokenURI: 'ipfs://7', yoinkedBy: 'user' },
      } as any);
      const req = new Request('http://localhost/api/yoink', {
        method: 'POST',
        body: JSON.stringify({
          targetAddress: '0x1234567890123456789012345678901234567890',
          userFid: 999,
        }),
      });
      const res = await yoinkPOST(req as any);
      expect(orchestrateYoink).toHaveBeenCalledWith(
        999,
        '0x1234567890123456789012345678901234567890'
      );
      expect(res.status).toBe(200);
    });

    it('should handle orchestrator 409 responses', async () => {
      vi.mocked(orchestrateYoink).mockResolvedValue({
        status: 409,
        body: { success: false },
      } as any);
      const req = new Request('http://localhost/api/yoink', {
        method: 'POST',
        body: JSON.stringify({
          targetAddress: '0x1234567890123456789012345678901234567890',
          userFid: 999,
        }),
      });
      const res = await yoinkPOST(req as any);
      expect(res.status).toBe(409);
    });
  });
});
