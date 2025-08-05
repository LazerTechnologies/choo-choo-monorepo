'use client';

import { useState, useEffect } from 'react';
import { useNeynarContext } from '@neynar/react';

interface CurrentHolder {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  address: string;
  timestamp: string;
}

export function useCurrentHolder() {
  const { user } = useNeynarContext();
  const [currentHolder, setCurrentHolder] = useState<CurrentHolder | null>(null);
  const [isCurrentHolder, setIsCurrentHolder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCurrentHolder = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/current-holder');
        if (!response.ok) {
          throw new Error('Failed to fetch current holder');
        }

        const data = await response.json();
        setCurrentHolder(data.currentHolder);

        // Check if the current user is the holder
        if (user?.fid && data.currentHolder?.fid) {
          setIsCurrentHolder(user.fid === data.currentHolder.fid);
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
  }, [user?.fid]);

  return {
    currentHolder,
    isCurrentHolder,
    loading,
    error,
  };
}
