'use client';

import { useState, useEffect, useCallback } from 'react';
import { useNeynarContext } from '@neynar/react';
import { Card } from '@/components/base/Card';
import { Button } from '@/components/base/Button';
import { Typography } from '@/components/base/Typography';
import { CastDisplayWidget } from './CastDisplayWidget';
import { UsernameInput } from './UsernameInput';
import { useMarqueeToast } from '@/providers/MarqueeToastProvider';
import axios from 'axios';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/base/Tabs';
import { Dialog } from '@/components/base/Dialog';

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
  const { toast } = useMarqueeToast();
  const { user } = useNeynarContext();

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
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [tabValue, setTabValue] = useState<'send' | 'chance'>('send');

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
        if (!state.isPublicSendEnabled) handleEnablePublicSend();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state.winnerSelectionStart, state.isPublicSendEnabled, handleEnablePublicSend]);

  // Fetch state on component mount
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Keep tab selection in sync with mode
  useEffect(() => {
    setTabValue(state.useRandomWinner ? 'chance' : 'send');
  }, [state.useRandomWinner]);

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

  const confirmEnableChance = async () => {
    if (!user?.username) {
      toast({ description: 'User not authenticated', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Leverage existing backend flow to enable random mode, create cast, and start 30m window
      const response = await axios.post('/api/enable-random-winner', {
        username: user.username,
      });

      if (response.data.success) {
        setState((prev) => ({
          ...prev,
          useRandomWinner: true,
          winnerSelectionStart: response.data.winnerSelectionStart,
          isPublicSendEnabled: false,
        }));

        toast({
          description: '🎲 Chance mode enabled: Send ChooChoo to a random reactor in 30 minutes!',
        });
        setIsConfirmOpen(false);
        setTabValue('chance');
      } else {
        throw new Error('Failed to enable random winner mode');
      }
    } catch (error) {
      console.error('Error enabling chance mode:', error);
      await fetchState();
      toast({ description: 'Failed to enable chance mode', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {state.useRandomWinner && state.currentCastHash && (
        <CastDisplayWidget castHash={state.currentCastHash} />
      )}

      <Card className="p-4 !bg-purple-500 !border-white" style={{ backgroundColor: '#a855f7' }}>
        <div className="space-y-4">
          <Typography variant="h4" className="!text-white font-comic">
            Choose Selection Method
          </Typography>

          <Tabs
            value={tabValue}
            onValueChange={(v) => setTabValue(v as 'send' | 'chance')}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger
                value="send"
                disabled={state.useRandomWinner}
                className="data-[state=active]:!bg-purple-700 data-[state=active]:!text-white data-[state=active]:!border-white"
              >
                Send
              </TabsTrigger>
              <TabsTrigger
                value="chance"
                className="data-[state=active]:!bg-purple-700 data-[state=active]:!text-white data-[state=active]:!border-white"
              >
                Chance
              </TabsTrigger>
            </TabsList>

            <TabsContent value="send">
              <div className="space-y-4 w-full">
                {!state.useRandomWinner ? (
                  <>
                    <UsernameInput
                      label="Select Next Passenger"
                      placeholder="Enter username..."
                      onUserSelect={setSelectedUser}
                      disabled={loading}
                      className="w-full"
                    />
                    <Typography variant="body" className="text-xs !text-white">
                      Choose who gets ChooChoo next
                    </Typography>

                    <Button
                      onClick={handleManualSend}
                      disabled={loading || !selectedUser}
                      className="w-full !text-white hover:!text-white !bg-purple-500 !border-2 !border-white"
                      style={{ backgroundColor: '#a855f7' }}
                    >
                      {loading
                        ? 'Sending ChooChoo...'
                        : selectedUser
                          ? `Send ChooChoo to @${selectedUser.username}`
                          : 'Send ChooChoo'}
                    </Button>
                  </>
                ) : (
                  <div className="p-3 bg-purple-700 border border-white rounded">
                    <Typography variant="body" className="text-sm !text-white">
                      Manual sending is disabled after confirming Chance mode.
                    </Typography>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="chance">
              <div className="space-y-4 w-full">
                {!state.useRandomWinner ? (
                  <>
                    <Typography variant="body" className="!text-white">
                      You can leave ChooChoo&apos;s next stop up to chance. In 30 minutes anyone
                      will be able to select a random person who has reacted to your previous cast
                      to receive ChooChoo.
                    </Typography>

                    <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                      <Dialog.Trigger asChild>
                        <Button
                          className="w-full !text-white hover:!text-white !bg-purple-500 !border-2 !border-white"
                          style={{ backgroundColor: '#a855f7' }}
                          disabled={loading}
                        >
                          Confirm
                        </Button>
                      </Dialog.Trigger>
                      <Dialog.Content
                        title="Confirm Chance Mode"
                        description="Confirm Chance Mode"
                        size="sm"
                        className="!bg-purple-700 !text-white !border-white"
                      >
                        <div className="p-4 space-y-4">
                          <Typography variant="body" className="!text-white">
                            Once you confirm, you cannot manually send. Leave it up to chance?
                          </Typography>
                          <div className="flex gap-2 justify-end">
                            <Button
                              onClick={() => setIsConfirmOpen(false)}
                              disabled={loading}
                              className="!bg-red-600 hover:!bg-red-700 !text-white !border-2 !border-red-700"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={confirmEnableChance}
                              disabled={loading}
                              className="!bg-purple-500 hover:!bg-purple-600 !text-white !border-2 !border-white"
                            >
                              {loading ? 'Confirming...' : 'Confirm'}
                            </Button>
                          </div>
                        </div>
                      </Dialog.Content>
                    </Dialog>
                  </>
                ) : (
                  <div className="space-y-4">
                    {state.winnerSelectionStart && !state.isPublicSendEnabled && (
                      <div className="p-3 bg-purple-700 border border-white rounded">
                        <Typography variant="body" className="text-sm !text-white">
                          ⏱️ Public sending will be enabled in: <strong>{timeRemaining}</strong>
                        </Typography>
                      </div>
                    )}

                    <Button
                      onClick={handleRandomSend}
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

                    {!state.isPublicSendEnabled && (
                      <Typography variant="body" className="text-xs !text-white text-center">
                        Anyone can send ChooChoo to a random reactor when the time is up
                      </Typography>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  );
}
