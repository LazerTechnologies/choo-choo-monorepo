import { Card } from '@/components/base/Card';
import { Avatar } from '@/components/base/Avatar';
import { Typography } from '@/components/base/Typography';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { CurrentHolderData } from '@/types/nft';
import { useMarqueeToast } from '@/providers/MarqueeToastProvider';
import { useMiniApp } from '@neynar/react';

interface CurrentHolderItemProps {
  refreshOnMintTrigger?: number;
}

export function CurrentHolderItem({ refreshOnMintTrigger }: CurrentHolderItemProps) {
  const [currentHolder, setCurrentHolder] = useState<CurrentHolderData | null>(null);
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const [duration, setDuration] = useState<string>('');

  const { haptics } = useMiniApp();
  const { toast } = useMarqueeToast();
  const previousHolderFid = useRef<number | null>(null);
  const isInitialLoad = useRef(true);

  const fetchCurrentHolder = useCallback(async () => {
    try {
      const response = await fetch('/api/current-holder');
      if (response.ok) {
        const data = await response.json();
        if (data.hasCurrentHolder) {
          const newHolder = data.currentHolder;
          const newHolderFid = newHolder.fid;

          // Detect holder change and trigger effects (skip on initial load)
          if (
            !isInitialLoad.current &&
            previousHolderFid.current !== null &&
            previousHolderFid.current !== newHolderFid
          ) {
            console.log(`[Easter Egg] If you're reading this, you are based 🔵`);
            try {
              await haptics?.impactOccurred('medium');
            } catch (error) {
              console.log('Haptic feedback failed:', error);
            }
            toast({
              description: `🚂 All aboard! ${newHolder.username} is now riding ChooChoo!`,
            });
          }

          setCurrentHolder(newHolder);
          setIsCurrentUser(data.isCurrentHolder);
          previousHolderFid.current = newHolderFid;
        } else {
          setCurrentHolder(null);
          setIsCurrentUser(false);
          previousHolderFid.current = null;
        }
        if (isInitialLoad.current) {
          isInitialLoad.current = false;
        }
      }
    } catch (error) {
      console.error('Failed to fetch current holder:', error);
    }
  }, [haptics, toast]);

  // Initial load
  useEffect(() => {
    fetchCurrentHolder();
  }, [fetchCurrentHolder]);

  useEffect(() => {
    if (refreshOnMintTrigger && refreshOnMintTrigger > 0) {
      fetchCurrentHolder();
    }
  }, [refreshOnMintTrigger, fetchCurrentHolder]);

  // Real-time polling for holder changes (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(fetchCurrentHolder, 30000);
    return () => clearInterval(interval);
  }, [fetchCurrentHolder]);

  // Calculate duration since holding
  useEffect(() => {
    if (!currentHolder?.timestamp) return;
    const updateDuration = () => {
      const now = new Date();
      const holderSince = new Date(currentHolder.timestamp);
      const diffInSeconds = Math.floor((now.getTime() - holderSince.getTime()) / 1000);
      if (diffInSeconds < 60) {
        setDuration(`${diffInSeconds}s`);
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        setDuration(`${minutes}m`);
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        setDuration(`${hours}h`);
      } else {
        const days = Math.floor(diffInSeconds / 86400);
        setDuration(`${days}d`);
      }
    };
    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [currentHolder?.timestamp]);

  // Only show skeleton if we have never loaded data
  if (currentHolder === null) {
    return (
      <Card className="w-full">
        <Card.Content className="p-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3"></div>
            </div>
            <div className="w-8 h-6 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </Card.Content>
      </Card>
    );
  }

  const truncatedAddress = `${currentHolder.address.slice(0, 6)}...${currentHolder.address.slice(-4)}`;

  const displayName = isCurrentUser ? 'You' : currentHolder.username;

  return (
    <Card className="w-full border-2 animate-pulse-slow dark:animate-pulse-slow-dark">
      <Card.Content className="p-3">
        <div className="flex items-start gap-3">
          {/* Left: User Avatar */}
          <div className="flex-shrink-0">
            <Avatar size="sm" className="border-2 border-blue-400">
              <Avatar.Image src={currentHolder.pfpUrl} alt={currentHolder.username} />
              <Avatar.Fallback className="bg-blue-500 text-white text-xs font-bold">
                {currentHolder.username.slice(0, 2).toUpperCase()}
              </Avatar.Fallback>
            </Avatar>
          </div>

          {/* Center: User info and details */}
          <div className="flex-1 min-w-0">
            {/* Username */}
            <div className="mb-1">
              {isCurrentUser ? (
                <Typography
                  variant="label"
                  className="font-semibold text-blue-800 dark:text-blue-200 truncate font-comic"
                >
                  {displayName}
                </Typography>
              ) : (
                <a
                  href={`https://farcaster.xyz/${currentHolder.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-blue-800 dark:text-blue-200 hover:text-blue-600 dark:hover:text-blue-300 truncate font-comic hover:underline transition-colors"
                >
                  {displayName}
                </a>
              )}
            </div>

            {/* Address */}
            <div className="mb-2">
              <Typography
                variant="small"
                className="text-blue-600 dark:text-blue-400 truncate font-mono block"
              >
                {truncatedAddress}
              </Typography>
            </div>

            {/* Date and Duration */}
            <div className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-300">
              <span className="font-comic">Current passenger</span>
              <span className="font-mono">Holding for {duration}</span>
            </div>
          </div>

          {/* Right: Special #0 ticket number for current holder */}
          <div className="flex-shrink-0">
            <div className="bg-blue-200 dark:bg-blue-800 border border-blue-400 dark:border-blue-600 rounded-md px-2 py-1">
              <Typography
                variant="small"
                className="font-comic font-semibold text-blue-800 dark:text-blue-200"
              >
                #0
              </Typography>
            </div>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}
