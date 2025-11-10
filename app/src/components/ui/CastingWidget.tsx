'use client';

import { useState, useEffect } from 'react';
import { useMiniApp } from '@neynar/react';
import { useCurrentHolder } from '@/hooks/useCurrentHolder';
import { useMarqueeToast } from '@/providers/MarqueeToastProvider';
import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Typography } from '@/components/base/Typography';
import { CHOOCHOO_CAST_TEMPLATES, APP_URL } from '@/lib/constants';
import { WorkflowState } from '@/lib/workflow-types';
import Image from 'next/image';
import { sdk } from '@farcaster/miniapp-sdk';

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

  const handlePostCast = async () => {
    const castText = CHOOCHOO_CAST_TEMPLATES.USER_NEW_PASSENGER_CAST();
    console.log(`🚀 [CastingWidget] Starting cast composition for FID ${currentUserFid}`);
    console.log(`🚀 [CastingWidget] Cast text: "${castText}"`);

    try {
      const result = await sdk.actions.composeCast({
        text: castText,
        embeds: [APP_URL],
      });

      console.log(`🔍 [CastingWidget] ComposeCast result:`, result);

      if (result?.cast) {
        console.log(`✅ [CastingWidget] Cast sent directly via composeCast: ${result.cast.hash}`);
        console.log(`✅ [CastingWidget] Direct cast success - bypassing polling`);

        try {
          await fetch('/api/workflow-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              state: WorkflowState.CASTED,
              winnerSelectionStart: null,
              currentCastHash: result.cast.hash,
            }),
          });

          // Confirm persistence for a few seconds; re-POST if missing
          const confirmDeadline = Date.now() + 5000; // 5s
          while (Date.now() < confirmDeadline) {
            const confirmRes = await fetch('/api/workflow-state', { cache: 'no-store' });
            if (confirmRes.ok) {
              const wf = await confirmRes.json();
              if (wf?.currentCastHash === result.cast.hash && wf?.state === WorkflowState.CASTED) {
                break;
              }
            }
            await new Promise((r) => setTimeout(r, 300));
            // Try re-posting if still missing
            await fetch('/api/workflow-state', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                state: WorkflowState.CASTED,
                winnerSelectionStart: null,
                currentCastHash: result.cast.hash,
              }),
            });
          }

          window.dispatchEvent(
            new CustomEvent('workflow-state-changed', {
              detail: {
                state: WorkflowState.CASTED,
                winnerSelectionStart: null,
                currentCastHash: result.cast.hash,
              },
            }),
          );
          console.log(`✅ [CastingWidget] Dispatched workflow-state-changed event for direct cast`);
        } catch (eventError) {
          console.error(
            `🚨 [CastingWidget] Failed to dispatch workflow event for direct cast:`,
            eventError,
          );
        }

        toast({
          description: '🗨️ Cast sent! You can now choose where ChooChoo goes next!',
        });

        onCastSent?.();
        return;
      }

      console.log(`🔄 [CastingWidget] No direct cast result - falling back to polling`);
      console.log(
        `🔄 [CastingWidget] This means the cast composer opened but we don't have the hash yet`,
      );

      // fallback: polling for casts containing "@choochoo"
      setIsWaitingForCast(true);
      startPolling();

      toast({
        description: "🗨️ Casting... Come back when you're done",
      });
    } catch (error) {
      console.error(`🚨 [CastingWidget] Failed to compose cast:`, error);
      console.error(`🚨 [CastingWidget] Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });
      toast({
        description: '❌ Failed to open cast composer',
        variant: 'destructive',
      });
    }
  };

  const startPolling = () => {
    let pollCount = 0;
    const maxPolls = 100; // 5 minutes at 3-second intervals
    console.log(`🔄 [CastingWidget] Starting cast detection polling for FID ${currentUserFid}`);
    console.log(
      `🔄 [CastingWidget] Will poll up to ${maxPolls} times (${(maxPolls * 3) / 60} minutes)`,
    );

    const interval = setInterval(async () => {
      pollCount++;
      console.log(
        `🔄 [CastingWidget] Poll attempt ${pollCount}/${maxPolls} for FID ${currentUserFid}`,
      );

      try {
        // Check cast status (webhook + recent cast fallback)
        const statusResponse = await fetch(`/api/cast-status?fid=${currentUserFid}`);

        if (!statusResponse.ok) {
          console.error(
            `🚨 [CastingWidget] Cast status API error: ${statusResponse.status} ${statusResponse.statusText}`,
          );
          const errorText = await statusResponse.text();
          console.error(`🚨 [CastingWidget] Error response body:`, errorText);
          return;
        }

        const statusData = await statusResponse.json();
        console.log(`🔍 [CastingWidget] Poll ${pollCount} response:`, statusData);

        if (statusData.hasCurrentUserCasted && statusData.currentCastHash) {
          clearInterval(interval);
          setPollInterval(null);
          setIsWaitingForCast(false);

          console.log(
            `✅ [CastingWidget] Cast detected on poll ${pollCount}: ${statusData.currentCastHash}`,
          );
          console.log(`✅ [CastingWidget] Stopping polling and updating UI state`);

          try {
            window.dispatchEvent(
              new CustomEvent('workflow-state-changed', {
                detail: {
                  state: WorkflowState.CASTED,
                  winnerSelectionStart: null,
                  currentCastHash: statusData.currentCastHash, // @dev preserve webhook cast hash
                },
              }),
            );
            console.log(`✅ [CastingWidget] Dispatched workflow-state-changed event`);
          } catch (eventError) {
            console.error(`🚨 [CastingWidget] Failed to dispatch workflow event:`, eventError);
          }

          toast({
            description: '✅ Cast found! Proceed to picking the next stop',
          });

          onCastSent?.();
          return;
        }

        if (pollCount >= maxPolls) {
          console.warn(`⏰ [CastingWidget] Polling timeout reached (${pollCount}/${maxPolls})`);
          console.warn(
            `⏰ [CastingWidget] No cast detected for FID ${currentUserFid} after ${(maxPolls * 3) / 60} minutes`,
          );
          clearInterval(interval);
          setPollInterval(null);
          setIsWaitingForCast(false);
          toast({
            description: '⛔ Timeout: If you casted with @choochoo, please refresh the page',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error(`🚨 [CastingWidget] Status polling error on attempt ${pollCount}:`, error);
        console.error(`🚨 [CastingWidget] Error details:`, {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    }, 3000); // Poll every 3 seconds

    setPollInterval(interval);
  };

  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        setPollInterval(null);
      }
    };
  }, [pollInterval]);

  useEffect(() => {
    if (!isWaitingForCast && pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
  }, [isWaitingForCast, pollInterval]);

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
