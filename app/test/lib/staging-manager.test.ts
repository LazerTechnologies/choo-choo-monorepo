import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Redis before imports
vi.mock('@/lib/kv', () => ({
  __esModule: true,
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    exists: vi.fn(),
    del: vi.fn(),
    scan: vi.fn(),
    mget: vi.fn(),
    eval: vi.fn(),
  },
  redisPub: { publish: vi.fn() },
  CURRENT_HOLDER_KEY: 'current-holder',
}));

vi.mock('@/lib/redis-token-utils', () => ({
  __esModule: true,
  REDIS_KEYS: {
    token: (id: number) => `token:${id}`,
    lastMovedTimestamp: 'last-moved-timestamp',
    currentTokenId: 'current-token-id',
  },
}));

import { redis } from '@/lib/kv';
import {
  abandonStaging,
  createStaging,
  isStagingStuck,
  listStagingEntries,
  promoteStaging,
  updateStaging,
} from '@/lib/staging-manager';

describe('Staging Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createStaging', () => {
    it('should create staging entry atomically with NX flag', async () => {
      vi.mocked(redis.set).mockResolvedValue('OK');

      await createStaging(42, {
        orchestrator: 'yoink',
        newHolder: {
          fid: 1,
          username: 'alice',
          displayName: 'Alice',
          pfpUrl: '',
          address: '0xalice',
        },
        departingPassenger: {
          fid: 2,
          username: 'bob',
          displayName: 'Bob',
          pfpUrl: '',
          address: '0xbob',
        },
        totalEligibleReactors: 1,
      });

      // Should set with NX (only if not exists) and EX (TTL) for atomic creation
      expect(redis.set).toHaveBeenCalledWith(
        'staging:42',
        expect.any(String),
        'NX',
        'EX',
        expect.any(Number)
      );
    });

    it('should not overwrite existing staging entry', async () => {
      // When key exists, SET with NX returns null (not "OK")
      vi.mocked(redis.set).mockResolvedValue(null);

      await createStaging(42, {
        orchestrator: 'yoink',
        newHolder: {
          fid: 1,
          username: 'alice',
          displayName: 'Alice',
          pfpUrl: '',
          address: '0xalice',
        },
        departingPassenger: {
          fid: 2,
          username: 'bob',
          displayName: 'Bob',
          pfpUrl: '',
          address: '0xbob',
        },
        totalEligibleReactors: 1,
      });

      // Should still call set with NX, but it will return null
      expect(redis.set).toHaveBeenCalledWith(
        'staging:42',
        expect.any(String),
        'NX',
        'EX',
        expect.any(Number)
      );
    });
  });

  describe('updateStaging - Optimistic Locking', () => {
    it('should update staging with version increment using Lua script', async () => {
      const existingStaging = {
        tokenId: 42,
        orchestrator: 'yoink' as const,
        status: 'preparing' as const,
        newHolder: {
          fid: 1,
          username: 'alice',
          displayName: 'Alice',
          pfpUrl: '',
          address: '0xalice',
        },
        departingPassenger: {
          fid: 2,
          username: 'bob',
          displayName: 'Bob',
          pfpUrl: '',
          address: '0xbob',
        },
        totalEligibleReactors: 1,
        createdAt: new Date().toISOString(),
        version: 1,
      };

      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(existingStaging));
      vi.mocked(redis.eval).mockResolvedValue(1); // Success

      const result = await updateStaging(42, { status: 'pinata_uploaded' });

      expect(result).toBeTruthy();
      expect(result?.status).toBe('pinata_uploaded');
      expect(result?.version).toBe(2); // Version incremented

      // Should use Lua script for atomic compare-and-swap
      expect(redis.eval).toHaveBeenCalledWith(
        expect.stringContaining('local current = redis.call'),
        1,
        'staging:42',
        JSON.stringify(existingStaging),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should retry on concurrent modification (optimistic lock conflict)', async () => {
      const existingStaging = {
        tokenId: 42,
        orchestrator: 'yoink' as const,
        status: 'preparing' as const,
        newHolder: {
          fid: 1,
          username: 'alice',
          displayName: 'Alice',
          pfpUrl: '',
          address: '0xalice',
        },
        departingPassenger: {
          fid: 2,
          username: 'bob',
          displayName: 'Bob',
          pfpUrl: '',
          address: '0xbob',
        },
        totalEligibleReactors: 1,
        createdAt: new Date().toISOString(),
        version: 1,
      };

      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(existingStaging));
      vi.mocked(redis.eval)
        .mockResolvedValueOnce(0) // First attempt: conflict
        .mockResolvedValueOnce(1); // Second attempt: success

      const result = await updateStaging(42, { status: 'pinata_uploaded' });

      expect(result).toBeTruthy();
      expect(redis.eval).toHaveBeenCalledTimes(2); // Retried once
    });

    it('should return null after max retries on persistent conflicts', async () => {
      const existingStaging = {
        tokenId: 42,
        orchestrator: 'yoink' as const,
        status: 'preparing' as const,
        newHolder: {
          fid: 1,
          username: 'alice',
          displayName: 'Alice',
          pfpUrl: '',
          address: '0xalice',
        },
        departingPassenger: {
          fid: 2,
          username: 'bob',
          displayName: 'Bob',
          pfpUrl: '',
          address: '0xbob',
        },
        totalEligibleReactors: 1,
        createdAt: new Date().toISOString(),
        version: 1,
      };

      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(existingStaging));
      vi.mocked(redis.eval).mockResolvedValue(0); // Always conflict

      const result = await updateStaging(42, { status: 'pinata_uploaded' }, 3);

      expect(result).toBeNull();
      expect(redis.eval).toHaveBeenCalledTimes(3); // Max retries
    });
  });

  describe('promoteStaging - Atomic Lua Script', () => {
    it('should promote staging atomically using Lua script', async () => {
      const completedStaging = {
        tokenId: 42,
        orchestrator: 'yoink' as const,
        status: 'completed' as const,
        newHolder: {
          fid: 1,
          username: 'alice',
          displayName: 'Alice',
          pfpUrl: '',
          address: '0xalice',
        },
        departingPassenger: {
          fid: 2,
          username: 'bob',
          displayName: 'Bob',
          pfpUrl: '',
          address: '0xbob',
        },
        imageHash: 'Qmimage',
        metadataHash: 'Qmmeta',
        tokenURI: 'ipfs://Qmmeta' as `ipfs://${string}`,
        attributes: [],
        txHash: '0xtx',
        blockNumber: 12345,
        totalEligibleReactors: 1,
        createdAt: new Date().toISOString(),
        version: 3,
      };

      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(completedStaging));
      vi.mocked(redis.eval).mockResolvedValue('created'); // Lua script success

      await promoteStaging(42);

      // Should call Lua script with all required keys and args
      // Check that it's the actual script (contains key operations)
      expect(redis.eval).toHaveBeenCalledWith(
        expect.stringContaining('local token_key = KEYS[1]'),
        5, // 5 keys
        'token:42',
        'last-moved-timestamp',
        'current-holder',
        'staging:42',
        'current-token-id',
        expect.any(String), // token data JSON
        expect.any(String), // last moved data JSON
        expect.any(String), // current holder data JSON
        '42' // token ID
      );
    });

    it('should throw error if staging not found', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      await expect(promoteStaging(42)).rejects.toThrow('No staging entry found for token 42');
    });

    it('should throw error if staging not in completed status', async () => {
      const stagingInProgress = {
        tokenId: 42,
        orchestrator: 'yoink' as const,
        status: 'minted' as const,
        newHolder: {
          fid: 1,
          username: 'alice',
          displayName: 'Alice',
          pfpUrl: '',
          address: '0xalice',
        },
        departingPassenger: {
          fid: 2,
          username: 'bob',
          displayName: 'Bob',
          pfpUrl: '',
          address: '0xbob',
        },
        totalEligibleReactors: 1,
        createdAt: new Date().toISOString(),
        version: 2,
      };

      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(stagingInProgress));

      await expect(promoteStaging(42)).rejects.toThrow(
        'Cannot promote staging entry in status minted'
      );
    });
  });

  describe('listStagingEntries - SCAN Performance', () => {
    it('should use SCAN instead of KEYS for non-blocking iteration', async () => {
      vi.mocked(redis.scan)
        .mockResolvedValueOnce(['10', ['staging:42', 'staging:43']])
        .mockResolvedValueOnce(['0', ['staging:44']]); // cursor "0" = done

      vi.mocked(redis.mget).mockResolvedValue([
        JSON.stringify({
          tokenId: 42,
          orchestrator: 'yoink',
          status: 'preparing',
          newHolder: {
            fid: 1,
            username: 'alice',
            displayName: 'Alice',
            pfpUrl: '',
            address: '0xalice',
          },
          departingPassenger: {
            fid: 2,
            username: 'bob',
            displayName: 'Bob',
            pfpUrl: '',
            address: '0xbob',
          },
          totalEligibleReactors: 1,
          createdAt: new Date().toISOString(),
          version: 1,
        }),
        JSON.stringify({
          tokenId: 43,
          orchestrator: 'manual-send',
          status: 'pinata_uploaded',
          newHolder: {
            fid: 3,
            username: 'charlie',
            displayName: 'Charlie',
            pfpUrl: '',
            address: '0xcharlie',
          },
          departingPassenger: {
            fid: 4,
            username: 'dave',
            displayName: 'Dave',
            pfpUrl: '',
            address: '0xdave',
          },
          totalEligibleReactors: 1,
          createdAt: new Date().toISOString(),
          version: 1,
        }),
      ]);

      const entries = await listStagingEntries();

      expect(redis.scan).toHaveBeenCalledWith('0', 'MATCH', 'staging:*', 'COUNT', 100);
      expect(redis.mget).toHaveBeenCalled();
      expect(entries).toHaveLength(2);
    });

    it('should handle empty staging list', async () => {
      vi.mocked(redis.scan).mockResolvedValue(['0', []]);

      const entries = await listStagingEntries();

      expect(entries).toEqual([]);
      expect(redis.mget).not.toHaveBeenCalled();
    });
  });

  describe('isStagingStuck', () => {
    it('should detect stuck staging older than timeout', () => {
      const oldStaging = {
        tokenId: 42,
        orchestrator: 'yoink' as const,
        status: 'minted' as const,
        newHolder: {
          fid: 1,
          username: 'alice',
          displayName: 'Alice',
          pfpUrl: '',
          address: '0xalice',
        },
        departingPassenger: {
          fid: 2,
          username: 'bob',
          displayName: 'Bob',
          pfpUrl: '',
          address: '0xbob',
        },
        totalEligibleReactors: 1,
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 mins ago
        retryCount: 0,
        version: 2,
      };

      const isStuck = isStagingStuck(oldStaging, 10 * 60 * 1000); // 10 min timeout

      expect(isStuck).toBe(true);
    });

    it('should not flag completed staging as stuck', () => {
      const completedStaging = {
        tokenId: 42,
        orchestrator: 'yoink' as const,
        status: 'completed' as const,
        newHolder: {
          fid: 1,
          username: 'alice',
          displayName: 'Alice',
          pfpUrl: '',
          address: '0xalice',
        },
        departingPassenger: {
          fid: 2,
          username: 'bob',
          displayName: 'Bob',
          pfpUrl: '',
          address: '0xbob',
        },
        totalEligibleReactors: 1,
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 mins ago
        retryCount: 0,
        version: 3,
      };

      const isStuck = isStagingStuck(completedStaging, 10 * 60 * 1000);

      expect(isStuck).toBe(false);
    });

    it('should not flag recent staging as stuck', () => {
      const recentStaging = {
        tokenId: 42,
        orchestrator: 'yoink' as const,
        status: 'minted' as const,
        newHolder: {
          fid: 1,
          username: 'alice',
          displayName: 'Alice',
          pfpUrl: '',
          address: '0xalice',
        },
        departingPassenger: {
          fid: 2,
          username: 'bob',
          displayName: 'Bob',
          pfpUrl: '',
          address: '0xbob',
        },
        totalEligibleReactors: 1,
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
        retryCount: 0,
        version: 2,
      };

      const isStuck = isStagingStuck(recentStaging, 10 * 60 * 1000);

      expect(isStuck).toBe(false);
    });
  });

  describe('abandonStaging', () => {
    it('should mark staging as failed with reason', async () => {
      const existingStaging = {
        tokenId: 42,
        orchestrator: 'yoink' as const,
        status: 'minted' as const,
        newHolder: {
          fid: 1,
          username: 'alice',
          displayName: 'Alice',
          pfpUrl: '',
          address: '0xalice',
        },
        departingPassenger: {
          fid: 2,
          username: 'bob',
          displayName: 'Bob',
          pfpUrl: '',
          address: '0xbob',
        },
        totalEligibleReactors: 1,
        createdAt: new Date().toISOString(),
        version: 2,
      };

      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(existingStaging));
      vi.mocked(redis.eval).mockResolvedValue(1);

      await abandonStaging(42, 'Test timeout');

      expect(redis.eval).toHaveBeenCalled();
      const callArgs = vi.mocked(redis.eval).mock.calls[0];
      // redis.eval(script, numKeys, key, expected, newValue, ttl)
      // So newValue is at index 4 (after script, numKeys, key, expected)
      const newValueJson = callArgs[4] as string;
      const newValue = JSON.parse(newValueJson);

      // abandonStaging sets status to "failed", not "abandoned"
      expect(newValue.status).toBe('failed');
      expect(newValue.lastError).toContain('Test timeout');
    });
  });
});
