/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PublicChanceWidget } from '@/components/ui/PublicChanceWidget';
import { WorkflowState } from '@/lib/workflow-types';
import { createMockWorkflowState } from '../helpers/mocks';
import {
  renderWithProvider,
  setupTestMocks,
  cleanupTestMocks,
  mockUseWorkflowState,
  mockAxios,
} from './shared-test-setup';

describe.skip('PublicChanceWidget', () => {
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

  it('should render when workflowState is CHANCE_ACTIVE', () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: {
        state: WorkflowState.CHANCE_ACTIVE,
        winnerSelectionStart: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
        currentCastHash: '0x123',
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    renderWithProvider(<PublicChanceWidget />);

    expect(screen.getByText('Chance Mode')).toBeInTheDocument();
    expect(
      screen.getByText('Send ChooChoo to a random reactor from the below cast'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Public sending will be enabled in:/)).toBeInTheDocument();
    expect(screen.getByText('Come back later...')).toBeInTheDocument();
  });

  it('should render when workflowState is CHANCE_EXPIRED', () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: {
        state: WorkflowState.CHANCE_EXPIRED,
        winnerSelectionStart: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
        currentCastHash: '0x123',
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    renderWithProvider(<PublicChanceWidget />);

    expect(screen.getByText('Chance Mode')).toBeInTheDocument();
    expect(screen.getByText('🎲 Send ChooChoo')).toBeInTheDocument();
    expect(screen.getByText('🎲 Send ChooChoo')).not.toBeDisabled();
  });

  it('should not render in other workflow states', () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.NOT_CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    const { container } = renderWithProvider(<PublicChanceWidget />);
    expect(container.firstChild).toBeNull();
  });

  it('should show countdown timer in CHANCE_ACTIVE state', () => {
    const futureTime = new Date(Date.now() + 25 * 60 * 1000 + 30 * 1000); // 25m 30s from now

    mockUseWorkflowState.mockReturnValue({
      workflowData: {
        state: WorkflowState.CHANCE_ACTIVE,
        winnerSelectionStart: futureTime.toISOString(),
        currentCastHash: '0x123',
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    renderWithProvider(<PublicChanceWidget />);

    expect(screen.getByText(/Public sending will be enabled in:/)).toBeInTheDocument();
    expect(screen.getByText(/25m 30s/)).toBeInTheDocument();
  });

  it('should auto-transition from CHANCE_ACTIVE to CHANCE_EXPIRED', async () => {
    const pastTime = new Date(Date.now() - 1000); // 1 second ago

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

    // Advance timer to trigger the countdown check
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockUpdateWorkflowState).toHaveBeenCalledWith(WorkflowState.CHANCE_EXPIRED);
  });

  it('should show enabled random button in CHANCE_EXPIRED state', () => {
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

    renderWithProvider(<PublicChanceWidget />);

    const randomButton = screen.getByText('🎲 Send ChooChoo');
    expect(randomButton).toBeInTheDocument();
    expect(randomButton).not.toBeDisabled();
  });

  it('should call /api/send-train when random button clicked', async () => {
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

    renderWithProvider(<PublicChanceWidget />);

    const randomButton = screen.getByText('🎲 Send ChooChoo');
    fireEvent.click(randomButton);

    await waitFor(() => {
      expect(vi.mocked(mockAxios.post)).toHaveBeenCalledWith('/api/send-train');
    });
  });

  it('should show success toast with winner username', async () => {
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

    renderWithProvider(<PublicChanceWidget />);

    const randomButton = screen.getByText('🎲 Send ChooChoo');
    fireEvent.click(randomButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        description: '@randomwinner was selected as the next passenger!',
      });
    });
  });

  it('should reload page after successful random selection', async () => {
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

    // Mock window.location.reload
    const mockReload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true,
    });

    renderWithProvider(<PublicChanceWidget />);

    const randomButton = screen.getByText('🎲 Send ChooChoo');
    fireEvent.click(randomButton);

    // Wait for the setTimeout to trigger reload
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it('should handle random selection errors', async () => {
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

  it('should calculate remaining time correctly', () => {
    const futureTime = new Date(Date.now() + 15 * 60 * 1000 + 45 * 1000); // 15m 45s from now

    mockUseWorkflowState.mockReturnValue({
      workflowData: {
        state: WorkflowState.CHANCE_ACTIVE,
        winnerSelectionStart: futureTime.toISOString(),
        currentCastHash: '0x123',
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    renderWithProvider(<PublicChanceWidget />);

    expect(screen.getByText(/15m 45s/)).toBeInTheDocument();
  });
});
