'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/base/Button';
import { Typography } from '@/components/base/Typography';
import { Card } from '@/components/base/Card';
import { useMarqueeToast } from '@/providers/MarqueeToastProvider';
import { CastDisplayWidget } from './CastDisplayWidget';

interface PublicChanceState {
  useRandomWinner: boolean;
  winnerSelectionStart: string | null;
  isPublicSendEnabled: boolean;
  currentCastHash: string | null;
}

export function PublicChanceWidget() {
  const { toast } = useMarqueeToast();

  const [state, setState] = useState<PublicChanceState>({
    useRandomWinner: false,
    winnerSelectionStart: null,
    isPublicSendEnabled: false,
    currentCastHash: null,
  });
  const [loading, setLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  const fetchState = useCallback(async () => {
    try {
      const [useRandomResponse, winnerStartResponse, publicEnabledResponse, castHashResponse] =
        await Promise.all([
          axios.get('/api/redis?action=read&key=useRandomWinner'),
          axios.get('/api/redis?action=read&key=winnerSelectionStart'),
          axios.get('/api/redis?action=read&key=isPublicSendEnabled'),
          axios.get('/api/redis?action=read&key=current-cast-hash'),
        ]);

      setState({
        useRandomWinner: useRandomResponse.data.value === 'true',
        winnerSelectionStart: winnerStartResponse.data.value,
        isPublicSendEnabled: publicEnabledResponse.data.value === 'true',
        currentCastHash: castHashResponse.data.value,
      });
    } catch (error) {
      console.error('Error fetching public chance state:', error);
    }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 30000);
    return () => clearInterval(interval);
  }, [fetchState]);

  useEffect(() => {
    if (!state.winnerSelectionStart) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const targetTime = new Date(state.winnerSelectionStart!).getTime();
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
  }, [state.winnerSelectionStart]);

  const handlePublicRandomSend = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/send-train');
      if (response.data.success) {
        toast({
          description: `@${response.data.winner.username} was selected as the next passenger!`,
        });
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (error) {
      console.error('Error sending to random winner:', error);
      toast({ description: 'Failed to select random winner', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!state.useRandomWinner) return null;

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
              Send ChooChoo to a random reactor from the below cast
            </Typography>
          </div>

          {state.winnerSelectionStart && !state.isPublicSendEnabled && (
            <div className="p-3 bg-purple-700 border border-white rounded">
              <Typography variant="body" className="text-sm !text-white text-center">
                ⏱️ Public sending will be enabled in: <strong>{timeRemaining}</strong>
              </Typography>
            </div>
          )}

          <Button
            onClick={handlePublicRandomSend}
            disabled={loading || !state.isPublicSendEnabled}
            className="w-full !text-white hover:!text-white !bg-purple-500 !border-2 !border-white"
            style={{ backgroundColor: '#a855f7' }}
          >
            {loading
              ? 'Selecting Winner...'
              : state.isPublicSendEnabled
                ? '🎲 Send ChooChoo'
                : 'Come back later...'}
          </Button>
        </div>
      </Card>

      {/* Announcement cast */}
      {state.currentCastHash && <CastDisplayWidget castHash={state.currentCastHash} />}
    </div>
  );
}
