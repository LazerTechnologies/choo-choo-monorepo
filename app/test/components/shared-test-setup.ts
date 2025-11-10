/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { vi } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const marqueeToastFn = (global as any).__TEST_TOAST_FN__ || vi.fn();
import { WorkflowState } from '@/lib/workflow-types';
import { createMockWorkflowState, createMockUser } from '../helpers/mocks';

// Make React globally available for JSX
global.React = React;

// Render helper with provider
export function renderWithProvider(
  ui: React.ReactElement,
  options?: import('@testing-library/react').RenderOptions,
): RenderResult {
  const uiWithProviders = ui;
  return render(uiWithProviders, options);
}

// Mock all hooks and external dependencies
vi.mock('@/hooks/useCurrentHolder');
vi.mock('@/hooks/useWorkflowState');
vi.mock('@/hooks/useDepositStatus');
vi.mock('@/hooks/useDepositUsdc');
vi.mock('@/hooks/useEnsureCorrectNetwork');
vi.mock('@/hooks/useToast');
vi.mock('wagmi');
vi.mock('axios');

// Export mocked hooks
export const mockUseCurrentHolder = vi.mocked(
  await import('@/hooks/useCurrentHolder'),
).useCurrentHolder;
export const mockUseWorkflowState = vi.mocked(
  await import('@/hooks/useWorkflowState'),
).useWorkflowState;
export const mockUseDepositStatus = vi.mocked(
  await import('@/hooks/useDepositStatus'),
).useDepositStatus;
export const mockUseDepositUsdc = vi.mocked(await import('@/hooks/useDepositUsdc')).useDepositUsdc;
export const mockUseEnsureCorrectNetwork = vi.mocked(
  await import('@/hooks/useEnsureCorrectNetwork'),
).useEnsureCorrectNetwork;
export const mockUseToast = vi.mocked(await import('@/hooks/useToast')).useToast;
export const mockUseMiniApp = vi.mocked(await import('@neynar/react')).useMiniApp;
export const mockUseNeynarContext = vi.mocked(await import('@neynar/react')).useNeynarContext;
export const mockUseAccount = vi.mocked(await import('wagmi')).useAccount;
export const mockAxios = vi.mocked(await import('axios')).default;

// Shared test setup function
export function setupTestMocks() {
  const mockFetch = vi.fn();
  const mockUpdateWorkflowState = vi.fn().mockResolvedValue(true);
  marqueeToastFn.mockReset();
  const mockToast = marqueeToastFn;

  // Setup global fetch mock
  global.fetch = mockFetch;

  // Setup workflow state mock
  mockUseWorkflowState.mockReturnValue({
    workflowData: createMockWorkflowState(),
    loading: false,
    error: null,
    refetch: vi.fn(),
    updateWorkflowState: mockUpdateWorkflowState,
  });

  // Setup current holder mock
  mockUseCurrentHolder.mockReturnValue({
    currentHolder: { ...createMockUser(123, 'currentholder'), address: '0x123' },
    isCurrentHolder: true,
    loading: false,
    error: null,
  });

  // Neynar hooks are mocked module-wide above

  // Setup wallet mocks
  mockUseAccount.mockReturnValue({
    isConnected: true,
    address: '0x123' as `0x${string}`,
    addresses: ['0x123' as `0x${string}`],
    chain: undefined,
    chainId: 8453,
    connector: {} as any,
    isConnecting: false,
    isDisconnected: false,
    isReconnecting: false,
    status: 'connected',
  } as any);

  mockUseDepositStatus.mockReturnValue({
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
  });

  mockUseDepositUsdc.mockReturnValue({
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
  });

  mockUseEnsureCorrectNetwork.mockReturnValue({
    ensureCorrectNetwork: vi.fn().mockResolvedValue(true),
    isSwitching: false,
    desiredChainId: 8453,
  });

  // Setup axios mock
  vi.mocked(mockAxios.get).mockResolvedValue({ data: { success: true } } as any);
  vi.mocked(mockAxios.post).mockResolvedValue({ data: { success: true } } as any);

  // Setup toast mock
  // useMarqueeToast is mocked module-wide; no-op here

  // Mock window APIs
  global.window.open = vi.fn();
  global.window.dispatchEvent = vi.fn();

  // Mock timers
  vi.useFakeTimers();

  return {
    mockFetch,
    mockUpdateWorkflowState,
    mockToast,
  };
}

// Shared cleanup function
export function cleanupTestMocks() {
  vi.restoreAllMocks();
  vi.useRealTimers();
}

// Export commonly used values
export { WorkflowState, createMockWorkflowState, createMockUser };
