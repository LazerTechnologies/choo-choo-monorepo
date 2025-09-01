'use client';

import { useState, useEffect } from 'react';
import { useNeynarContext } from '@neynar/react';
import { useMiniApp } from '@neynar/react';
import { Card } from '@/components/base/Card';
import { Button } from '@/components/base/Button';
import { Typography } from '@/components/base/Typography';
import { UsernameInput } from './UsernameInput';
import { useMarqueeToast } from '@/providers/MarqueeToastProvider';
import { useWorkflowState } from '@/hooks/useWorkflowState';
import { WorkflowState } from '@/lib/workflow-types';
import axios from 'axios';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/base/Tabs';
import { Dialog } from '@/components/base/Dialog';
import { MessagePriority } from '@/lib/constants';
import { useDepositStatus } from '@/hooks/useDepositStatus';
import { useDepositUsdc } from '@/hooks/useDepositUsdc';
import { useAccount } from 'wagmi';
import { useEnsureCorrectNetwork } from '@/hooks/useEnsureCorrectNetwork';
import { ConnectWalletDialog } from '@/components/ui/ConnectWalletDialog';

interface WinnerSelectionWidgetProps {
  onTokenMinted?: () => void;
}

export function WinnerSelectionWidget({ onTokenMinted }: WinnerSelectionWidgetProps) {
  const { toast } = useMarqueeToast();
  const { user } = useNeynarContext();
  const { context } = useMiniApp();
  const { updateWorkflowState } = useWorkflowState();

  const [selectedUser, setSelectedUser] = useState<{
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [tabValue, setTabValue] = useState<'send' | 'chance'>('send');

  const currentUserFid = user?.fid || context?.user?.fid || null;
  const deposit = useDepositStatus(currentUserFid);
  const { refresh: refreshDeposit } = deposit;
  const { isConnected } = useAccount();
  const { ensureCorrectNetwork, isSwitching } = useEnsureCorrectNetwork();
  const [connectOpen, setConnectOpen] = useState(false);

  const depositHook = useDepositUsdc({
    fid: currentUserFid ?? null,
    contractAddress: process.env.NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS as `0x${string}`,
    usdcAddress: (deposit.config?.usdcAddress ||
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as `0x${string}`,
    required: deposit.required,
  });

  // Auto-refresh deposit status when deposit completes
  useEffect(() => {
    if (depositHook.isDone) {
      void refreshDeposit();
    }
  }, [depositHook.isDone, refreshDeposit]);

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
      const response = await axios.post('/api/enable-random-winner', {
        username: user.username,
      });

      if (response.data.success) {
        await updateWorkflowState(WorkflowState.CHANCE_ACTIVE, {
          winnerSelectionStart: response.data.winnerSelectionStart,
          currentCastHash: response.data.castHash,
        });

        setIsConfirmOpen(false);

        toast({
          description: '🎲 Random mode enabled: Public sending will be available in 30 minutes',
          priority: MessagePriority.USER_CONTEXT,
        });

        try {
          window.dispatchEvent(
            new CustomEvent('workflow-state-changed', {
              detail: {
                state: WorkflowState.CHANCE_ACTIVE,
                winnerSelectionStart: response.data.winnerSelectionStart,
                currentCastHash: response.data.castHash,
              },
            })
          );
        } catch {}

        onTokenMinted?.();
      } else {
        throw new Error('Failed to enable random winner mode');
      }
    } catch (error) {
      console.error('Error enabling chance mode:', error);
      toast({ description: 'Failed to enable chance mode', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendButtonClick = async () => {
    if (!isConnected) {
      setConnectOpen(true);
      return;
    }
    const ok = await ensureCorrectNetwork();
    if (!ok) return;

    if (!deposit.satisfied) {
      if (depositHook.needsApproval) {
        await depositHook.approve();
      } else {
        await depositHook.deposit();
        await refreshDeposit();
      }
      return;
    }

    await updateWorkflowState(WorkflowState.MANUAL_SEND);
    await handleManualSend();
  };

  const getButtonText = () => {
    if (loading) return 'Sending ChooChoo...';
    if (!isConnected) return 'Connect wallet';
    if (deposit.isLoading) return 'Loading...';
    if (!deposit.satisfied) {
      if (depositHook.isApproving) return 'Approving USDC...';
      if (depositHook.isDepositing || depositHook.isConfirming) return 'Depositing...';
      return 'Deposit 1 USDC';
    }
    return selectedUser ? `Send ChooChoo to @${selectedUser.username}` : 'Send ChooChoo';
  };

  const isButtonDisabled =
    loading ||
    !selectedUser ||
    deposit.isLoading ||
    depositHook.isApproving ||
    depositHook.isDepositing ||
    depositHook.isConfirming ||
    isSwitching;

  // This component only renders in CASTED state - HomePage handles the routing
  // No conditional rendering needed here since HomePage controls when this shows

  return (
    <div className="space-y-6">
      <Card className="p-4 !bg-purple-500 !border-white" style={{ backgroundColor: '#a855f7' }}>
        <div className="space-y-4">
          <div className="text-center">
            <Typography variant="body" className="text-sm !text-white">
              Send ChooChoo to a friend, or leave it to chance.
            </Typography>
          </div>

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
                <Typography variant="body" className="text-xs !text-white text-center">
                  Choose who gets ChooChoo next. Manually sending costs 1 USDC.
                </Typography>

                <Button
                  onClick={handleSendButtonClick}
                  disabled={isButtonDisabled}
                  className="w-full !text-white hover:!text-white !bg-purple-500 !border-2 !border-white"
                  style={{ backgroundColor: '#a855f7' }}
                >
                  {getButtonText()}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="chance">
              <div className="space-y-4 w-full">
                <Typography variant="body" className="text-sm !text-white text-center">
                  Leave ChooChoo&apos;s next stop up to chance.
                  <br />
                  <br />
                  In 30 minutes anyone will be able to select a random reactor to your previous cast
                  to receive ChooChoo. Manual send and yoink each cost 1 USDC.
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
        {/* @todo possibly switch to rainbowkit */}
        <ConnectWalletDialog open={connectOpen} onOpenChange={setConnectOpen} />
      </Card>
    </div>
  );
}
