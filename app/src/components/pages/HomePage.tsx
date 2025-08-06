'use client';

import { useMiniApp } from '@neynar/react';
import { Button } from '@/components/base/Button';
import { Typography } from '@/components/base/Typography';
import { CurrentHolderItem } from '@/components/ui/timeline/CurrentHolderItem';
import { CastingWidget } from '@/components/ui/CastingWidget';
import { WinnerSelectionWidget } from '@/components/ui/WinnerSelectionWidget';
import { JourneyTimeline } from '@/components/ui/timeline';
import { useCurrentHolder } from '@/hooks/useCurrentHolder';
import { useUserCastedStatus } from '@/hooks/useUserCastedStatus';
import { useSoundPlayer } from '@/hooks/useSoundPlayer';
import { APP_NAME } from '@/lib/constants';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
import axios from 'axios';
import Image from 'next/image';

interface HomePageProps {
  title: string;
  timelineRefreshTrigger: number;
}

export function HomePage({ timelineRefreshTrigger }: HomePageProps) {
  const { context } = useMiniApp();
  const { isCurrentHolder, loading: isHolderLoading } = useCurrentHolder();
  const { hasCurrentUserCasted, loading: isCastedLoading, refreshStatus } = useUserCastedStatus();
  const { playChooChoo } = useSoundPlayer();
  const { toast } = useToast();

  const [isPublicSendEnabled, setIsPublicSendEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if public send is enabled
  const checkPublicSendStatus = useCallback(async () => {
    try {
      const response = await axios.get('/api/redis?action=read&key=isPublicSendEnabled');
      setIsPublicSendEnabled(response.data.value === 'true');
    } catch (error) {
      console.error('Error checking public send status:', error);
    }
  }, []);

  useEffect(() => {
    checkPublicSendStatus();
    // Check every 30 seconds for status updates
    const interval = setInterval(checkPublicSendStatus, 30000);
    return () => clearInterval(interval);
  }, [checkPublicSendStatus]);

  const handlePublicRandomSend = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/send-train');

      if (response.data.success) {
        toast({
          description: `@${response.data.winner.username} was selected as the next passenger!`,
        });
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      console.error('Error sending to random winner:', error);
      toast({
        description: 'Failed to select random winner',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overflow-y-auto h-[calc(100vh-200px)] px-6">
      <div className="flex flex-col items-center justify-center py-8">
        <Typography variant="h1" className="text-center mb-4 text-white font-comic text-4xl">
          {APP_NAME}
        </Typography>
        <Image
          src="/ChooChoo.webp"
          alt="ChooChoo App Logo"
          width={320}
          height={320}
          priority
          className="rounded-lg shadow-lg border-4"
          style={{ borderColor: 'var(--border)' }}
        />
      </div>

      {/* App Description */}
      <div className="pb-6 text-center px-4">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          ChooChoo is trying to visit every wallet on Base! When ChooChoo is in your wallet, send
          out a cast below to help determine his next stop. Anyone who replies to that cast will be
          in the running to receive ChooChoo next.
        </p>
        <Button
          variant="link"
          onClick={() => playChooChoo({ volume: 0.7 })}
          className="mt-2 text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
          🚂 All aboard!
        </Button>
      </div>

      {/* Current Stop Section */}
      <div className="w-full max-w-md mx-auto mb-8">
        <Typography
          variant="h3"
          className="text-center mb-4 text-gray-900 dark:text-gray-100 font-comic"
        >
          Current Stop
        </Typography>
        <CurrentHolderItem refreshOnMintTrigger={timelineRefreshTrigger} />
      </div>

      {/* Casting Widget or Winner Selection - Only show if user is signed in and is current holder */}
      {context?.user && !isHolderLoading && !isCastedLoading && isCurrentHolder && (
        <div className="w-full max-w-md mx-auto mb-8 flex flex-col items-center justify-center">
          {!hasCurrentUserCasted ? (
            <>
              <Typography
                variant="h3"
                className="text-center mb-4 text-gray-900 dark:text-gray-100 font-comic"
              >
                Pick Next Passenger
              </Typography>
              <Typography
                variant="body"
                className="text-center mb-4 text-gray-900 dark:text-gray-100 font-comic"
              >
                You&apos;re the current passenger! Send out a cast to let everyone know that
                ChooChoo is about to be on the move. Once people start reacting, you&apos;ll be able
                to randomly select a winner and send ChooChoo to their wallet.
              </Typography>
              <div className="w-full flex justify-center">
                <CastingWidget onCastSent={refreshStatus} />
              </div>
            </>
          ) : (
            <div className="w-full">
              <Typography
                variant="h3"
                className="text-center mb-4 text-gray-900 dark:text-gray-100 font-comic"
              >
                Pick Next Passenger
              </Typography>
              <WinnerSelectionWidget
                onTokenMinted={() => {
                  refreshStatus();
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Public Random Send Button - Show for non-current holders when public send is enabled */}
      {context?.user && !isHolderLoading && !isCurrentHolder && isPublicSendEnabled && (
        <div className="w-full max-w-md mx-auto mb-8 flex flex-col items-center justify-center">
          <Typography
            variant="h3"
            className="text-center mb-4 text-gray-900 dark:text-gray-100 font-comic"
          >
            Public Winner Selection Open!
          </Typography>
          <Typography variant="body" className="text-center mb-4 text-gray-900 dark:text-gray-100">
            The current passenger left it up to chance! Anyone can now pick a random winner from the
            cast reactions.
          </Typography>
          <Button
            onClick={handlePublicRandomSend}
            disabled={loading}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white max-w-sm"
          >
            {loading ? 'Selecting Winner...' : '🎲 Pick Random Winner'}
          </Button>
        </div>
      )}

      <div className="pb-8">
        <JourneyTimeline refreshOnMintTrigger={timelineRefreshTrigger} />
      </div>

      {/* Credits Section */}
      <div className="pb-8 border-t border-gray-200 dark:border-gray-700 pt-6 mt-8">
        <div className="text-center space-y-2">
          <p className="text-sm text-white dark:text-white">
            Artwork by{' '}
            <a
              href="https://farcaster.xyz/yonfrula"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
            >
              @yonfrula
            </a>
          </p>
          <p className="text-sm text-white dark:text-white">
            Built by{' '}
            <a
              href="https://farcaster.xyz/jonbray.eth"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
            >
              @jonbray.eth
            </a>
          </p>
          <p className="text-sm text-white dark:text-white">
            Built on Base 🔵 | Powered by Neynar 🪐 | Only on Farcaster 💜
          </p>
        </div>
      </div>
    </div>
  );
}
