'use client';

import { useState, useEffect } from 'react';
import { useMiniApp } from '@neynar/react';
import { useCurrentHolder } from '@/hooks/useCurrentHolder';
import { useMarqueeToast } from '@/providers/MarqueeToastProvider';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Typography } from '@/components/base/Typography';
import { CHOOCHOO_CAST_TEMPLATES } from '@/lib/constants';
import { WorkflowState } from '@/lib/workflow-types';
import Image from 'next/image';

interface CastingWidgetProps {
  onCastSent?: () => void;
}

export function CastingWidget({ onCastSent }: CastingWidgetProps) {
  const { context } = useMiniApp();
  const { isCurrentHolder, loading } = useCurrentHolder();
  const { toast } = useMarqueeToast();
  const [isWaitingForCast, setIsWaitingForCast] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  const currentUserFid = context?.user?.fid;

  const handlePostCast = () => {
    const castText = encodeURIComponent(CHOOCHOO_CAST_TEMPLATES.USER_NEW_PASSENGER_CAST());
    // @dev use warpcast domain for iOS compatibility
    const warpcastUrl = `https://warpcast.com/~/compose?text=${castText}`;

    // Open Warpcast
    window.location.href = warpcastUrl;

    // Start waiting and polling (webhook should detect most cases)
    setIsWaitingForCast(true);
    startPolling();

    toast({
      description: "🗨️ Casting... Come back when you're done",
    });
  };

  const startPolling = () => {
    // webhook only
    const interval = setInterval(async () => {
      try {
        const statusResponse = await fetch(`/api/cast-status?fid=${currentUserFid}`);
        const statusData = await statusResponse.json();

        if (statusData.hasCurrentUserCasted) {
          clearInterval(interval);
          setIsWaitingForCast(false);

          // Update workflow state to CASTED
          try {
            await fetch('/api/workflow-state', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                state: 'CASTED',
                winnerSelectionStart: null,
                currentCastHash: null,
              }),
            });
            // Broadcast immediate UI update
            try {
              window.dispatchEvent(
                new CustomEvent('workflow-state-changed', {
                  detail: {
                    state: WorkflowState.CASTED,
                    winnerSelectionStart: null,
                    currentCastHash: null,
                  },
                })
              );
            } catch {}
          } catch (error) {
            console.error('Failed to update workflow state to CASTED:', error);
          }

          toast({
            description: '✅ Cast found! Proceed to picking the next stop',
          });

          onCastSent?.();
        }
      } catch (error) {
        console.error('Status polling error:', error);
      }
    }, 3000); // Poll webhook status every 3 seconds

    setPollInterval(interval);

    // Stop polling after 5 minutes
    setTimeout(
      () => {
        clearInterval(interval);
        setIsWaitingForCast(false);
        toast({
          description: '⛔ Timeout: If you casted, please refresh the page',
          variant: 'destructive',
        });
      },
      5 * 60 * 1000
    );
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  // Only show cast widget for the current holder
  if (!currentUserFid || loading || !isCurrentHolder) {
    return null;
  }

  return (
    <Card className="p-4 !bg-purple-500 !border-white" style={{ backgroundColor: '#a855f7' }}>
      <div className="space-y-4">
        {/* User info display */}
        <div className="flex items-center gap-3">
          {context?.user?.pfpUrl && (
            <Image
              src={context.user.pfpUrl}
              width={40}
              height={40}
              alt="User Profile Picture"
              className="rounded-full"
            />
          )}
          <div>
            <Typography variant="body" className="font-semibold !text-white">
              {context?.user?.displayName || 'Current Holder'}
            </Typography>
            <Typography variant="small" className="!text-white">
              @{context?.user?.username || 'unknown'}
            </Typography>
          </div>
        </div>

        {/* Cast preview */}
        <div className="bg-purple-700 p-3 rounded-lg border border-white">
          <Typography variant="body" className="!text-white whitespace-pre-line">
            {CHOOCHOO_CAST_TEMPLATES.USER_NEW_PASSENGER_CAST()}
          </Typography>
        </div>

        {isWaitingForCast && (
          <div className="bg-blue-100 border border-blue-400 p-3 rounded-lg">
            <Typography variant="small" className="!text-blue-800 text-center">
              🔄 Waiting for your cast...
            </Typography>
          </div>
        )}

        {/* Action button */}
        <div className="flex justify-center">
          <Button
            onClick={handlePostCast}
            disabled={isWaitingForCast}
            className="!text-white hover:!text-white !bg-purple-500 !border-2 !border-white px-8 py-2"
            style={{ backgroundColor: '#a855f7' }}
          >
            {isWaitingForCast ? 'Casting...' : 'Send Cast'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
