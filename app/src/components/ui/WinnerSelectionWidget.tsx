'use client';

import { useState, useEffect, useCallback } from 'react';
import { useNeynarContext } from '@neynar/react';
import { Card } from '@/components/base/Card';
import { Button } from '@/components/base/Button';
import { Typography } from '@/components/base/Typography';
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
          description: '🎲 Random mode enabled: Public sending will be available in 30 minutes',
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

  // Don't render if chance mode is already active - PublicChanceWidget will handle it
  if (state.useRandomWinner) {
    return null;
  }

  return (
    <div className="space-y-6">
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
              </div>
            </TabsContent>

            <TabsContent value="chance">
              <div className="space-y-4 w-full">
                <Typography variant="body" className="!text-white">
                  You can leave ChooChoo&apos;s next stop up to chance. In 30 minutes anyone will be
                  able to select a random reactor to your previous cast to receive ChooChoo.
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
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  );
}
