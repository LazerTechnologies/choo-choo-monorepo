import { useState, useCallback } from 'react';

export interface UseYoinkFlowResult {
  yoinkTrain: (targetAddress: string) => Promise<void>;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: string | null;
  reset: () => void;
  loadingText: string | null;
}

/**
 * React hook to orchestrate the yoink flow for the ChooChoo train.
 *
 * @returns An object with yoinkTrain (function), isLoading, isSuccess, isError, error, and reset.
 *
 * @example
 * const { yoinkTrain, isLoading, isSuccess, isError, error } = useYoinkFlow();
 * // ...
 * <button onClick={() => yoinkTrain(userAddress)} disabled={isLoading}>Yoink Train</button>
 */
export function useYoinkFlow(): UseYoinkFlowResult {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yoinkTrain = useCallback(async (targetAddress: string) => {
    setIsLoading(true);
    setIsSuccess(false);
    setIsError(false);
    setError(null);

    try {
      const res = await fetch('/api/yoink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAddress }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to yoink train');
      }

      const result = await res.json();
      console.log('Yoink successful:', result);
      setIsSuccess(true);
    } catch (e: unknown) {
      setIsError(true);
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsSuccess(false);
    setIsError(false);
    setError(null);
  }, []);

  const loadingText = isLoading ? 'Yoinking ChooChoo... this could take a few seconds.' : null;

  return {
    yoinkTrain,
    isLoading,
    loadingText,
    isSuccess,
    isError,
    error,
    reset,
  };
}
