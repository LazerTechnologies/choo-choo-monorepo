import { useState, useEffect } from 'react';
import { calculateTimeRemaining, formatTimeRemaining, type TimeRemaining } from '@/utils/countdown';

interface YoinkCountdownState {
  isAvailable: boolean;
  timeRemaining: TimeRemaining;
  shortFormat: string;
  longFormat: string;
  clockFormat: string;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to get real-time yoink countdown based on last moved timestamp from Redis
 * Fetches the last moved timestamp and calculates when yoink becomes available (2 days later)
 */
export function useYoinkCountdown(): YoinkCountdownState {
  const [state, setState] = useState<YoinkCountdownState>({
    isAvailable: false,
    timeRemaining: { days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 },
    shortFormat: 'Loading...',
    longFormat: 'Loading...',
    clockFormat: '0:00:00',
    isLoading: true,
    error: null,
  });

  const [lastMovedTimestamp, setLastMovedTimestamp] = useState<number | null>(null);

  // Fetch last moved timestamp from API
  useEffect(() => {
    async function fetchLastMovedTimestamp() {
      try {
        const response = await fetch('/api/yoink-countdown');
        if (!response.ok) {
          throw new Error('Failed to fetch last moved timestamp');
        }
        const data = await response.json();

        if (data.lastMovedTimestamp) {
          setLastMovedTimestamp(new Date(data.lastMovedTimestamp).getTime());
        } else {
          // No timestamp available - yoink not available
          setLastMovedTimestamp(null);
        }
      } catch (error) {
        console.error('Error fetching last moved timestamp:', error);
        setState((prev) => ({
          ...prev,
          error: 'Failed to load countdown',
          isLoading: false,
        }));
      }
    }

    fetchLastMovedTimestamp();
  }, []);

  // Update countdown every second
  useEffect(() => {
    if (lastMovedTimestamp === null) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        shortFormat: 'N/A',
        longFormat: 'No movement recorded',
        clockFormat: 'N/A',
      }));
      return;
    }

    function updateCountdown() {
      if (lastMovedTimestamp === null) return;

      // Yoink becomes available 2 days after last movement
      const yoinkAvailableTimestamp = lastMovedTimestamp + 2 * 24 * 60 * 60 * 1000;
      const timeRemaining = calculateTimeRemaining(yoinkAvailableTimestamp);
      const isAvailable = timeRemaining.totalSeconds <= 0;

      setState((prev) => ({
        ...prev,
        isAvailable,
        timeRemaining,
        shortFormat: formatTimeRemaining(timeRemaining, 'short'),
        longFormat: formatTimeRemaining(timeRemaining, 'long'),
        clockFormat: formatTimeRemaining(timeRemaining, 'clock'),
        isLoading: false,
        error: null,
      }));
    }

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [lastMovedTimestamp]);

  return state;
}
