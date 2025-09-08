'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/base/Button';
import { Typography } from '@/components/base/Typography';
import { Card } from '@/components/base/Card';
import { useMarqueeToast } from '@/providers/MarqueeToastProvider';
import { useWorkflowState } from '@/hooks/useWorkflowState';
import { WorkflowState } from '@/lib/workflow-types';

export function PublicChanceWidget() {
  const { toast } = useMarqueeToast();
  const { workflowData, refetch: refreshWorkflowState } = useWorkflowState();
  const [loading, setLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // No need for separate state fetching - useWorkflowState handles this

  useEffect(() => {
    if (!workflowData.winnerSelectionStart) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const targetTime = new Date(workflowData.winnerSelectionStart!).getTime();
      const difference = targetTime - now;

      if (difference > 0) {
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining('');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [workflowData.winnerSelectionStart, workflowData.state]);

  const handlePublicRandomSend = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/send-train');
      if (response.data.success) {
        toast({
          description: `@${response.data.winner.username} was selected as the next passenger!`,
        });
        setTimeout(() => {
          void refreshWorkflowState();
        }, 1500);
      }
    } catch (error) {
      console.error('Error sending to random winner:', error);
      const maybeAxiosError = error as {
        response?: { status?: number; data?: { error?: string } };
      };

      if (maybeAxiosError?.response?.status === 409) {
        toast({
          description: 'Someone else just selected the winner!',
          variant: 'default',
        });
        setTimeout(() => {
          void refreshWorkflowState();
        }, 1000);
      } else if (
        maybeAxiosError?.response?.status === 400 &&
        maybeAxiosError?.response?.data?.error?.includes('Timer has not expired')
      ) {
        toast({
          description: "Timer hasn't expired yet, please wait...",
          variant: 'destructive',
        });
      } else {
        toast({
          description: 'Failed to select random winner',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Only render in chance states - HomePage handles routing, but just in case
  if (
    workflowData.state !== WorkflowState.CHANCE_ACTIVE &&
    workflowData.state !== WorkflowState.CHANCE_EXPIRED
  ) {
    return null;
  }

  return (
    <div className="w-full max-w-md mx-auto mb-8 space-y-4">
      <Card
        className="p-4 !bg-purple-500 !border-white w-full"
        style={{ backgroundColor: '#a855f7' }}
      >
        <div className="space-y-4">
          <div className="text-center">
            <Typography variant="h5" className="!text-white font-comic">
              Chance Mode
            </Typography>
            <Typography variant="body" className="text-sm !text-white mt-1">
              Send ChooChoo to a random reactor from the below cast 👇
            </Typography>
          </div>

          {workflowData.state === WorkflowState.CHANCE_ACTIVE && timeRemaining !== '' && (
            <div className="p-3 bg-purple-700 border border-white rounded">
              <Typography variant="body" className="text-sm !text-white text-center">
                ⏱️ Public sending will be enabled in: <strong>{timeRemaining}</strong>
              </Typography>
            </div>
          )}

          <Button
            onClick={handlePublicRandomSend}
            disabled={loading || timeRemaining !== ''}
            className="w-full !text-white hover:!text-white !bg-purple-500 !border-2 !border-white"
            style={{ backgroundColor: '#a855f7' }}
          >
            {loading
              ? 'Selecting Winner...'
              : timeRemaining === ''
                ? '🎲 Send ChooChoo'
                : 'Come back later...'}
          </Button>
        </div>
      </Card>

      {/* Cast display handled by HomePage */}
    </div>
  );
}
