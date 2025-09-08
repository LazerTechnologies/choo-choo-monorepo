import { vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { TokenData, PendingNFT } from '@/types/nft';
import type { WorkflowData } from '@/lib/workflow-types';
import { WorkflowState } from '@/lib/workflow-types';

// Redis Mock Helpers
export function createMockRedis() {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    publish: vi.fn(),
  };

  // Default successful responses
  mockRedis.get.mockResolvedValue(null);
  mockRedis.set.mockResolvedValue('OK');
  mockRedis.del.mockResolvedValue(1);
  mockRedis.exists.mockResolvedValue(0);
  mockRedis.publish.mockResolvedValue(1);

  return mockRedis;
}

export function mockRedisLockSuccess(mockRedis: ReturnType<typeof createMockRedis>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockRedis.set.mockImplementation((key: string, value: string, options?: any) => {
    if (key.startsWith('lock:') && options?.NX) {
      return Promise.resolve('OK'); // Lock acquired
    }
    return Promise.resolve('OK');
  });
}

export function mockRedisLockFailure(mockRedis: ReturnType<typeof createMockRedis>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockRedis.set.mockImplementation((key: string, value: string, options?: any) => {
    if (key.startsWith('lock:') && options?.NX) {
      return Promise.resolve(null); // Lock not acquired
    }
    return Promise.resolve('OK');
  });
}

export function mockPendingNFTCache(
  mockRedis: ReturnType<typeof createMockRedis>,
  tokenId: number,
  data?: PendingNFT
) {
  const pendingData = data || {
    imageHash: 'mock-image-hash',
    metadataHash: 'mock-metadata-hash',
    tokenURI: 'ipfs://mock-token-uri',
    attributes: [{ trait_type: 'Passenger', value: 'mock-user' }],
    passengerUsername: 'mock-user',
  };

  mockRedis.get.mockImplementation((key: string) => {
    if (key === `pending-nft:${tokenId}`) {
      return Promise.resolve(JSON.stringify(pendingData));
    }
    return Promise.resolve(null);
  });

  return pendingData;
}

// Contract Service Mock Helpers
export function createMockContract() {
  return {
    getNextOnChainTicketId: vi.fn().mockResolvedValue(1),
    executeNextStop: vi.fn().mockResolvedValue('0x123'),
    executeYoink: vi.fn().mockResolvedValue('0x456'),
    isYoinkable: vi.fn().mockResolvedValue({ canYoink: true, reason: null }),
    hasBeenPassenger: vi.fn().mockResolvedValue(false),
    hasDepositedEnough: vi.fn().mockResolvedValue(true),
    getFidDeposited: vi.fn().mockResolvedValue(BigInt(1000000)), // 1 USDC
    getDepositCost: vi.fn().mockResolvedValue(BigInt(1000000)), // 1 USDC
    getTotalTickets: vi.fn().mockResolvedValue(1),
  };
}

export function mockContractTokenIdSequence(
  mockContract: ReturnType<typeof createMockContract>,
  startId: number
) {
  let currentId = startId;
  mockContract.getNextOnChainTicketId.mockImplementation(() => {
    const id = currentId;
    currentId++; // Simulate minting incrementing the ID
    return Promise.resolve(id);
  });
}

// Neynar API Mock Helpers
export function createMockNeynar() {
  const mockFetch = vi.fn();

  // Mock successful user response
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('api.neynar.com/v2/farcaster/user/bulk')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            users: [
              {
                fid: 123,
                username: 'mockuser',
                display_name: 'Mock User',
                pfp_url: 'https://example.com/pfp.jpg',
                verified_addresses: {
                  primary: { eth_address: '0x1234567890123456789012345678901234567890' },
                  eth_addresses: ['0x1234567890123456789012345678901234567890'],
                },
              },
            ],
          }),
      });
    }
    return Promise.resolve({ ok: false });
  });

  return mockFetch;
}

export function mockNeynarUser(fid: number, username: string, address?: string) {
  return {
    fid,
    username,
    display_name: `${username} Display`,
    pfp_url: `https://example.com/${username}.jpg`,
    verified_addresses: {
      primary: { eth_address: address || `0x${fid.toString().padStart(40, '0')}` },
      eth_addresses: [address || `0x${fid.toString().padStart(40, '0')}`],
    },
  };
}

// Internal API Mock Helpers
export function createMockInternalAPI() {
  const mockFetch = vi.fn();

  // Mock generate-nft response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  mockFetch.mockImplementation((url: string, _options?: any) => {
    if (url.includes('/api/internal/generate-nft')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            imageHash: 'mock-image-hash',
            metadataHash: 'mock-metadata-hash',
            tokenURI: 'ipfs://mock-token-uri',
            metadata: {
              attributes: [{ trait_type: 'Passenger', value: 'mock-user' }],
            },
          }),
      });
    }

    // Mock mint-token response
    if (url.includes('/api/internal/mint-token')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            txHash: '0x123',
            actualTokenId: 1,
          }),
      });
    }

    // Mock send-cast response
    if (url.includes('/api/internal/send-cast')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            cast: { hash: '0xcast123' },
          }),
      });
    }

    // Mock current-holder response
    if (url.includes('/api/current-holder')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            hasCurrentHolder: true,
            currentHolder: {
              fid: 123,
              username: 'currentholder',
              displayName: 'Current Holder',
              pfpUrl: 'https://example.com/holder.jpg',
              address: '0x1234567890123456789012345678901234567890',
            },
          }),
      });
    }

    // Mock select-winner response
    if (url.includes('/api/internal/select-winner')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            winner: {
              fid: 456,
              username: 'winner',
              displayName: 'Winner User',
              pfpUrl: 'https://example.com/winner.jpg',
              address: '0x4567890123456789012345678901234567890123',
            },
            totalEligibleReactors: 10,
          }),
      });
    }

    // Mock workflow-state response
    if (url.includes('/api/workflow-state')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    }

    return Promise.resolve({ ok: false });
  });

  return mockFetch;
}

// Request Mock Helpers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockRequest(body: any, headers: Record<string, string> = {}): NextRequest {
  const request = new NextRequest('http://localhost:3000/api/test', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  return request;
}

// Orchestrator Mock Helpers
export function createMockOrchestrators() {
  return {
    orchestrateManualSend: vi.fn().mockResolvedValue({
      status: 200,
      body: {
        success: true,
        tokenId: 1,
        txHash: '0x123',
        tokenURI: 'ipfs://mock-uri',
      },
    }),
    orchestrateRandomSend: vi.fn().mockResolvedValue({
      status: 200,
      body: {
        success: true,
        tokenId: 1,
        txHash: '0x123',
        tokenURI: 'ipfs://mock-uri',
        winner: { username: 'winner' },
        totalEligibleReactors: 10,
      },
    }),
    orchestrateYoink: vi.fn().mockResolvedValue({
      status: 200,
      body: {
        success: true,
        tokenId: 1,
        txHash: '0x123',
        tokenURI: 'ipfs://mock-uri',
        yoinkedBy: 'yoinker',
      },
    }),
  };
}

// Workflow State Mock Helpers
export function createMockWorkflowState(
  state: WorkflowState = WorkflowState.NOT_CASTED
): WorkflowData {
  return {
    state,
    winnerSelectionStart: null,
    currentCastHash: null,
  };
}

// User Mock Helpers
export function createMockUser(fid: number = 123, username: string = 'testuser') {
  return {
    fid,
    username,
    displayName: `${username} Display`,
    pfpUrl: `https://example.com/${username}.jpg`,
  };
}

// Component Test Providers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function MockProviders({ children }: { children: any }) {
  // This would wrap components with necessary providers (Wagmi, etc.)
  // Implementation depends on your provider setup
  return children; // Simple passthrough for now
}

// Token Data Mock Helpers
export function createMockTokenData(tokenId: number = 1): TokenData {
  return {
    tokenId,
    imageHash: 'mock-image-hash',
    metadataHash: 'mock-metadata-hash',
    tokenURI: 'ipfs://mock-token-uri',
    holderAddress: '0x1234567890123456789012345678901234567890',
    holderUsername: 'mock-holder',
    holderFid: 123,
    holderDisplayName: 'Mock Holder',
    holderPfpUrl: 'https://example.com/holder.jpg',
    transactionHash: '0x123',
    timestamp: new Date().toISOString(),
    attributes: [{ trait_type: 'Passenger', value: 'mock-holder' }],
    sourceType: 'manual',
    sourceCastHash: undefined,
    totalEligibleReactors: 1,
  };
}

// Environment Mock Helpers
export function mockEnvironmentVariables() {
  const originalEnv = process.env;

  process.env = {
    ...originalEnv,
    INTERNAL_SECRET: 'test-secret',
    NEYNAR_API_KEY: 'test-neynar-key',
    NEXT_PUBLIC_PINATA_GATEWAY: 'gateway.pinata.cloud',
  };

  return () => {
    process.env = originalEnv;
  };
}

// Async Helper for Testing Concurrent Operations
export function createConcurrentPromises<T>(fn: () => Promise<T>, count: number = 2): Promise<T>[] {
  return Array.from({ length: count }, () => fn());
}

// Time Mock Helpers
export function mockTimers() {
  vi.useFakeTimers();
  return () => vi.useRealTimers();
}

export function advanceTimersByMs(ms: number) {
  vi.advanceTimersByTime(ms);
}
