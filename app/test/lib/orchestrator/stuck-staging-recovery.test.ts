import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NEXT_PUBLIC_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

// Mock Redis before imports
vi.mock('@/lib/kv', () => ({
  __esModule: true,
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    exists: vi.fn(),
    del: vi.fn(),
    eval: vi.fn(),
    sadd: vi.fn(),
  },
  redisPub: { publish: vi.fn() },
  CURRENT_HOLDER_KEY: 'current-holder',
}));

vi.mock('@/lib/redis-token-utils', () => ({
  __esModule: true,
  acquireLock: vi.fn().mockResolvedValue(true),
  releaseLock: vi.fn().mockResolvedValue(undefined),
  getOrSetPendingGeneration: vi.fn().mockResolvedValue({
    imageHash: 'Qmimage',
    metadataHash: 'Qmmeta',
    tokenURI: 'ipfs://Qmmeta',
    attributes: [],
    passengerUsername: 'bob',
  }),
  REDIS_KEYS: {
    pendingNFT: (id: number) => `pending-nft:${id}`,
    token: (id: number) => `token:${id}`,
    lastMovedTimestamp: 'last-moved-timestamp',
    currentTokenId: 'current-token-id',
  },
}));

vi.mock('@/lib/services/contract', () => ({
  __esModule: true,
  getContractService: vi.fn(() => ({
    getNextOnChainTicketId: vi.fn().mockResolvedValue(42),
    getCurrentTrainHolder: vi.fn().mockResolvedValue('0xholder'),
    hasBeenPassenger: vi.fn().mockResolvedValue(false),
    isYoinkable: vi.fn().mockResolvedValue({ canYoink: true }),
    hasDepositedEnough: vi.fn().mockResolvedValue(true),
    executeYoink: vi.fn().mockResolvedValue('0xtxhash'),
    getMintedTokenIdFromTx: vi.fn().mockResolvedValue(42),
    setTicketData: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@/lib/services/neynar-score', () => ({
  __esModule: true,
  checkNeynarScore: vi.fn().mockResolvedValue({ meetsMinimum: true, score: 0.8 }),
  MIN_NEYNAR_SCORE: 0.5,
}));

vi.mock('@/lib/notifications', () => ({
  __esModule: true,
  sendChooChooNotification: vi.fn().mockResolvedValue(undefined),
}));

const mockGetStaging = vi.fn();
const mockAbandonStaging = vi.fn();
const mockIsStagingStuck = vi.fn();
const mockUpdateStaging = vi.fn();
const mockPromoteStaging = vi.fn();

vi.mock('@/lib/staging-manager', () => ({
  __esModule: true,
  getStaging: (tokenId: number) => mockGetStaging(tokenId),
  abandonStaging: (tokenId: number, reason: string) => mockAbandonStaging(tokenId, reason),
  isStagingStuck: (staging: unknown, timeout: number) => mockIsStagingStuck(staging, timeout),
  updateStaging: (tokenId: number, updates: unknown) => mockUpdateStaging(tokenId, updates),
  promoteStaging: (tokenId: number) => mockPromoteStaging(tokenId),
}));

import { redis } from '@/lib/kv';
import { getContractService } from '@/lib/services/contract';
import { executeTrainMovement } from '@/lib/train-orchestrator';

describe('Stuck Staging Recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStaging.mockClear();
    mockAbandonStaging.mockClear();
    mockIsStagingStuck.mockClear();
    mockUpdateStaging.mockClear();
    mockPromoteStaging.mockClear();
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should abandon stuck staging and return error immediately', async () => {
    const stuckStaging = {
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
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 mins ago (stuck)
      version: 2,
    };

    mockGetStaging.mockResolvedValue(stuckStaging);
    mockIsStagingStuck.mockReturnValue(true); // Staging is stuck
    mockAbandonStaging.mockResolvedValue(undefined);

    const contractService = getContractService();
    const result = await executeTrainMovement({
      operation: 'yoink',
      tokenId: 42,
      preparedNFT: {
        imageHash: 'Qmimage',
        metadataHash: 'Qmmeta',
        tokenURI: 'ipfs://Qmmeta',
        attributes: [],
      },
      contractService,
      newHolder: stuckStaging.newHolder,
      departingPassenger: stuckStaging.departingPassenger,
      contractOperation: vi.fn().mockResolvedValue({
        txHash: '0xtx',
        actualTokenId: 42,
      }),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Staging timed out');
    // Should clean up pending NFT
    expect(redis.del).toHaveBeenCalledWith('pending-nft:42');
    // Should abandon staging
    expect(mockAbandonStaging).toHaveBeenCalledWith(42, 'Staging timed out - restarting');
  });

  it('should not flag completed staging as stuck', async () => {
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
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 mins ago but completed
      version: 3,
    };

    mockGetStaging.mockResolvedValue(completedStaging);
    mockPromoteStaging.mockResolvedValue(undefined);

    const contractService = getContractService();
    const result = await executeTrainMovement({
      operation: 'yoink',
      tokenId: 42,
      preparedNFT: {
        imageHash: 'Qmimage',
        metadataHash: 'Qmmeta',
        tokenURI: 'ipfs://Qmmeta',
        attributes: [],
      },
      contractService,
      newHolder: completedStaging.newHolder,
      departingPassenger: completedStaging.departingPassenger,
      contractOperation: vi.fn().mockResolvedValue({
        txHash: '0xtx',
        actualTokenId: 42,
      }),
    });

    // Should promote successfully, not abandon
    expect(result.success).toBe(true);
    expect(result.txHash).toBe('0xtx');
    expect(mockPromoteStaging).toHaveBeenCalledWith(42);
  });

  it('should return error if staging in wrong status', async () => {
    const wrongStatusStaging = {
      tokenId: 42,
      orchestrator: 'yoink' as const,
      status: 'preparing' as const, // Wrong status (expected: pinata_uploaded)
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

    mockGetStaging.mockResolvedValue(wrongStatusStaging);
    mockIsStagingStuck.mockReturnValue(false); // Not stuck, just wrong status

    const contractService = getContractService();
    const result = await executeTrainMovement({
      operation: 'yoink',
      tokenId: 42,
      preparedNFT: {
        imageHash: 'Qmimage',
        metadataHash: 'Qmmeta',
        tokenURI: 'ipfs://Qmmeta',
        attributes: [],
      },
      contractService,
      newHolder: wrongStatusStaging.newHolder,
      departingPassenger: wrongStatusStaging.departingPassenger,
      contractOperation: vi.fn().mockResolvedValue({
        txHash: '0xtx',
        actualTokenId: 42,
      }),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Train movement already in progress');
    expect(result.error).toContain('preparing');
  });
});
