import { useState, useEffect } from 'react';

/**
 * Hook to fetch the yoink timer duration from the contract
 * Returns the timer in hours with a fallback to 2 hours
 */
export function useYoinkTimer() {
  const [timerHours, setTimerHours] = useState<number>(2); // 2 hour fallback
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchYoinkTimer() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/yoink-countdown');
        if (!response.ok) {
          throw new Error('Failed to fetch yoink timer');
        }
        const data = await response.json();

        if (data.yoinkTimerHours && typeof data.yoinkTimerHours === 'number') {
          setTimerHours(data.yoinkTimerHours);
        }
        setError(null);
      } catch (err) {
        console.error('Error fetching yoink timer:', err);
        setError('Failed to fetch timer');
        // Keep fallback value of 2 hours
      } finally {
        setIsLoading(false);
      }
    }

    fetchYoinkTimer();
  }, []);

  return { timerHours, isLoading, error };
}
