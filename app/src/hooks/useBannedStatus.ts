import { useEffect, useState } from 'react';

interface UseBannedStatusResult {
  isBanned: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * React hook to check if the current user is banned
 *
 * @param fid - The FID of the user to check
 * @returns An object with isBanned, isLoading, and error
 */
export function useBannedStatus(fid: number | null | undefined): UseBannedStatusResult {
  const [isBanned, setIsBanned] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fid || !Number.isFinite(fid)) {
      setIsBanned(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function checkBanned() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/check-banned?fid=${fid}`);
        if (!response.ok) {
          throw new Error('Failed to check banned status');
        }

        const data = (await response.json()) as { banned: boolean; fid: number };
        if (!cancelled) {
          setIsBanned(data.banned);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          // On error, assume not banned to avoid blocking legitimate users
          setIsBanned(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void checkBanned();

    return () => {
      cancelled = true;
    };
  }, [fid]);

  return { isBanned, isLoading, error };
}
