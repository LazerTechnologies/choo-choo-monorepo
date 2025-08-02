'use client';

import { JourneyTimelineItem } from './JourneyTimelineItem';
import { Typography } from '@/components/base/Typography';
import { useEffect, useState, useCallback } from 'react';
import type { JourneyItem } from '@/app/api/journey/route';

interface JourneyTimelineProps {
  refreshOnMintTrigger?: number;
}

export function JourneyTimeline({ refreshOnMintTrigger }: JourneyTimelineProps) {
  const [items, setItems] = useState<JourneyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJourneyData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/journey');
      const data = await response.json();

      if (data.success) {
        setItems(data.journey);
      } else {
        setError(data.error || 'Failed to fetch journey data');
      }
    } catch (err) {
      console.error('Failed to fetch journey data:', err);
      setError('Failed to fetch journey data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchJourneyData();
  }, [fetchJourneyData]);

  // Refresh when refreshOnMintTrigger changes (new token minted)
  useEffect(() => {
    if (refreshOnMintTrigger && refreshOnMintTrigger > 0) {
      fetchJourneyData();
    }
  }, [refreshOnMintTrigger, fetchJourneyData]);

  // Optimistic update polling for production (every 60 seconds)
  // @todo: determine through testing whether we need to poll this often
  useEffect(() => {
    const interval = setInterval(fetchJourneyData, 60000);
    return () => clearInterval(interval);
  }, [fetchJourneyData]);

  if (loading && items.length === 0) {
    return (
      <div className="w-full max-w-md mx-auto">
        <Typography variant="h3" className="text-center mb-4 text-gray-900 dark:text-gray-100">
          Previous Stops
        </Typography>
        <div className="text-center py-8">
          <Typography variant="body" className="text-gray-500 dark:text-gray-400 font-comic">
            Loading journey...
          </Typography>
        </div>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="w-full max-w-md mx-auto">
        <Typography variant="h3" className="text-center mb-4 text-gray-900 dark:text-gray-100">
          Previous Stops
        </Typography>
        <div className="text-center py-8">
          <Typography variant="body" className="text-red-500 dark:text-red-400 font-comic">
            {error}
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <Typography
        variant="h3"
        className="text-center mb-4 text-gray-900 dark:text-gray-100 font-comic"
      >
        Previous Stops
      </Typography>

      <div className="space-y-3">
        {items.map((item, index) => (
          <JourneyTimelineItem
            key={`${item.address}-${item.ticketNumber}-${index}`}
            username={item.username}
            address={item.address}
            nftImage={item.nftImage}
            ticketNumber={item.ticketNumber}
            date={item.date}
            duration={item.duration}
            avatarSrc={item.avatarSrc}
          />
        ))}
      </div>

      {items.length === 0 && !loading && (
        <div className="text-center py-8">
          <Typography variant="body" className="text-gray-500 dark:text-gray-400 font-comic">
            Choo Choo is still in the station!
          </Typography>
        </div>
      )}
    </div>
  );
}
