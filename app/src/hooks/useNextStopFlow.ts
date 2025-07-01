import { useState, useCallback } from 'react';

/**
 * Result object returned by useNextStopFlow.
 */
export interface UseNextStopFlowResult {
  /**
   * Triggers the next stop orchestration for the ChooChoo train.
   * Sends a POST request to /api/send-train with the provided castHash.
   */
  sendTrain: () => Promise<void>;
  /** True if the request is in progress. */
  isLoading: boolean;
  /** True if the request succeeded. */
  isSuccess: boolean;
  /** True if the request failed. */
  isError: boolean;
  /** Error message if the request failed, otherwise null. */
  error: string | null;
  /** Resets the success and error state. */
  reset: () => void;
  loadingText: string | null;
}

/**
 * React hook to orchestrate the next stop flow for the ChooChoo train journey.
 *
 * @param castHash - The hash of the cast for which to select the next stop winner.
 * @returns An object with sendTrain (function), isLoading, isSuccess, isError, and error.
 *
 * @example
 * const { sendTrain, isLoading, isSuccess, isError, error } = useNextStopFlow(castHash);
 * // ...
 * <button onClick={sendTrain} disabled={isLoading}>Send Train</button>
 */
export function useNextStopFlow(castHash: string): UseNextStopFlowResult {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendTrain = useCallback(async () => {
    setIsLoading(true);
    setIsSuccess(false);
    setIsError(false);
    setError(null);
    try {
      const res = await fetch('/api/send-train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ castHash }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send train');
      }
      setIsSuccess(true);
    } catch (e: unknown) {
      setIsError(true);
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [castHash]);

  const reset = useCallback(() => {
    setIsSuccess(false);
    setIsError(false);
    setError(null);
  }, []);

  const loadingText = isLoading
    ? 'Choo-Choo is on the move... this could take a few seconds.'
    : null;

  return {
    sendTrain,
    isLoading,
    loadingText,
    isSuccess,
    isError,
    error,
    reset,
  };
}
