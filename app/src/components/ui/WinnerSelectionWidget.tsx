'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/base/Card';
import { Button } from '@/components/base/Button';
import { Typography } from '@/components/base/Typography';
import { Switch } from '@/components/base/Switch';
import { CastDisplayWidget } from './CastDisplayWidget';
import { UsernameInput } from './UsernameInput';
import { useToast } from '@/hooks/useToast';
import axios from 'axios';

interface WinnerSelectionWidgetProps {
  onTokenMinted?: () => void;
}

interface WinnerSelectionState {
  useRandomWinner: boolean;
  winnerSelectionStart: string | null;
  isPublicSendEnabled: boolean;
  currentCastHash: string | null;
}

export function WinnerSelectionWidget({ onTokenMinted }: WinnerSelectionWidgetProps) {
  const { toast } = useToast();

  const [state, setState] = useState<WinnerSelectionState>({
    useRandomWinner: false,
    winnerSelectionStart: null,
    isPublicSendEnabled: false,
    currentCastHash: null,
  });

  const [selectedUser, setSelectedUser] = useState<{
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Fetch current state from Redis
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
      console.error('Error fetching state:', error);
    }
  }, []);

  const handleEnablePublicSend = useCallback(async () => {
    try {
      await axios.post('/api/redis', {
        action: 'write',
        key: 'isPublicSendEnabled',
        value: 'true',
      });

      // Send the PUBLIC_SEND_OPEN cast via a new endpoint that handles this
      await axios.post('/api/enable-public-send');

      setState((prev) => ({
        ...prev,
        isPublicSendEnabled: true,
      }));

      toast({
        description: '🚂 Public sending is now enabled! Anyone can select the next passenger.',
      });
    } catch (error) {
      console.error('Error enabling public send:', error);
    }
  }, [toast]);

  // Calculate time remaining
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
        // Auto-enable public send if time is up
        if (!state.isPublicSendEnabled) {
          handleEnablePublicSend();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state.winnerSelectionStart, state.isPublicSendEnabled, handleEnablePublicSend]);

  // Fetch state on component mount
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const handleToggleRandomWinner = async (checked: boolean) => {
    setLoading(true);
    try {
      await axios.post('/api/redis', {
        action: 'write',
        key: 'useRandomWinner',
        value: checked.toString(),
      });

      if (checked) {
        // Set winner selection start time (30 minutes from now)
        const startTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        await Promise.all([
          axios.post('/api/redis', {
            action: 'write',
            key: 'winnerSelectionStart',
            value: startTime,
          }),
          axios.post('/api/redis', {
            action: 'write',
            key: 'isPublicSendEnabled',
            value: 'false',
          }),
        ]);

        setState((prev) => ({
          ...prev,
          useRandomWinner: true,
          winnerSelectionStart: startTime,
          isPublicSendEnabled: false,
        }));

        toast({
          description:
            '🎲 Random winner mode enabled! Public sending will be available in 30 minutes.',
        });
      } else {
        // Clear timer and disable public send
        await Promise.all([
          axios.post('/api/redis', { action: 'delete', key: 'winnerSelectionStart' }),
          axios.post('/api/redis', { action: 'delete', key: 'isPublicSendEnabled' }),
        ]);

        setState((prev) => ({
          ...prev,
          useRandomWinner: false,
          winnerSelectionStart: null,
          isPublicSendEnabled: false,
        }));
      }
    } catch (error) {
      console.error('Error toggling random winner:', error);
      toast({
        description: 'Failed to update selection mode',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualSend = async () => {
    if (!selectedUser) {
      toast({
        description: 'Please select a user first',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/user-send-train', {
        targetFid: selectedUser.fid,
      });

      if (response.data.success) {
        toast({
          description: `🚂 ChooChoo sent to @${selectedUser.username}!`,
        });
        onTokenMinted?.();
      }
    } catch (error) {
      console.error('Error sending ChooChoo:', error);
      toast({
        description: 'Failed to send ChooChoo',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRandomSend = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/send-train');

      if (response.data.success) {
        toast({
          description: `🎲 Random winner selected: @${response.data.winner.username}!`,
        });
        onTokenMinted?.();
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
    <div className="space-y-6">
      {/* Cast Display - Show if useRandomWinner is true and castHash exists */}
      {state.useRandomWinner && state.currentCastHash && (
        <CastDisplayWidget castHash={state.currentCastHash} />
      )}

      <Card className="p-4">
        <div className="space-y-4">
          <Typography variant="h4" className="text-gray-900 dark:text-gray-100 font-comic">
            Choose Selection Method
          </Typography>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Typography variant="body" className="font-medium">
                Leave it to chance?
              </Typography>
              <Typography variant="body" className="text-sm text-gray-600 dark:text-gray-300">
                Toggle on to let anyone pick a random winner, or keep off to manually select
              </Typography>
            </div>
            <Switch
              checked={state.useRandomWinner}
              onCheckedChange={handleToggleRandomWinner}
              disabled={loading}
            />
          </div>

          {state.useRandomWinner ? (
            <div className="space-y-4">
              {state.winnerSelectionStart && !state.isPublicSendEnabled && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                  <Typography variant="body" className="text-sm">
                    ⏱️ Public sending will be enabled in: <strong>{timeRemaining}</strong>
                  </Typography>
                </div>
              )}

              <Button
                onClick={handleRandomSend}
                disabled={loading || !state.isPublicSendEnabled}
                className="w-full bg-purple-500 hover:bg-purple-600 text-white"
              >
                {loading
                  ? 'Selecting Winner...'
                  : state.isPublicSendEnabled
                    ? '🎲 Pick Random Winner'
                    : '🎲 Pick Random Winner (Disabled)'}
              </Button>

              {!state.isPublicSendEnabled && (
                <Typography variant="body" className="text-xs text-gray-500 text-center">
                  Button will be enabled for everyone once the timer expires
                </Typography>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <UsernameInput
                label="Select Next Passenger"
                placeholder="Enter username..."
                onUserSelect={setSelectedUser}
                disabled={loading}
                helperText="Choose who gets ChooChoo next"
                className="w-full"
              />

              <Button
                onClick={handleManualSend}
                disabled={loading || !selectedUser}
                className="w-full bg-purple-500 hover:bg-purple-600 text-white"
              >
                {loading
                  ? 'Sending ChooChoo...'
                  : selectedUser
                    ? `Send ChooChoo to @${selectedUser.username}`
                    : 'Send ChooChoo'}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
