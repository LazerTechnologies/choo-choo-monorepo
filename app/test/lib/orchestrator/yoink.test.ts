/* eslint-disable @typescript-eslint/no-explicit-any */
/** biome-ignore-all lint/style/noNonNullAssertion: fine in tests */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

const mockContractService = {
  isYoinkable: vi.fn().mockResolvedValue({ canYoink: true, reason: null }),
  hasBeenPassenger: vi.fn().mockResolvedValue(false),
  hasDepositedEnough: vi.fn().mockResolvedValue(true),
  getNextOnChainTicketId: vi.fn(() => Promise.resolve(yoinkNextId++)),
  executeYoink: vi.fn().mockResolvedValue('0xtx'),
  getMintedTokenIdFromTx: vi.fn().mockResolvedValue(300),
  setTicketData: vi.fn().mockResolvedValue(undefined),
  getCurrentTrainHolder: vi.fn().mockResolvedValue('0xholder'),
};

vi.mock('@/lib/services/contract', () => ({
  __esModule: true,
  getContractService: vi.fn(() => mockContractService),
}));

vi.mock('@/lib/staging-manager', () => ({
  __esModule: true,
  createStaging: vi.fn().mockResolvedValue(undefined),
  updateStaging: vi.fn().mockResolvedValue({
    tokenId: 300,
    status: 'pinata_uploaded',
    version: 2,
    orchestrator: 'yoink',
    createdAt: new Date().toISOString(),
    retryCount: 0,
    newHolder: {
      fid: 999,
      username: 'yoinker',
      displayName: 'Yoinker',
      pfpUrl: '',
      address: '0x1234567890123456789012345678901234567890',
    },
    departingPassenger: {
      fid: 111,
      username: 'depart',
      displayName: 'Depart',
      pfpUrl: '',
      address: '0xdepart',
    },
    imageHash: 'img',
    metadataHash: 'meta',
    tokenURI: 'ipfs://uri',
    attributes: [],
  }),
  getStaging: vi
    .fn()
    .mockResolvedValueOnce({
      tokenId: 300,
      status: 'pinata_uploaded',
      version: 2,
      orchestrator: 'yoink',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      newHolder: {
        fid: 999,
        username: 'yoinker',
        displayName: 'Yoinker',
        pfpUrl: '',
        address: '0x1234567890123456789012345678901234567890',
      },
      departingPassenger: {
        fid: 111,
        username: 'depart',
        displayName: 'Depart',
        pfpUrl: '',
        address: '0xdepart',
      },
      imageHash: 'img',
      metadataHash: 'meta',
      tokenURI: 'ipfs://uri',
      attributes: [],
    })
    .mockResolvedValue({
      tokenId: 300,
      status: 'completed',
      version: 4,
      orchestrator: 'yoink',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      newHolder: {
        fid: 999,
        username: 'yoinker',
        displayName: 'Yoinker',
        pfpUrl: '',
        address: '0x1234567890123456789012345678901234567890',
      },
      departingPassenger: {
        fid: 111,
        username: 'depart',
        displayName: 'Depart',
        pfpUrl: '',
        address: '0xdepart',
      },
      imageHash: 'img',
      metadataHash: 'meta',
      tokenURI: 'ipfs://uri',
      attributes: [],
      txHash: '0xtx',
      blockNumber: 12345,
    }),
  promoteStaging: vi.fn().mockImplementation(async (tokenId: number) => {
    const staging = await getStaging(tokenId);
    if (staging && staging.status === 'completed' && staging.txHash) {
      await storeTokenDataWriteOnce({
        tokenId: staging.tokenId,
        imageHash: staging.imageHash!,
        metadataHash: staging.metadataHash!,
        tokenURI: staging.tokenURI!,
        holderAddress: staging.departingPassenger.address,
        holderUsername: staging.departingPassenger.username,
        holderFid: staging.departingPassenger.fid,
        holderDisplayName: staging.departingPassenger.displayName,
        holderPfpUrl: staging.departingPassenger.pfpUrl,
        transactionHash: staging.txHash,
        timestamp: new Date().toISOString(),
        blockNumber: staging.blockNumber,
        attributes: staging.attributes,
        sourceType: 'yoink',
        sourceCastHash: staging.sourceCastHash,
        totalEligibleReactors: staging.totalEligibleReactors,
      });
    }
  }),
  isStagingStuck: vi.fn().mockReturnValue(false),
  abandonStaging: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/services/neynar-score', () => ({
  __esModule: true,
  checkNeynarScore: vi.fn().mockResolvedValue({ meetsMinimum: true, score: 0.8 }),
  MIN_NEYNAR_SCORE: 0.5,
}));

import { acquireLock, releaseLock, storeTokenDataWriteOnce } from '@/lib/redis-token-utils';
import { getStaging, updateStaging } from '@/lib/staging-manager';
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
    // Reset getStaging mock to ensure correct sequence
    vi.mocked(getStaging)
      .mockReset()
      .mockResolvedValueOnce({
        tokenId: 300,
        status: 'pinata_uploaded',
        version: 2,
        orchestrator: 'yoink',
        createdAt: new Date().toISOString(),
        retryCount: 0,
        newHolder: {
          fid: 999,
          username: 'yoinker',
          displayName: 'Yoinker',
          pfpUrl: '',
          address: '0x1234567890123456789012345678901234567890',
        },
        departingPassenger: {
          fid: 111,
          username: 'depart',
          displayName: 'Depart',
          pfpUrl: '',
          address: '0xdepart',
        },
        imageHash: 'img',
        metadataHash: 'meta',
        tokenURI: 'ipfs://uri',
        attributes: [],
      })
      .mockResolvedValue({
        tokenId: 300,
        status: 'completed',
        version: 4,
        orchestrator: 'yoink',
        createdAt: new Date().toISOString(),
        retryCount: 0,
        newHolder: {
          fid: 999,
          username: 'yoinker',
          displayName: 'Yoinker',
          pfpUrl: '',
          address: '0x1234567890123456789012345678901234567890',
        },
        departingPassenger: {
          fid: 111,
          username: 'depart',
          displayName: 'Depart',
          pfpUrl: '',
          address: '0xdepart',
        },
        imageHash: 'img',
        metadataHash: 'meta',
        tokenURI: 'ipfs://uri',
        attributes: [],
        txHash: '0xtx',
        blockNumber: 12345,
      });

    // Reset updateStaging to return the correct sequence
    vi.mocked(updateStaging)
      .mockReset()
      .mockResolvedValueOnce({
        tokenId: 300,
        status: 'minted',
        version: 3,
        orchestrator: 'yoink',
        createdAt: new Date().toISOString(),
        retryCount: 0,
        newHolder: {
          fid: 999,
          username: 'yoinker',
          displayName: 'Yoinker',
          pfpUrl: '',
          address: '0x1234567890123456789012345678901234567890',
        },
        departingPassenger: {
          fid: 111,
          username: 'depart',
          displayName: 'Depart',
          pfpUrl: '',
          address: '0xdepart',
        },
        imageHash: 'img',
        metadataHash: 'meta',
        tokenURI: 'ipfs://uri',
        attributes: [],
        txHash: '0xtx',
        blockNumber: 12345,
      })
      .mockResolvedValueOnce({
        tokenId: 300,
        status: 'metadata_set',
        version: 4,
        orchestrator: 'yoink',
        createdAt: new Date().toISOString(),
        retryCount: 0,
        newHolder: {
          fid: 999,
          username: 'yoinker',
          displayName: 'Yoinker',
          pfpUrl: '',
          address: '0x1234567890123456789012345678901234567890',
        },
        departingPassenger: {
          fid: 111,
          username: 'depart',
          displayName: 'Depart',
          pfpUrl: '',
          address: '0xdepart',
        },
        imageHash: 'img',
        metadataHash: 'meta',
        tokenURI: 'ipfs://uri',
        attributes: [],
        txHash: '0xtx',
        blockNumber: 12345,
      })
      .mockResolvedValueOnce({
        tokenId: 300,
        status: 'completed',
        version: 5,
        orchestrator: 'yoink',
        createdAt: new Date().toISOString(),
        retryCount: 0,
        newHolder: {
          fid: 999,
          username: 'yoinker',
          displayName: 'Yoinker',
          pfpUrl: '',
          address: '0x1234567890123456789012345678901234567890',
        },
        departingPassenger: {
          fid: 111,
          username: 'depart',
          displayName: 'Depart',
          pfpUrl: '',
          address: '0xdepart',
        },
        imageHash: 'img',
        metadataHash: 'meta',
        tokenURI: 'ipfs://uri',
        attributes: [],
        txHash: '0xtx',
        blockNumber: 12345,
      });

    // Clear any previous calls
    vi.mocked(mockContractService.executeYoink).mockClear();

    const res = await orchestrateYoink(999, '0x1234567890123456789012345678901234567890');
    expect(res.status).toBe(200);
    expect(mockContractService.isYoinkable).toHaveBeenCalled();
    expect(mockContractService.hasBeenPassenger).toHaveBeenCalled();
    expect(mockContractService.hasDepositedEnough).toHaveBeenCalled();
    expect(mockContractService.executeYoink).toHaveBeenCalledWith(
      '0x1234567890123456789012345678901234567890'
    );
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
});
