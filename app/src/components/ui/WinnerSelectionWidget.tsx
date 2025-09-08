'use client';

import { useState, useEffect } from 'react';
import { useNeynarContext } from '@neynar/react';
import { useMiniApp } from '@neynar/react';
import { Card } from '@/components/base/Card';
import { Button } from '@/components/base/Button';
import { Typography } from '@/components/base/Typography';
import { UsernameInput } from './UsernameInput';
import { useMarqueeToast } from '@/providers/MarqueeToastProvider';
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
import { useWorkflowState } from '@/hooks/useWorkflowState';
import { Address } from 'viem';

interface WinnerSelectionWidgetProps {
  onTokenMinted?: () => void;
}

export function WinnerSelectionWidget({ onTokenMinted }: WinnerSelectionWidgetProps) {
  const { toast } = useMarqueeToast();
  const { user } = useNeynarContext();
  const { context } = useMiniApp();
  // Rely on backend to persist workflow state; UI only broadcasts local updates when needed

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
  const { refetch: refreshWorkflowState } = useWorkflowState();
  const { isConnected } = useAccount();
  const { ensureCorrectNetwork, isSwitching } = useEnsureCorrectNetwork();
  const [connectOpen, setConnectOpen] = useState(false);

  const depositHook = useDepositUsdc({
    fid: currentUserFid ?? null,
    contractAddress: process.env.NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS as Address,
    usdcAddress: (deposit.config?.usdcAddress ||
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as Address,
    required: deposit.required,
  });

  // Auto-refresh deposit status and workflow state when deposit completes
  useEffect(() => {
    if (depositHook.isDone) {
      void refreshDeposit();
      void refreshWorkflowState();
    }
  }, [depositHook.isDone, refreshDeposit, refreshWorkflowState]);

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
        void refreshWorkflowState();
        onTokenMinted?.();
      } else {
        throw new Error(response.data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error sending ChooChoo:', error);
      const maybeAxiosError = error as { response?: { status?: number } };
      if (maybeAxiosError?.response?.status === 409) {
        toast({ description: 'Sending in progress…', variant: 'default' });
      } else {
        toast({
          description: 'Failed to send ChooChoo',
          variant: 'destructive',
        });
      }
      // UI will refresh workflow state from server
    } finally {
      setLoading(false);
    }
  };

  const confirmEnableChance = async () => {
    console.log('🎲 confirmEnableChance called');

    if (!currentUserFid) {
      console.log('🎲 No FID found, showing error toast');
      toast({ description: 'User not authenticated', variant: 'destructive' });
      return;
    }

    console.log('🎲 Starting API call to /api/enable-random-winner with FID:', currentUserFid);
    setLoading(true);
    try {
      const response = await axios.post('/api/enable-random-winner', {
        fid: currentUserFid,
      });
      console.log('🎲 API response:', response.data);

      if (response.data.success) {
        setIsConfirmOpen(false);

        toast({
          description: '🎲 Random mode enabled: Public sending will be available in 30 minutes',
          priority: MessagePriority.USER_CONTEXT,
        });

        void refreshWorkflowState();

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
      try {
        if (depositHook.needsApproval) {
          // @note changed to not go straight to deposit after approval, require explicit click. look at adding Daimo and making this process smoother
          await depositHook.approve();
        } else {
          // approval done, go to deposit
          await depositHook.deposit();
          await refreshDeposit();
        }
      } catch (error) {
        console.error('Deposit flow error:', error);
      }
      return;
    }

    // Broadcast local UI state only; backend orchestrator handles persistence
    try {
      window.dispatchEvent(
        new CustomEvent('workflow-state-changed', {
          detail: { state: WorkflowState.MANUAL_SEND },
        })
      );
    } catch {}
    await handleManualSend();
  };

  const getCurrentStep = () => {
    if (loading) return { step: 3, label: 'Sending ChooChoo...' };
    if (!deposit.satisfied) {
      if (depositHook.isApproving) return { step: 1, label: 'Approving...' };
      if (depositHook.isDepositing || depositHook.isConfirming)
        return { step: 2, label: 'Depositing...' };
      if (depositHook.needsApproval) return { step: 1, label: 'Ready to approve' };
      return { step: 2, label: 'Ready to deposit' };
    }
    return { step: 3, label: 'Ready to send' };
  };

  const getButtonText = () => {
    if (loading) return 'Sending ChooChoo...';
    if (!isConnected) return 'Connect wallet';
    if (deposit.isLoading) return 'Loading...';
    if (!deposit.satisfied) {
      if (depositHook.isApproving) return 'Approving USDC...';
      if (depositHook.isDepositing || depositHook.isConfirming) return 'Depositing...';
      if (depositHook.needsApproval) return 'Approve USDC';
      return 'Deposit 1 USDC';
    }
    return selectedUser ? `Send ChooChoo to @${selectedUser.username}` : 'Send ChooChoo';
  };

  const shouldPulse = () => {
    // Pulse when approval is confirmed and ready to deposit
    if (
      !deposit.satisfied &&
      !depositHook.needsApproval &&
      !depositHook.isDepositing &&
      !depositHook.isConfirming
    ) {
      return true;
    }
    // Pulse when deposit is confirmed and ready to send
    if (deposit.satisfied && selectedUser && !loading) {
      return true;
    }
    return false;
  };

  const isButtonDisabled =
    loading ||
    deposit.isLoading ||
    depositHook.isApproving ||
    depositHook.isDepositing ||
    depositHook.isConfirming ||
    isSwitching ||
    // @note changed to only require selectedUser for the final send step
    (deposit.satisfied && !selectedUser);

  // @dev component only renders in CASTED state - HomePage handles the routing
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

                {/* Step indicator */}
                {isConnected && !deposit.isLoading && (
                  <div className="flex items-center justify-center space-x-2 text-xs !text-white">
                    <div className="flex items-center space-x-1">
                      <div
                        className={`w-2 h-2 rounded-full ${getCurrentStep().step >= 1 ? 'bg-white' : 'bg-white/30'}`}
                      />
                      <span className={getCurrentStep().step === 1 ? 'font-medium' : 'opacity-60'}>
                        1/3 Approve
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div
                        className={`w-2 h-2 rounded-full ${getCurrentStep().step >= 2 ? 'bg-white' : 'bg-white/30'}`}
                      />
                      <span className={getCurrentStep().step === 2 ? 'font-medium' : 'opacity-60'}>
                        2/3 Deposit
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div
                        className={`w-2 h-2 rounded-full ${getCurrentStep().step >= 3 ? 'bg-white' : 'bg-white/30'}`}
                      />
                      <span className={getCurrentStep().step === 3 ? 'font-medium' : 'opacity-60'}>
                        3/3 Send
                      </span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleSendButtonClick}
                  disabled={isButtonDisabled}
                  className={`w-full !text-white hover:!text-white !bg-purple-500 !border-2 !border-white ${
                    shouldPulse() ? 'animate-pulse' : ''
                  }`}
                  style={{ backgroundColor: '#a855f7' }}
                >
                  {getButtonText()}
                </Button>

                {/* Confirmation caption that appears after deposit */}
                {deposit.satisfied && !loading && (
                  <Typography
                    variant="body"
                    className="text-xs !text-white text-center animate-fade-in"
                  >
                    ✅ Deposit confirmed!
                  </Typography>
                )}
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
                        In 30 minutes anyone will be able to select a random reactor to your
                        previous cast to receive ChooChoo. Leave it up to chance?
                      </Typography>
                      <Typography
                        variant="body"
                        className="!text-white text-center text-sm opacity-80"
                      >
                        This will disable manual sending
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
                          onClick={() => {
                            console.log('🎲 Confirm button clicked, loading state:', loading);
                            confirmEnableChance();
                          }}
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
