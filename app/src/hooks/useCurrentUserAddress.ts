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
      if (!session?.user?.fid) {
        setAddress(null);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/users/address?fid=${session.user.fid}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('No verified Ethereum address found for your account');
          }
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to fetch address');
        }

        const data = await response.json();
        setAddress(data.address);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch address');
        setAddress(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserAddress();
  }, [session?.user?.fid]);

  return { address, isLoading, error };
}
