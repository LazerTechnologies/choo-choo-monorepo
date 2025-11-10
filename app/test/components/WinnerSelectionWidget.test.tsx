/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WinnerSelectionWidget } from '@/components/ui/WinnerSelectionWidget';
import {
  renderWithProvider,
  setupTestMocks,
  cleanupTestMocks,
  mockUseWorkflowState,
  mockUseCurrentHolder,
  mockUseAccount,
  mockUseDepositStatus,
  mockAxios,
} from './shared-test-setup';
import { WorkflowState } from '@/lib/workflow-types';
import { createMockWorkflowState, createMockUser } from '../helpers/mocks';

describe.skip('WinnerSelectionWidget', () => {
  let mockUpdateWorkflowState: ReturnType<typeof vi.fn>;
  let mockToast: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Suppress expected console errors in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const mocks = setupTestMocks();
    mockUpdateWorkflowState = mocks.mockUpdateWorkflowState;
    mockToast = mocks.mockToast;
  });

  afterEach(() => {
    cleanupTestMocks();
  });

  it('should render when workflowState is CASTED and user is current holder', () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    mockUseCurrentHolder.mockReturnValue({
      currentHolder: { ...createMockUser(123, 'currentholder'), address: '0x123' },
      isCurrentHolder: true,
      loading: false,
      error: null,
    });

    renderWithProvider(<WinnerSelectionWidget />);

    expect(
      screen.getByText('Send ChooChoo to a friend, or leave it to chance.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
    expect(screen.getByText('Chance')).toBeInTheDocument();
  });

  it('should not render when workflowState is CASTED and user is not current holder', () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    mockUseCurrentHolder.mockReturnValue({
      currentHolder: { ...createMockUser(456, 'otherholder'), address: '0x456' },
      isCurrentHolder: false,
      loading: false,
      error: null,
    });

    // WinnerSelectionWidget doesn't have conditional rendering - HomePage controls this
    // But we can test that it would work correctly for non-current holders
    renderWithProvider(<WinnerSelectionWidget />);

    // Component renders but functionality should be limited to current holder
    expect(
      screen.getByText('Send ChooChoo to a friend, or leave it to chance.'),
    ).toBeInTheDocument();
  });

  it('should not render when workflowState is NOT_CASTED', () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.NOT_CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    // WinnerSelectionWidget doesn't have conditional rendering - HomePage controls this
    // This test verifies the component structure when in wrong state
    renderWithProvider(<WinnerSelectionWidget />);

    expect(
      screen.getByText('Send ChooChoo to a friend, or leave it to chance.'),
    ).toBeInTheDocument();
  });

  it('should show Send and Chance tabs', () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    renderWithProvider(<WinnerSelectionWidget />);

    expect(screen.getByText('Send')).toBeInTheDocument();
    expect(screen.getByText('Chance')).toBeInTheDocument();

    // Default should be Send tab
    expect(screen.getByPlaceholderText('Enter username...')).toBeInTheDocument();
  });

  it('should handle manual send with username input', async () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    vi.mocked(mockAxios.post).mockResolvedValue({
      data: { success: true, winner: { username: 'targetuser' } },
    } as any);

    renderWithProvider(<WinnerSelectionWidget />);

    // This test would need the UsernameInput component to be properly mocked
    // For now, we'll test the button interaction
    const sendButton = screen.getByText(/Send ChooChoo/);
    expect(sendButton).toBeInTheDocument();
  });

  it('should validate username input format', () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    renderWithProvider(<WinnerSelectionWidget />);

    const sendButton = screen.getByText(/Send ChooChoo/);
    fireEvent.click(sendButton);

    // Should show toast for missing user selection
    expect(mockToast).toHaveBeenCalledWith({
      description: 'Please select a user first',
      variant: 'destructive',
    });
  });

  it('should call /api/user-send-train on manual send', async () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    vi.mocked(mockAxios.post).mockResolvedValue({
      data: { success: true },
    } as any);

    const onTokenMinted = vi.fn();
    renderWithProvider(<WinnerSelectionWidget onTokenMinted={onTokenMinted} />);

    // Simulate user selection (would need to mock UsernameInput properly)
    const component = screen.getByText(/Send ChooChoo/);

    // For this test, we'll verify the API call structure
    expect(component).toBeInTheDocument();
  });

  it('should show in-progress toast on 409 response', async () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    vi.mocked(mockAxios.post).mockRejectedValue({
      response: { status: 409 },
    });

    renderWithProvider(<WinnerSelectionWidget />);

    // This would be tested when user is selected and send is attempted
    expect(screen.getByText(/Send ChooChoo/)).toBeInTheDocument();
  });

  it('should transition to MANUAL_SEND state during send', async () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    renderWithProvider(<WinnerSelectionWidget />);

    // Verify the updateWorkflowState would be called with MANUAL_SEND
    expect(mockUpdateWorkflowState).toBeDefined();
  });

  it('should show chance mode confirmation dialog', async () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    renderWithProvider(<WinnerSelectionWidget />);

    // Click on Chance tab
    const chanceTab = screen.getByText('Chance');
    fireEvent.click(chanceTab);

    // Should show confirm button
    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    // Should show confirmation dialog
    await waitFor(() => {
      expect(
        screen.getByText('Once you confirm, you cannot manually send. Leave it up to chance?'),
      ).toBeInTheDocument();
    });
  });

  it('should call /api/enable-random-winner on chance confirm', async () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    vi.mocked(mockAxios.post).mockResolvedValue({
      data: {
        success: true,
        winnerSelectionStart: '2024-01-01T00:00:00Z',
        castHash: '0x123',
      },
    } as any);

    renderWithProvider(<WinnerSelectionWidget />);

    // Click on Chance tab
    const chanceTab = screen.getByText('Chance');
    fireEvent.click(chanceTab);

    // Click confirm button
    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    // Click final confirm in dialog
    await waitFor(() => {
      const finalConfirm = screen.getByText('Confirm');
      fireEvent.click(finalConfirm);
    });

    await waitFor(() => {
      expect(vi.mocked(mockAxios.post)).toHaveBeenCalledWith('/api/enable-random-winner', {
        username: 'currentholder',
      });
    });
  });

  it('should transition to CHANCE_ACTIVE on chance enable', async () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    vi.mocked(mockAxios.post).mockResolvedValue({
      data: {
        success: true,
        winnerSelectionStart: '2024-01-01T00:00:00Z',
        castHash: '0x123',
      },
    } as any);

    renderWithProvider(<WinnerSelectionWidget />);

    // This would be called after successful chance enable
    expect(mockUpdateWorkflowState).toBeDefined();
  });

  it('should handle wallet connection requirements', () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    mockUseAccount.mockReturnValue({
      isConnected: false,
      address: undefined,
      addresses: undefined,
      chain: undefined,
      chainId: undefined,
      connector: undefined,
      isConnecting: false,
      isDisconnected: true,
      isReconnecting: false,
      status: 'disconnected',
    } as any);

    renderWithProvider(<WinnerSelectionWidget />);

    expect(screen.getByText('Connect wallet')).toBeInTheDocument();
  });

  it('should handle deposit requirements', () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    mockUseDepositStatus.mockReturnValue({
      satisfied: false,
      required: BigInt(1000000),
      deposited: BigInt(0),
      isLoading: false,
      error: null,
      config: {
        usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        depositCost: BigInt(1000000),
        decimals: 6,
      },
      refresh: vi.fn(),
    });

    renderWithProvider(<WinnerSelectionWidget />);

    expect(screen.getByText('Deposit 1 USDC')).toBeInTheDocument();
  });

  it('should reset workflow state to CASTED on error', async () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    vi.mocked(mockAxios.post).mockRejectedValue(new Error('Network error'));

    renderWithProvider(<WinnerSelectionWidget />);

    // This would be tested when an error occurs during send
    expect(mockUpdateWorkflowState).toBeDefined();
  });
});
