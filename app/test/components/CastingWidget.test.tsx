/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  renderWithProvider,
  setupTestMocks,
  cleanupTestMocks,
  mockUseWorkflowState,
  mockUseCurrentHolder,
} from './shared-test-setup';
import { CastingWidget } from '@/components/ui/CastingWidget';
import { CHOOCHOO_CAST_TEMPLATES } from '@/lib/constants';
import { WorkflowState } from '@/lib/workflow-types';
import { createMockWorkflowState, createMockUser } from '../helpers/mocks';
import { flushPromises } from '../helpers/test-utils';

describe.skip('CastingWidget', () => {
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

  it('should render when workflowState is NOT_CASTED and user is current holder', () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.NOT_CASTED),
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

    renderWithProvider(<CastingWidget />);

    expect(screen.getByText('Send Cast')).toBeInTheDocument();
    expect(screen.getByText(CHOOCHOO_CAST_TEMPLATES.USER_NEW_PASSENGER_CAST())).toBeInTheDocument();
    expect(screen.getByText('@currentholder')).toBeInTheDocument();
  });

  it('should not render when workflowState is NOT_CASTED and user is not current holder', () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.NOT_CASTED),
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

    const { container } = renderWithProvider(<CastingWidget />);
    expect(container.firstChild).toBeNull();
  });

  it('should not render when workflowState is CASTED', () => {
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

    const { container } = renderWithProvider(<CastingWidget />);
    expect(container.firstChild).toBeNull();
  });

  it('should show cast preview with proper template', () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.NOT_CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    renderWithProvider(<CastingWidget />);

    const expectedCastText = CHOOCHOO_CAST_TEMPLATES.USER_NEW_PASSENGER_CAST();
    expect(screen.getByText(expectedCastText)).toBeInTheDocument();
  });

  it('should open Warpcast when Send Cast button clicked', () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.NOT_CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    renderWithProvider(<CastingWidget />);

    const sendButton = screen.getByText('Send Cast');
    fireEvent.click(sendButton);

    const expectedCastText = encodeURIComponent(CHOOCHOO_CAST_TEMPLATES.USER_NEW_PASSENGER_CAST());
    const expectedUrl = `https://farcaster.xyz/~/compose?text=${expectedCastText}`;

    expect(global.window.open).toHaveBeenCalledWith(expectedUrl, '_blank');
    expect(mockToast).toHaveBeenCalledWith({
      description: "🗨️ Casting... Come back when you're done",
    });
  });

  it('should transition to CASTED when cast is detected', async () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.NOT_CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    // Mock cast-status API to return cast detected
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

    // Wait for polling to detect cast
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

    expect(global.window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'workflow-state-changed',
        detail: {
          state: WorkflowState.CASTED,
          winnerSelectionStart: null,
          currentCastHash: null,
        },
      })
    );

    expect(mockToast).toHaveBeenCalledWith({
      description: '✅ Cast found! Proceed to picking the next stop',
    });
  });

  it('should handle cast detection webhook properly', async () => {
    mockUseWorkflowState.mockReturnValue({
      workflowData: createMockWorkflowState(WorkflowState.NOT_CASTED),
      loading: false,
      error: null,
      refetch: vi.fn(),
      updateWorkflowState: mockUpdateWorkflowState,
    });

    const onCastSent = vi.fn();
    renderWithProvider(<CastingWidget onCastSent={onCastSent} />);

    // Mock cast-status API to return cast detected
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

    const sendButton = screen.getByText('Send Cast');
    fireEvent.click(sendButton);

    // Wait for polling to detect cast
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await flushPromises();
    });

    expect(onCastSent).toHaveBeenCalled();
  });
});
