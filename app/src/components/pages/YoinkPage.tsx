'use client';

import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Typography } from '@/components/base/Typography';
import { useYoinkCountdown } from '@/hooks/useYoinkCountdown';
import { useYoinkFlow } from '@/hooks/useYoinkFlow';
import { useYoinkTimer } from '@/hooks/useYoinkTimer';
import { useCurrentUserAddress } from '@/hooks/useCurrentUserAddress';
import { useNeynarContext } from '@neynar/react';
import { useMiniApp } from '@neynar/react';
import { useEffect, useState } from 'react';
import { useMarqueeToast } from '@/providers/MarqueeToastProvider';
import { useDepositStatus } from '@/hooks/useDepositStatus';
import { useDepositUsdc } from '@/hooks/useDepositUsdc';
import { useWalletClient } from 'wagmi';
import { useEnsureCorrectNetwork } from '@/hooks/useEnsureCorrectNetwork';
import { ConnectWalletDialog } from '@/components/ui/ConnectWalletDialog';
import { useWorkflowState } from '@/hooks/useWorkflowState';
import type { Address } from 'viem';
import { useRouter } from 'next/navigation';
import { useBannedStatus } from '@/hooks/useBannedStatus';

export function YoinkPage() {
  const { user: neynarUser } = useNeynarContext();
  const { context } = useMiniApp();
  const countdownState = useYoinkCountdown();
  const { timerHours } = useYoinkTimer();
  const { address, isLoading: addressLoading, error: addressError } = useCurrentUserAddress();
  const { yoinkTrain, isLoading, isSuccess, isError, error, reset, loadingText } = useYoinkFlow();
  const { toast: marqueeToast } = useMarqueeToast();
  const { refetch: refreshWorkflowState } = useWorkflowState();
  const router = useRouter();

  const currentUserFid = neynarUser?.fid || context?.user?.fid;
  const deposit = useDepositStatus(currentUserFid);
  const { isBanned: userIsBanned, isLoading: isBannedLoading } = useBannedStatus(currentUserFid);
  const { data: walletClient } = useWalletClient();
  const walletConnected = !!walletClient;
  const { ensureCorrectNetwork, isSwitching } = useEnsureCorrectNetwork();
  const [connectOpen, setConnectOpen] = useState(false);
  const depositHook = useDepositUsdc({
    fid: currentUserFid ?? null,
    contractAddress: process.env.NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS as Address,
    usdcAddress: (deposit.config?.usdcAddress ||
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as Address,
    required: deposit.required,
  });

  // Handle success and error states
  useEffect(() => {
    if (isSuccess) {
      console.log('🚩 Nice yoink! You&apos;re now on ChooChoo!');
      try {
        marqueeToast({ description: 'Yoink successful! You are now riding ChooChoo.' });
      } catch {}
      void refreshWorkflowState();
      reset();

      // Redirect to homepage after a short delay
      setTimeout(() => {
        router.push('/');
      }, 1500);
    }
  }, [isSuccess, marqueeToast, reset, refreshWorkflowState, router]);

  useEffect(() => {
    if (isError && error) {
      console.error('Yoink failed:', error);
      try {
        marqueeToast({ description: 'Yoink failed', variant: 'destructive' });
      } catch {}
      reset();
    }
  }, [isError, error, marqueeToast, reset]);

  const handleYoink = async () => {
    if (!address) {
      console.error(
        'No verified Ethereum address found. Please verify an address in your Farcaster profile.',
      );
      return;
    }
    if (!currentUserFid) {
      console.error('Missing user FID. Please re-authenticate with Farcaster.');
      return;
    }

    try {
      console.log(`User FID ${currentUserFid || 'unknown'} is yoinking ChooChoo! 🚂💨`);
      await yoinkTrain(address, Number(currentUserFid));
    } catch (err) {
      console.error('Yoink failed:', err);
    }
  };

  const canYoink =
    countdownState.isAvailable &&
    !addressLoading &&
    address &&
    !isLoading &&
    !deposit.isLoading &&
    deposit.satisfied &&
    !userIsBanned &&
    !isBannedLoading;

  return (
    <div className="space-y-3 px-6 w-full max-w-md mx-auto">
      <Card className="!bg-purple-600 !border-white">
        <Card.Header>
          <Card.Title className="!text-white font-sans">Yoink ChooChoo</Card.Title>
          <Card.Description className="!text-white font-sans">
            If ChooChoo hasn&apos;t moved in {timerHours} {timerHours === 1 ? 'hour' : 'hours'},
            anyone who hasn&apos;t ridden before can pay 1 USDC to become the next passenger.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          {/* Status Display */}
          <div className="bg-purple-700 border border-white rounded-lg p-4 text-center mb-4">
            {isLoading ? (
              <Typography variant="body" className="!text-white font-sans">
                {loadingText}
              </Typography>
            ) : countdownState.isLoading ? (
              <Typography variant="body" className="!text-white font-sans">
                Loading countdown...
              </Typography>
            ) : countdownState.error ? (
              <Typography variant="body" className="!text-red-300 font-sans">
                Error: {countdownState.error}
              </Typography>
            ) : addressLoading ? (
              <Typography variant="body" className="!text-white font-sans">
                Loading your address...
              </Typography>
            ) : addressError ? (
              <Typography variant="body" className="!text-red-300 font-sans">
                Address error: {addressError}
              </Typography>
            ) : !address ? (
              <div>
                <Typography variant="body" className="!text-red-400 font-sans">
                  ⚠️ No verified Ethereum address found
                </Typography>
                <Typography variant="small" className="!text-white font-sans mt-1">
                  FID: {currentUserFid || 'Not found'}
                </Typography>
              </div>
            ) : userIsBanned ? (
              <Typography variant="body" className="!text-red-300 font-sans">
                ⚠️ Access restricted
              </Typography>
            ) : (
              <Typography variant="body" className="!text-white font-sans">
                {countdownState.isAvailable
                  ? '🚂 ChooChoo can be yoinked now!'
                  : `⏱️ Yoink in: ${countdownState.shortFormat}`}
              </Typography>
            )}
          </div>

          {/* How Yoink Works */}
          <div className="space-y-3">
            <Typography variant="h5" className="!text-white font-sans">
              What is Yoinking?
            </Typography>
            <div className="space-y-2">
              <Typography variant="small" className="!text-white font-sans block">
                • The &quot;Yoink&quot; feature prevents ChooChoo from getting stuck with an
                inactive holder
              </Typography>
              <Typography variant="small" className="!text-white font-sans block">
                • Yoink is available {timerHours} {timerHours === 1 ? 'hour' : 'hours'} after the
                last transfer
              </Typography>
              <Typography variant="small" className="!text-blue-300 font-sans-bold block">
                • After yoinking, send a cast from the home page to let everyone know you&apos;re on
                board!
              </Typography>
            </div>
          </div>

          {!address && !addressLoading && (
            <div className="bg-purple-700 border border-white rounded-lg p-3 mb-4 mt-4">
              <Typography variant="small" className="!text-white font-sans">
                💡 You must verify an Ethereum address to participate. Go to{' '}
                <span className="font-bold">Settings → Verified Addresses</span> in Farcaster to add
                one.
              </Typography>
            </div>
          )}

          <Button
            onClick={async () => {
              if (!walletConnected) {
                setConnectOpen(true);
                return;
              }
              if (!address) return;
              const ok = await ensureCorrectNetwork();
              if (!ok) return;

              if (!deposit.satisfied) {
                if (depositHook.needsApproval) {
                  await depositHook.approve();
                } else {
                  await depositHook.deposit();
                  await deposit.refresh();
                }
                return;
              }

              await handleYoink();
            }}
            disabled={
              !countdownState.isAvailable ||
              !address ||
              isLoading ||
              deposit.isLoading ||
              depositHook.isApproving ||
              depositHook.isDepositing ||
              depositHook.isConfirming ||
              isSwitching ||
              userIsBanned ||
              isBannedLoading
            }
            className="w-full mt-4 bg-purple-600 text-white border-white hover:bg-purple-700 disabled:opacity-50"
            variant="default"
          >
            <Typography variant="body" className="!text-white font-sans">
              {userIsBanned
                ? 'Access Restricted'
                : isLoading
                  ? 'Yoinking...'
                  : !walletConnected
                    ? 'Connect wallet'
                    : deposit.isLoading
                      ? 'Loading...'
                      : !deposit.satisfied
                        ? depositHook.isApproving
                          ? 'Approving USDC...'
                          : depositHook.isDepositing || depositHook.isConfirming
                            ? 'Depositing...'
                            : 'Deposit 1 USDC'
                        : !address
                          ? 'Ineligible'
                          : canYoink
                            ? 'Yoink ChooChoo!'
                            : `${countdownState.shortFormat}`}
            </Typography>
          </Button>

          <div className="text-center mt-2">
            <Typography variant="small" className="!text-white">
              Yoinking costs 1 USDC
            </Typography>
          </div>

          {/* @todo switch to rainbowkit if things get funky */}
          <ConnectWalletDialog open={connectOpen} onOpenChange={setConnectOpen} />
        </Card.Content>
      </Card>
    </div>
  );
}
