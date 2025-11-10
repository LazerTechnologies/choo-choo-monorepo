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
    setTicketData: vi.fn().mockRejectedValue(new Error('Metadata setting failed')),
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
const mockUpdateStaging = vi.fn();
const mockPromoteStaging = vi.fn();

vi.mock('@/lib/staging-manager', () => ({
  __esModule: true,
  getStaging: () => mockGetStaging(),
  updateStaging: () => mockUpdateStaging(),
  promoteStaging: (tokenId: number) => mockPromoteStaging(tokenId),
  isStagingStuck: vi.fn().mockReturnValue(false),
  abandonStaging: vi.fn().mockResolvedValue(undefined),
}));

import { redis } from '@/lib/kv';
import { getContractService } from '@/lib/services/contract';
import { executeTrainMovement } from '@/lib/train-orchestrator';

describe('Metadata Retry Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStaging.mockClear();
    mockUpdateStaging.mockClear();
    mockPromoteStaging.mockClear();
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should queue token for metadata retry when metadata operation fails', async () => {
    const staging = {
      tokenId: 42,
      orchestrator: 'yoink' as const,
      status: 'pinata_uploaded' as const,
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
      totalEligibleReactors: 1,
      createdAt: new Date().toISOString(),
      version: 1,
    };

    // Mock staging lifecycle - getStaging calls
    // Sequence: 1) executeTrainMovement initial, 2) promoteStaging calls getStaging, 3) executeTrainMovement final retry check
    mockGetStaging
      .mockResolvedValueOnce(staging) // Initial check (executeTrainMovement)
      .mockResolvedValueOnce({
        ...staging,
        status: 'completed',
        version: 4,
        needsMetadataRetry: true,
        txHash: '0xtx',
        blockNumber: 12345,
      }) // promoteStaging calls getStaging
      .mockResolvedValueOnce({
        ...staging,
        status: 'completed',
        version: 4,
        needsMetadataRetry: true,
        txHash: '0xtx',
        blockNumber: 12345,
      }); // Final staging check for retry queue (executeTrainMovement)

    // Mock promoteStaging to call getStaging (like the real implementation)
    mockPromoteStaging.mockImplementation(async (tokenId: number) => {
      await mockGetStaging(tokenId);
    });

    // Mock updateStaging calls
    mockUpdateStaging
      .mockResolvedValueOnce({
        ...staging,
        status: 'minted',
        version: 2,
        txHash: '0xtx',
        blockNumber: 12345,
      })
      .mockResolvedValueOnce({
        ...staging,
        status: 'metadata_set',
        version: 3,
        needsMetadataRetry: true,
        txHash: '0xtx',
        blockNumber: 12345,
      })
      .mockResolvedValueOnce({
        ...staging,
        status: 'completed',
        version: 4,
        needsMetadataRetry: true,
        txHash: '0xtx',
        blockNumber: 12345,
      });

    // Mock redis.get for existing retry data check
    vi.mocked(redis.get).mockResolvedValueOnce(null); // Not found

    vi.mocked(redis.exists).mockResolvedValue(0); // Not already queued
    vi.mocked(redis.set).mockResolvedValue('OK'); // For metadata retry queue
    vi.mocked(redis.sadd).mockResolvedValue(1); // For metadata retry set

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
      newHolder: staging.newHolder,
      departingPassenger: staging.departingPassenger,
      needsMetadataOnchain: true,
      metadataOperation: vi.fn().mockRejectedValue(new Error('Metadata setting failed')),
      contractOperation: vi.fn().mockResolvedValue({
        txHash: '0xtx',
        actualTokenId: 42,
        blockNumber: 12345,
      }),
    });

    // Should succeed despite metadata failure (pragmatic approach)
    expect(result.success).toBe(true);
    expect(result.txHash).toBe('0xtx');

    // Should queue for retry with individual key
    expect(redis.set).toHaveBeenCalledWith(
      'metadata-retry:42',
      expect.stringContaining('"tokenId":42'),
      'EX',
      7 * 24 * 60 * 60 // 7 days TTL
    );

    // Should add to set for deduplication
    expect(redis.sadd).toHaveBeenCalledWith('metadata-retry-set', '42');
  });

  it('should preserve firstFailedAt when updating existing retry entry', async () => {
    const staging = {
      tokenId: 42,
      orchestrator: 'yoink' as const,
      status: 'pinata_uploaded' as const,
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
      totalEligibleReactors: 1,
      createdAt: new Date().toISOString(),
      version: 1,
    };

    const existingRetryData = {
      tokenId: 42,
      tokenURI: 'ipfs://Qmmeta',
      imageHash: 'Qmimage',
      operation: 'yoink',
      firstFailedAt: '2025-01-01T10:00:00.000Z', // Original failure time
      lastUpdatedAt: '2025-01-01T11:00:00.000Z',
    };

    // Mock staging lifecycle - getStaging calls
    // Sequence: 1) executeTrainMovement initial, 2) promoteStaging calls getStaging, 3) executeTrainMovement final retry check
    mockGetStaging
      .mockResolvedValueOnce(staging) // Initial check (executeTrainMovement)
      .mockResolvedValueOnce({
        ...staging,
        status: 'completed',
        version: 4,
        needsMetadataRetry: true,
        txHash: '0xtx',
        blockNumber: 12345,
      }) // promoteStaging calls getStaging
      .mockResolvedValueOnce({
        ...staging,
        status: 'completed',
        version: 4,
        needsMetadataRetry: true,
        txHash: '0xtx',
        blockNumber: 12345,
      }); // Final staging check for retry queue (executeTrainMovement)

    // Mock promoteStaging to call getStaging (like the real implementation)
    mockPromoteStaging.mockImplementation(async (tokenId: number) => {
      await mockGetStaging(tokenId);
    });

    // Mock updateStaging calls
    mockUpdateStaging
      .mockResolvedValueOnce({
        ...staging,
        status: 'minted',
        version: 2,
        txHash: '0xtx',
        blockNumber: 12345,
      })
      .mockResolvedValueOnce({
        ...staging,
        status: 'metadata_set',
        version: 3,
        needsMetadataRetry: true,
        txHash: '0xtx',
        blockNumber: 12345,
      })
      .mockResolvedValueOnce({
        ...staging,
        status: 'completed',
        version: 4,
        needsMetadataRetry: true,
        txHash: '0xtx',
        blockNumber: 12345,
      });

    // Mock redis.get for existing retry data
    vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify(existingRetryData));

    vi.mocked(redis.exists).mockResolvedValue(1); // Already queued
    vi.mocked(redis.set).mockResolvedValue('OK'); // For metadata retry queue update

    const contractService = getContractService();
    await executeTrainMovement({
      operation: 'yoink',
      tokenId: 42,
      preparedNFT: {
        imageHash: 'Qmimage',
        metadataHash: 'Qmmeta',
        tokenURI: 'ipfs://Qmmeta',
        attributes: [],
      },
      contractService,
      newHolder: staging.newHolder,
      departingPassenger: staging.departingPassenger,
      needsMetadataOnchain: true,
      metadataOperation: vi.fn().mockRejectedValue(new Error('Metadata setting failed')),
      contractOperation: vi.fn().mockResolvedValue({
        txHash: '0xtx',
        actualTokenId: 42,
        blockNumber: 12345,
      }),
    });

    // Should update with preserved firstFailedAt
    const setCall = vi.mocked(redis.set).mock.calls.find((call) => call[0] === 'metadata-retry:42');
    expect(setCall).toBeDefined();

    const updatedData = JSON.parse(setCall?.[1] as string);
    expect(updatedData.firstFailedAt).toBe('2025-01-01T10:00:00.000Z'); // Preserved
    expect(updatedData.lastUpdatedAt).not.toBe('2025-01-01T11:00:00.000Z'); // Updated to current time
  });

  it('should not queue for retry if metadata succeeds', async () => {
    const staging = {
      tokenId: 42,
      orchestrator: 'yoink' as const,
      status: 'pinata_uploaded' as const,
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
      totalEligibleReactors: 1,
      createdAt: new Date().toISOString(),
      version: 1,
    };

    // Mock staging lifecycle - getStaging calls
    // Sequence: 1) executeTrainMovement initial, 2) promoteStaging calls getStaging, 3) executeTrainMovement final retry check
    mockGetStaging
      .mockResolvedValueOnce(staging) // Initial check (executeTrainMovement)
      .mockResolvedValueOnce({
        ...staging,
        status: 'completed',
        version: 4,
        txHash: '0xtx',
        blockNumber: 12345,
      }) // promoteStaging calls getStaging
      .mockResolvedValueOnce({
        ...staging,
        status: 'completed',
        version: 4,
        txHash: '0xtx',
        blockNumber: 12345,
      }); // Final staging check (no needsMetadataRetry)

    // Mock promoteStaging to call getStaging (like the real implementation)
    mockPromoteStaging.mockImplementation(async (tokenId: number) => {
      await mockGetStaging(tokenId);
    });

    // Mock updateStaging calls
    mockUpdateStaging
      .mockResolvedValueOnce({
        ...staging,
        status: 'minted',
        version: 2,
        txHash: '0xtx',
        blockNumber: 12345,
      })
      .mockResolvedValueOnce({
        ...staging,
        status: 'metadata_set',
        version: 3,
        txHash: '0xtx',
        blockNumber: 12345,
      })
      .mockResolvedValueOnce({
        ...staging,
        status: 'completed',
        version: 4,
        txHash: '0xtx',
        blockNumber: 12345,
      });

    const contractService = getContractService();
    // Override mock to succeed
    contractService.setTicketData = vi.fn().mockResolvedValue(undefined);

    await executeTrainMovement({
      operation: 'yoink',
      tokenId: 42,
      preparedNFT: {
        imageHash: 'Qmimage',
        metadataHash: 'Qmmeta',
        tokenURI: 'ipfs://Qmmeta',
        attributes: [],
      },
      contractService,
      newHolder: staging.newHolder,
      departingPassenger: staging.departingPassenger,
      needsMetadataOnchain: true,
      metadataOperation: vi.fn().mockResolvedValue(undefined),
      contractOperation: vi.fn().mockResolvedValue({
        txHash: '0xtx',
        actualTokenId: 42,
        blockNumber: 12345,
      }),
    });

    // Should NOT queue for retry
    expect(redis.sadd).not.toHaveBeenCalledWith('metadata-retry-set', '42');
  });
});
