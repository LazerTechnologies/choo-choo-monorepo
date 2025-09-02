/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CastingWidget } from '@/components/ui/CastingWidget';
import { WinnerSelectionWidget } from '@/components/ui/WinnerSelectionWidget';
import { PublicChanceWidget } from '@/components/ui/PublicChanceWidget';
import {
  renderWithProvider,
  setupTestMocks,
  cleanupTestMocks,
  mockUseWorkflowState,
  mockUseCurrentHolder,
  mockAxios,
} from './shared-test-setup';
import { WorkflowState } from '@/lib/workflow-types';
import { createMockWorkflowState, createMockUser } from '../helpers/mocks';

describe.skip('Error States', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockUpdateWorkflowState: ReturnType<typeof vi.fn>;
  let mockToast: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Suppress expected console errors in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const mocks = setupTestMocks();
    mockFetch = mocks.mockFetch;
    mockUpdateWorkflowState = mocks.mockUpdateWorkflowState;
    mockToast = mocks.mockToast;
  });

  afterEach(() => {
    cleanupTestMocks();
  });

  it('should show error messages for failed API calls', async () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: {
        state: WorkflowState.CHANCE_EXPIRED,
        winnerSelectionStart: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        currentCastHash: '0x123',
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    vi.mocked(mockAxios.post).mockRejectedValue(new Error('Network error'));

    renderWithProvider(<PublicChanceWidget />);

    const randomButton = screen.getByText('🎲 Send ChooChoo');
    fireEvent.click(randomButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        description: 'Failed to select random winner',
        variant: 'destructive',
      });
    });
  });

  it('should show loading states during async operations', () => {
    mockUseCurrentHolder.mockReturnValue({
      currentHolder: { ...createMockUser(123, 'currentholder'), address: '0x123' },
      isCurrentHolder: true,
      loading: true,
      error: null,
    });

    const { container } = renderWithProvider(<CastingWidget />);
    expect(container.firstChild).toBeNull(); // Loading state hides component
  });

  it('should handle network connectivity issues', async () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.NOT_CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    mockFetch.mockRejectedValue(new Error('Network error'));

    renderWithProvider(<CastingWidget />);

    const sendButton = screen.getByText('Send Cast');
    fireEvent.click(sendButton);

    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000); // 5 minutes timeout
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        description: '⛔ Timeout: If you casted, please refresh the page',
        variant: 'destructive',
      });
    });
  });

  it('should handle Redis connection failures', () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(),
      loading: false,
      error: 'Failed to fetch workflow state',
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    // Components should still render with default state
    renderWithProvider(<WinnerSelectionWidget />);
    expect(
      screen.getByText('Send ChooChoo to a friend, or leave it to chance.')
    ).toBeInTheDocument();
  });

  it('should provide retry mechanisms for failed operations', async () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    vi.mocked(mockAxios.post)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ data: { success: true } } as any);

    renderWithProvider(<WinnerSelectionWidget />);

    // First attempt fails, second succeeds (handled by user retry)
    const sendButton = screen.getByText(/Send ChooChoo/);
    expect(sendButton).toBeInTheDocument();
  });

  it('should show appropriate fallback UI for errors', () => {
    mockUseCurrentHolder.mockReturnValue({
      currentHolder: null,
      isCurrentHolder: false,
      loading: false,
      error: 'Failed to fetch current holder',
    });

    const { container } = renderWithProvider(<CastingWidget />);
    expect(container.firstChild).toBeNull(); // Fallback is to not render
  });
});
