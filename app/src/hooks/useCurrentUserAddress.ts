import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface UseCurrentUserAddressResult {
  address: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to get the current authenticated user's verified Ethereum address
 */
export function useCurrentUserAddress(): UseCurrentUserAddressResult {
  const { data: session } = useSession();
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserAddress() {
      console.log('[useCurrentUserAddress] Session data:', session);
      console.log('[useCurrentUserAddress] User FID:', session?.user?.fid);

      if (!session?.user?.fid) {
        console.log('[useCurrentUserAddress] No FID in session, skipping address fetch');
        setAddress(null);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const url = `/api/users/address?fid=${session.user.fid}`;
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
  }, [session]);

  return { address, isLoading, error };
}
