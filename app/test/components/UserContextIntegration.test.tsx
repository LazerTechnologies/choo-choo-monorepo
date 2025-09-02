/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CastingWidget } from '@/components/ui/CastingWidget';
import { WinnerSelectionWidget } from '@/components/ui/WinnerSelectionWidget';
import {
  renderWithProvider,
  setupTestMocks,
  cleanupTestMocks,
  mockUseWorkflowState,
  mockUseCurrentHolder,
  mockUseMiniApp,
  mockUseNeynarContext,
} from './shared-test-setup';
import { WorkflowState } from '@/lib/workflow-types';
import { createMockWorkflowState, createMockUser } from '../helpers/mocks';

describe.skip('User Context Integration', () => {
  let mockUpdateWorkflowState: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Suppress expected console errors in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const mocks = setupTestMocks();
    mockUpdateWorkflowState = mocks.mockUpdateWorkflowState;
  });

  afterEach(() => {
    cleanupTestMocks();
  });

  it('should show different UI for current holder vs non-holder', () => {
    // Test current holder sees CastingWidget
    mockUseCurrentHolder.mockReturnValue({
      currentHolder: { ...createMockUser(123, 'currentholder'), address: '0x123' },
      isCurrentHolder: true,
      loading: false,
      error: null,
    });

    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.NOT_CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    const { rerender } = renderWithProvider(<CastingWidget />);
    expect(screen.getByText('Send Cast')).toBeInTheDocument();

    // Test non-holder doesn't see CastingWidget
    mockUseCurrentHolder.mockReturnValue({
      currentHolder: { ...createMockUser(456, 'otherholder'), address: '0x456' },
      isCurrentHolder: false,
      loading: false,
      error: null,
    });

    rerender(<CastingWidget />);
    expect(screen.queryByText('Send Cast')).not.toBeInTheDocument();
  });

  it('should handle user authentication state changes', () => {
    mockUseCurrentHolder.mockReturnValue({
      currentHolder: null,
      isCurrentHolder: false,
      loading: false,
      error: null,
    });

    mockUseMiniApp.mockReturnValue({
      context: {
        user: null,
        client: {} as any,
      },
    } as any);

    const { container } = renderWithProvider(<CastingWidget />);
    expect(container.firstChild).toBeNull();
  });

  it('should handle current holder changes via Redis pub/sub', () => {
    // This is handled by the useCurrentHolder hook with SSE
    mockUseCurrentHolder.mockReturnValue({
      currentHolder: { ...createMockUser(123, 'newholder'), address: '0x123' },
      isCurrentHolder: true,
      loading: false,
      error: null,
    });

    renderWithProvider(<CastingWidget />);
    expect(screen.getByText('@newholder')).toBeInTheDocument();
  });

  it('should update UI when workflow state changes via events', () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    renderWithProvider(<WinnerSelectionWidget />);
    expect(
      screen.getByText('Send ChooChoo to a friend, or leave it to chance.')
    ).toBeInTheDocument();
  });

  it('should handle missing user data gracefully', () => {
    mockUseMiniApp.mockReturnValue({
      context: {
        user: null,
        client: {} as any,
      },
    } as any);

    mockUseNeynarContext.mockReturnValue({
      user: null,
      client_id: 'test',
      theme: 'light',
      setTheme: vi.fn(),
      isAuthenticated: false,
      client: {} as any,
      logout: vi.fn(),
    } as any);

    const { container } = renderWithProvider(<CastingWidget />);
    expect(container.firstChild).toBeNull();
  });

  it('should handle missing current holder data gracefully', () => {
    mockUseCurrentHolder.mockReturnValue({
      currentHolder: null,
      isCurrentHolder: false,
      loading: false,
      error: null,
    });

    const { container } = renderWithProvider(<CastingWidget />);
    expect(container.firstChild).toBeNull();
  });
});
