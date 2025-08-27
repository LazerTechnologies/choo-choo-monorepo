'use client';

import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Typography } from '@/components/base/Typography';
import { useYoinkCountdown } from '@/hooks/useYoinkCountdown';
import { useYoinkFlow } from '@/hooks/useYoinkFlow';
import { useCurrentUserAddress } from '@/hooks/useCurrentUserAddress';
import { useNeynarContext } from '@neynar/react';
import { useMiniApp } from '@neynar/react';
import { useEffect, useState } from 'react';
import { useMarqueeToast } from '@/providers/MarqueeToastProvider';
import { useDepositStatus } from '@/hooks/useDepositStatus';
import { useDepositUsdc } from '@/hooks/useDepositUsdc';
import { useAccount, useSwitchChain } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { ConnectWalletDialog } from '@/components/ui/ConnectWalletDialog';

export function YoinkPage() {
  const { user: neynarUser } = useNeynarContext();
  const { context } = useMiniApp();
  const countdownState = useYoinkCountdown();
  const { address, isLoading: addressLoading, error: addressError } = useCurrentUserAddress();
  const { yoinkTrain, isLoading, isSuccess, isError, error, reset, loadingText } = useYoinkFlow();
  const { toast: marqueeToast } = useMarqueeToast();

  const currentUserFid = neynarUser?.fid || context?.user?.fid;
  const deposit = useDepositStatus(currentUserFid);
  const { isConnected } = useAccount();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const [connectOpen, setConnectOpen] = useState(false);
  const depositHook = useDepositUsdc({
    fid: currentUserFid ?? null,
    contractAddress: process.env.NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS as `0x${string}`,
    usdcAddress: (deposit.config?.usdcAddress ||
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as `0x${string}`,
    required: deposit.required,
  });

  // Handle success and error states
  useEffect(() => {
    if (isSuccess) {
      console.log('🚩 Nice yoink! You&apos;re now on ChooChoo!');
      try {
        marqueeToast({ description: 'Yoink successful! You are now riding ChooChoo.' });
      } catch {}
      reset();
    }
  }, [isSuccess, marqueeToast, reset]);

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
        'No verified Ethereum address found. Please verify an address in your Farcaster profile.'
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
    deposit.satisfied;

  return (
    <div className="space-y-3 px-6 w-full max-w-md mx-auto">
      <Card className="!bg-purple-600 !border-white">
        <Card.Header>
          <Card.Title className="!text-white font-comic">Yoink ChooChoo</Card.Title>
          <Card.Description className="!text-white font-comic">
            If ChooChoo hasn&apos;t moved in 48 hours, anyone who hasn&apos;t ridden before can hop
            aboard and become the next passenger. Yoinking costs 1 USDC.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          {/* Status Display */}
          <div className="bg-purple-700 border border-white rounded-lg p-4 text-center mb-4">
            {isLoading ? (
              <Typography variant="body" className="!text-white font-comic">
                {loadingText}
              </Typography>
            ) : countdownState.isLoading ? (
              <Typography variant="body" className="!text-white font-comic">
                Loading countdown...
              </Typography>
            ) : countdownState.error ? (
              <Typography variant="body" className="!text-red-300 font-comic">
                Error: {countdownState.error}
              </Typography>
            ) : addressLoading ? (
              <Typography variant="body" className="!text-white font-comic">
                Loading your address...
              </Typography>
            ) : addressError ? (
              <Typography variant="body" className="!text-red-300 font-comic">
                Address error: {addressError}
              </Typography>
            ) : !address ? (
              <div>
                <Typography variant="body" className="!text-yellow-300 font-comic">
                  ⚠️ No verified Ethereum address found
                </Typography>
                <Typography variant="small" className="!text-white font-comic mt-1">
                  FID: {currentUserFid || 'Not found'}
                </Typography>
              </div>
            ) : (
              <Typography variant="body" className="!text-white font-comic">
                {countdownState.isAvailable
                  ? '🚂 ChooChoo can be yoinked now!'
                  : `⏱️ ChooChoo can be yoinked in: ${countdownState.clockFormat}`}
              </Typography>
            )}
          </div>

          {/* How Yoink Works */}
          <div className="space-y-3">
            <Typography variant="h5" className="!text-white font-comic">
              What is Yoinking?
            </Typography>
            <div className="space-y-2">
              <Typography variant="small" className="!text-white font-comic block">
                • If ChooChoo is stuck with an inactive holder, anyone who hasn&apos;t ridden the
                train before can hop aboard and become the next passenger
              </Typography>
              <Typography variant="small" className="!text-white font-comic block">
                • ChooChoo can be yoinked 48 hours after he last moved
              </Typography>
              <Typography variant="small" className="!text-blue-300 font-comic-bold block">
                • After yoinking, don&apos;t forget to send a cast from the home page to let
                everyone know you&apos;re on board!
              </Typography>
            </div>
          </div>

          {!address && !addressLoading && (
            <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-3 mb-4 mt-4">
              <Typography variant="small" className="!text-yellow-800 font-comic">
                💡 You must verify an Ethereum address to participate. Go to{' '}
                <span className="font-bold">Settings → Verified Addresses</span> in Farcaster to add
                one.
              </Typography>
            </div>
          )}

          <Button
            onClick={async () => {
              if (!address) return;
              if (!isConnected) {
                setConnectOpen(true);
                return;
              }
              try {
                const useMainnet = process.env.NEXT_PUBLIC_USE_MAINNET === 'true';
                await switchChainAsync({ chainId: useMainnet ? base.id : baseSepolia.id });
              } catch {
                return; // Do not proceed on wrong network
              }

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
              isSwitching
            }
            className="w-full mt-4 bg-purple-600 text-white border-white hover:bg-purple-700 disabled:opacity-50"
            variant="default"
          >
            <Typography variant="body" className="!text-white font-comic">
              {isLoading
                ? 'Yoinking...'
                : !isConnected
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
                          : 'Please wait...'}
            </Typography>
          </Button>

          <Typography variant="small" className="text-center !text-white mt-2">
            Yoinking costs 1 USDC
          </Typography>

          {/* @todo possibly switch to rainbowkit */}
          <ConnectWalletDialog open={connectOpen} onOpenChange={setConnectOpen} />
        </Card.Content>
      </Card>
    </div>
  );
}
