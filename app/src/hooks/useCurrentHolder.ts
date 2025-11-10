'use client';

import { useState, useEffect } from 'react';
import { useNeynarContext } from '@neynar/react';
import { useMiniApp } from '@neynar/react';
import { fetchCurrentHolderCached, clearCurrentHolderCache } from '@/lib/fetchCurrentHolder';

interface CurrentHolder {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  address: string;
}

export function useCurrentHolder() {
  const { user } = useNeynarContext();
  const { context } = useMiniApp();
  const [currentHolder, setCurrentHolder] = useState<CurrentHolder | null>(null);
  const [isCurrentHolder, setIsCurrentHolder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial snapshot load
  useEffect(() => {
    const fetchCurrentHolder = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchCurrentHolderCached();
        setCurrentHolder(data.currentHolder);

        const currentUserFid = user?.fid || context?.user?.fid;
        if (currentUserFid && data.currentHolder?.fid) {
          setIsCurrentHolder(currentUserFid === data.currentHolder.fid);
        } else {
          setIsCurrentHolder(false);
        }
      } catch (err) {
        console.error('Failed to fetch current holder:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsCurrentHolder(false);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentHolder();
  }, [user, context?.user]);

  // Subscribe to SSE updates, force refresh on message
  useEffect(() => {
    let es: EventSource | null = null;

    const connect = () => {
      try {
        es = new EventSource('/api/current-holder/stream');
        es.onmessage = async () => {
          try {
            clearCurrentHolderCache();
            const data = await fetchCurrentHolderCached({ force: true });
            setCurrentHolder(data.currentHolder);
            const currentUserFid = user?.fid || context?.user?.fid;
            setIsCurrentHolder(
              !!currentUserFid &&
                !!data.currentHolder?.fid &&
                currentUserFid === data.currentHolder.fid,
            );
          } catch {
            // Ignore; snapshot fetch failure handled by polling fallback
          }
        };
        es.onerror = () => {
          es?.close();
          es = null;
          // Fallback reconnect after short delay
          setTimeout(connect, 3000);
        };
      } catch {
        // Ignore and let polling cover it
      }
    };

    connect();

    return () => {
      es?.close();
      es = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.fid, context?.user?.fid]);

  return {
    currentHolder,
    isCurrentHolder,
    loading,
    error,
  };
}
