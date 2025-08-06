'use client';

import { useState, useEffect, useCallback } from 'react';
import { useNeynarContext } from '@neynar/react';
import { useMiniApp } from '@neynar/react';

interface SignerState {
  hasApprovedSigner: boolean;
  signerUuid?: string;
  signerApprovalUrl?: string;
  loading: boolean;
  error: string | null;
}

interface CreateSignerResponse {
  signer_uuid: string;
  public_key: string;
  status: string;
  signer_approval_url: string;
}

export function useSignerManager() {
  const { user } = useNeynarContext();
  const { context } = useMiniApp();
  const [signerState, setSignerState] = useState<SignerState>({
    hasApprovedSigner: false,
    loading: true,
    error: null,
  });

  const currentUserFid = user?.fid || context?.user?.fid;

  const checkSignerStatus = useCallback(async () => {
    if (!currentUserFid) {
      setSignerState((prev) => ({ ...prev, loading: false, hasApprovedSigner: false }));
      return;
    }

    try {
      setSignerState((prev) => ({ ...prev, loading: true, error: null }));

      const response = await fetch(`/api/signer/check?fid=${currentUserFid}`);
      if (!response.ok) {
        throw new Error('Failed to check signer status');
      }

      const data = await response.json();

      setSignerState((prev) => ({
        ...prev,
        hasApprovedSigner: data.hasApprovedSigner,
        signerUuid: data.signers?.[0]?.signer_uuid,
        loading: false,
      }));
    } catch (error) {
      console.error('Error checking signer status:', error);
      setSignerState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [currentUserFid]);

  const createSigner = async (): Promise<CreateSignerResponse> => {
    if (!currentUserFid) {
      throw new Error('User FID is required');
    }

    try {
      setSignerState((prev) => ({ ...prev, loading: true, error: null }));

      const response = await fetch('/api/signer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: currentUserFid }),
      });
      if (!response.ok) {
        throw new Error('Failed to create signer');
      }

      const data: CreateSignerResponse = await response.json();

      setSignerState((prev) => ({
        ...prev,
        signerApprovalUrl: data.signer_approval_url,
        loading: false,
      }));

      return data;
    } catch (error) {
      console.error('Error creating signer:', error);
      setSignerState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
      throw error;
    }
  };

  const markSignerApproved = async (): Promise<void> => {
    if (!currentUserFid) {
      throw new Error('User FID is required');
    }

    try {
      const response = await fetch('/api/signer/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: currentUserFid }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark signer as approved');
      }

      // Refresh signer status
      await checkSignerStatus();
    } catch (error) {
      console.error('Error marking signer as approved:', error);
      throw error;
    }
  };

  // Check signer status when component mounts or user changes
  useEffect(() => {
    checkSignerStatus();
  }, [currentUserFid, checkSignerStatus]);

  return {
    ...signerState,
    createSigner,
    markSignerApproved,
    checkSignerStatus,
    currentUserFid,
  };
}
