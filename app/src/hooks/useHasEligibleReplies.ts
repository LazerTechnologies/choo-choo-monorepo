import { useEffect, useState } from 'react';

// @todo since cast actions are going away, we should trigger the cast from within the app and store it in vercel kv store for that user and then check the cast value from the store for replies. or since there's only one eligible cast at a time we can just store { "current_cast_hash": "cast_hash" } kv pair and check that cast value for replies.
/**
 * React hook to check if a given cast has any eligible replies (with a valid wallet address).
 *
 * @param castHash - The hash of the cast to check.
 * @returns Boolean indicating if there are eligible replies, or undefined while loading or if castHash is not provided.
 *
 * @example
 * const hasReplies = useHasEligibleReplies(castHash);
 * if (hasReplies === false) return <div>No eligible replies.</div>;
 */
export function useHasEligibleReplies(castHash: string | undefined): {
  hasReplies: boolean | undefined;
  isLoading: boolean;
  error: string | null;
} {
  const [hasReplies, setHasReplies] = useState<boolean | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!castHash) {
      setHasReplies(undefined);
      setIsLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setHasReplies(undefined);
    setIsLoading(true);
    setError(null);

    fetch(`/api/check-eligible-replies?castHash=${encodeURIComponent(castHash)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setHasReplies(Boolean(data.hasReplies));
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setHasReplies(false);
          setIsLoading(false);
          setError(err.message || 'Failed to check eligible replies');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [castHash]);

  return { hasReplies, isLoading, error };
}
