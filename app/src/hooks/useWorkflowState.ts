'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { WorkflowState, WorkflowData, DEFAULT_WORKFLOW_DATA } from '@/lib/workflow-types';

export function useWorkflowState() {
  const [workflowData, setWorkflowData] = useState<WorkflowData>(DEFAULT_WORKFLOW_DATA);
  const latestWorkflowRef = useRef<WorkflowData>(DEFAULT_WORKFLOW_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latestWorkflowRef.current = workflowData;
  }, [workflowData]);

  const fetchWorkflowState = useCallback(async () => {
    try {
      setError(null);
      const response = await axios.get('/api/workflow-state');
      setWorkflowData(response.data);
    } catch (err) {
      console.error('Error fetching workflow state:', err);
      setError('Failed to fetch workflow state');
      setWorkflowData(DEFAULT_WORKFLOW_DATA);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateWorkflowState = useCallback(
    async (newState: WorkflowState, additionalData?: Partial<WorkflowData>) => {
      try {
        const payload = {
          state: newState,
          ...additionalData,
        } as Partial<WorkflowData> & { state: WorkflowState };

        // Optimistically apply locally and broadcast immediately
        setWorkflowData((prev) => ({ ...prev, ...payload }));
        try {
          window.dispatchEvent(
            new CustomEvent<Partial<WorkflowData>>('workflow-state-changed', { detail: payload })
          );
        } catch {}

        await axios.post('/api/workflow-state', payload);

        return true;
      } catch (err) {
        console.error('Error updating workflow state:', err);
        setError('Failed to update workflow state');

        const previous = latestWorkflowRef.current;
        setWorkflowData(previous);
        try {
          window.dispatchEvent(
            new CustomEvent<Partial<WorkflowData>>('workflow-state-changed', { detail: previous })
          );
        } catch {}
        return false;
      }
    },
    []
  );

  useEffect(() => {
    fetchWorkflowState();

    const handleWorkflowChange = (evt: Event) => {
      const detail = (evt as CustomEvent<Partial<WorkflowData>>).detail;
      if (detail) {
        setWorkflowData((prev) => ({ ...prev, ...detail }));
      }
      if (refetchDebounceRef.current) {
        clearTimeout(refetchDebounceRef.current);
      }
      refetchDebounceRef.current = setTimeout(() => {
        void fetchWorkflowState();
      }, 200);
    };

    window.addEventListener('workflow-state-changed', handleWorkflowChange as EventListener);
    window.addEventListener('choo-random-enabled', handleWorkflowChange as EventListener);

    return () => {
      window.removeEventListener('workflow-state-changed', handleWorkflowChange as EventListener);
      window.removeEventListener('choo-random-enabled', handleWorkflowChange as EventListener);
      if (refetchDebounceRef.current) {
        clearTimeout(refetchDebounceRef.current);
      }
    };
  }, [fetchWorkflowState]);

  return {
    workflowData,
    loading,
    error,
    refetch: fetchWorkflowState,
    updateWorkflowState,
  };
}
