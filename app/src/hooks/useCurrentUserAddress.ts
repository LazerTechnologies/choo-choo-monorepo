import { useState, useEffect } from 'react';
import { useNeynarContext } from '@neynar/react';
import { useMiniApp } from '@neynar/react';

interface UseCurrentUserAddressResult {
  address: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to get the current authenticated user's verified Ethereum address
 */
export function useCurrentUserAddress(): UseCurrentUserAddressResult {
  const { user: neynarUser } = useNeynarContext();
  const { context } = useMiniApp();
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserAddress() {
      // Get FID from either Neynar auth user or MiniApp context
      const currentUserFid = neynarUser?.fid || context?.user?.fid;

      console.log('[useCurrentUserAddress] Neynar user:', neynarUser);
      console.log('[useCurrentUserAddress] MiniApp context user:', context?.user);
      console.log('[useCurrentUserAddress] Current user FID:', currentUserFid);

      if (!currentUserFid) {
        console.log('[useCurrentUserAddress] No FID found, skipping address fetch');
        setAddress(null);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const url = `/api/users/address?fid=${currentUserFid}`;
        console.log('[useCurrentUserAddress] Fetching from:', url);
        const response = await fetch(url);

        console.log('[useCurrentUserAddress] Response status:', response.status);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('No verified Ethereum address found for your account');
          }
          const data = await response.json().catch(() => ({}));
          console.error('[useCurrentUserAddress] API error response:', data);
          throw new Error(data.error || 'Failed to fetch address');
        }

        const data = await response.json();
        console.log('[useCurrentUserAddress] Successfully got address:', data.address);
        setAddress(data.address);
      } catch (err) {
        console.error('[useCurrentUserAddress] Error fetching address:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch address');
        setAddress(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserAddress();
  }, [neynarUser, context?.user]);

  return { address, isLoading, error };
}
