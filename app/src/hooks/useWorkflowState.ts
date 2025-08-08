'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { WorkflowState, WorkflowData, DEFAULT_WORKFLOW_DATA } from '@/lib/workflow-types';

export function useWorkflowState() {
  const [workflowData, setWorkflowData] = useState<WorkflowData>(DEFAULT_WORKFLOW_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        };

        await axios.post('/api/workflow-state', payload);
        setWorkflowData((prev) => ({ ...prev, ...payload }));
        return true;
      } catch (err) {
        console.error('Error updating workflow state:', err);
        setError('Failed to update workflow state');
        return false;
      }
    },
    []
  );

  useEffect(() => {
    fetchWorkflowState();

    // Listen for workflow state changes
    const handleWorkflowChange = () => {
      fetchWorkflowState();
    };

    window.addEventListener('workflow-state-changed', handleWorkflowChange);
    window.addEventListener('choo-random-enabled', handleWorkflowChange);

    return () => {
      window.removeEventListener('workflow-state-changed', handleWorkflowChange);
      window.removeEventListener('choo-random-enabled', handleWorkflowChange);
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
