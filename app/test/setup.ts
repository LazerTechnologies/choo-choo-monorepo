/* eslint-disable @typescript-eslint/no-explicit-any */
import { config } from 'dotenv';
config({ path: '.env.local' });
import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';
import { DEFAULT_WORKFLOW_DATA } from '@/lib/workflow-types';

// Provide React on global for JSX in some helpers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).React = React;

// Mock MarqueeToastProvider module globally
const marqueeToastFn = vi.fn();
vi.mock('@/providers/MarqueeToastProvider', () => {
  return {
    __esModule: true,
    MarqueeToastProvider: ({ children }: { children: React.ReactNode }) => children as any,
    useMarqueeToast: () => ({ toast: marqueeToastFn }),
  };
});

// Mock Neynar react hooks globally
vi.mock('@neynar/react', () => {
  return {
    __esModule: true,
    useMiniApp: vi.fn(() => ({
      context: {
        user: {
          fid: 123,
          username: 'currentholder',
          display_name: 'Current Holder',
          pfp_url: 'https://example.com/pfp.jpg',
        },
        client: {} as any,
      },
    })),
    useNeynarContext: vi.fn(() => ({
      user: {
        fid: 123,
        username: 'currentholder',
        display_name: 'Current Holder',
        pfp_url: 'https://example.com/pfp.jpg',
      },
      client_id: 'test',
      theme: 'light',
      setTheme: vi.fn(),
      isAuthenticated: true,
      client: {} as any,
      logout: vi.fn(),
    })),
    MiniAppProvider: ({ children }: { children: React.ReactNode }) => children as any,
  };
});

// Mock wagmi and axios globally (implementations will be set in tests)
vi.mock('wagmi', async (orig) => {
  return {
    __esModule: true,
    ...(await (orig() as Promise<Record<string, unknown>>)),
    useAccount: () => ({ isConnected: true }),
  } as any;
});

vi.mock('axios', () => {
  const axios = {
    get: vi.fn(),
    post: vi.fn(),
    create: () => axios,
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  } as any;
  return { __esModule: true, default: axios };
});

// Mock app hooks modules so components use mocked versions
vi.mock('@/hooks/useCurrentHolder', () => ({
  __esModule: true,
  useCurrentHolder: vi.fn(() => ({
    currentHolder: null,
    isCurrentHolder: false,
    loading: false,
    error: null,
  })),
}));

vi.mock('@/hooks/useWorkflowState', () => ({
  __esModule: true,
  useWorkflowState: vi.fn(() => ({
    workflowData: DEFAULT_WORKFLOW_DATA,
    loading: false,
    error: null,
    refetch: vi.fn(),
    updateWorkflowState: vi.fn(),
  })),
}));

vi.mock('@/hooks/useDepositStatus', () => ({
  __esModule: true,
  useDepositStatus: vi.fn(() => ({
    satisfied: true,
    required: BigInt(1000000),
    deposited: BigInt(1000000),
    isLoading: false,
    error: null,
    config: {
      usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      depositCost: BigInt(1000000),
      decimals: 6,
    },
    refresh: vi.fn(),
  })),
}));

vi.mock('@/hooks/useDepositUsdc', () => ({
  __esModule: true,
  useDepositUsdc: vi.fn(() => ({
    needsApproval: false,
    isApproving: false,
    isDepositing: false,
    isConfirming: false,
    isDone: false,
    approve: vi.fn(),
    deposit: vi.fn(),
    error: null,
    allowance: BigInt(0),
    reset: vi.fn(),
  })),
}));

vi.mock('@/hooks/useEnsureCorrectNetwork', () => ({
  __esModule: true,
  useEnsureCorrectNetwork: vi.fn(() => ({
    ensureCorrectNetwork: vi.fn().mockResolvedValue(true),
    isSwitching: false,
    desiredChainId: 8453,
  })),
}));

vi.mock('@/hooks/useToast', () => ({
  __esModule: true,
  useToast: vi.fn(() => ({ toast: marqueeToastFn })),
}));

// Expose marqueeToastFn for tests that import it from shared setup
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).__TEST_TOAST_FN__ = marqueeToastFn;
