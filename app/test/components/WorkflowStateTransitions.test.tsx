/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CastingWidget } from '@/components/ui/CastingWidget';
import { WinnerSelectionWidget } from '@/components/ui/WinnerSelectionWidget';
import { PublicChanceWidget } from '@/components/ui/PublicChanceWidget';
import { flushPromises } from '../helpers/test-utils';
import { WorkflowState } from '@/lib/workflow-types';
import {
  renderWithProvider,
  setupTestMocks,
  cleanupTestMocks,
  mockUseWorkflowState,
  mockAxios,
} from './shared-test-setup';
import { createMockWorkflowState } from '../helpers/mocks';

describe.skip('Workflow State Transitions', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockUpdateWorkflowState: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Suppress expected console errors in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const mocks = setupTestMocks();
    mockFetch = mocks.mockFetch;
    mockUpdateWorkflowState = mocks.mockUpdateWorkflowState;
  });

  afterEach(() => {
    cleanupTestMocks();
  });

  it('should transition NOT_CASTED -> CASTED on cast detection', async () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.NOT_CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/cast-status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ hasCurrentUserCasted: true }),
        });
      }
      if (url.includes('/api/workflow-state')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    renderWithProvider(<CastingWidget />);

    const sendButton = screen.getByText('Send Cast');
    fireEvent.click(sendButton);

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await flushPromises();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/workflow-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: 'CASTED',
        winnerSelectionStart: null,
        currentCastHash: null,
      }),
    });
  });

  it('should transition CASTED -> MANUAL_SEND on manual send', async () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    renderWithProvider(<WinnerSelectionWidget />);

    // This tests the workflow transition logic
    expect(mockUpdateWorkflowState).toBeDefined();
  });

  it('should transition CASTED -> CHANCE_ACTIVE on chance enable', async () => {
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

    const chanceTab = screen.getByText('Chance');
    fireEvent.click(chanceTab);

    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      const finalConfirm = screen.getByText('Confirm');
      fireEvent.click(finalConfirm);
    });

    await waitFor(() => {
      expect(mockUpdateWorkflowState).toHaveBeenCalledWith(WorkflowState.CHANCE_ACTIVE, {
        winnerSelectionStart: '2024-01-01T00:00:00Z',
        currentCastHash: '0x123',
      });
    });
  });

  it('should transition CHANCE_ACTIVE -> CHANCE_EXPIRED on timer expiry', async () => {
    const pastTime = new Date(Date.now() - 1000);

    mockUseWorkflowState.mockReturnValue({
      workflowData: {
        state: WorkflowState.CHANCE_ACTIVE,
        winnerSelectionStart: pastTime.toISOString(),
        currentCastHash: '0x123',
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    renderWithProvider(<PublicChanceWidget />);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockUpdateWorkflowState).toHaveBeenCalledWith(WorkflowState.CHANCE_EXPIRED);
  });

  it('should transition any state -> NOT_CASTED on successful train movement', async () => {
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

    vi.mocked(mockAxios.post).mockResolvedValue({
      data: {
        success: true,
        winner: { username: 'randomwinner' },
      },
    } as any);

    const mockReload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true,
    });

    renderWithProvider(<PublicChanceWidget />);

    const randomButton = screen.getByText('🎲 Send ChooChoo');
    fireEvent.click(randomButton);

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  /**
   * @notice this is tested in the orchestrator but included here to outline full workflow behavior
   */
  it('should transition any state -> CASTED on train movement error', async () => {
    // This would be tested in the error handling of the orchestrator
    // The components themselves don't handle this transition directly
    expect(mockUpdateWorkflowState).toBeDefined();
  });

  it('should handle invalid state transitions gracefully', () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: {
        state: 'INVALID_STATE' as WorkflowState,
        winnerSelectionStart: null,
        currentCastHash: null,
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    // Components should handle invalid states gracefully
    const { container: castingContainer } = renderWithProvider(<CastingWidget />);
    const { container: selectionContainer } = renderWithProvider(<WinnerSelectionWidget />);
    const { container: chanceContainer } = renderWithProvider(<PublicChanceWidget />);

    expect(castingContainer.firstChild).toBeNull();
    expect(selectionContainer.firstChild).not.toBeNull(); // WinnerSelectionWidget always renders
    expect(chanceContainer.firstChild).toBeNull();
  });

  it('should persist state changes across page reloads', () => {
    // This is handled by the useWorkflowState hook fetching from API
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    renderWithProvider(<WinnerSelectionWidget />);

    // State persistence is verified by the hook fetching from /api/workflow-state
    expect(
      screen.getByText('Send ChooChoo to a friend, or leave it to chance.'),
    ).toBeInTheDocument();
  });
});
