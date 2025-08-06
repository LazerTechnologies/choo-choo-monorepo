'use client';

import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Typography } from '@/components/base/Typography';
import { useYoinkCountdown } from '@/hooks/useYoinkCountdown';
import { useYoinkFlow } from '@/hooks/useYoinkFlow';
import { useCurrentUserAddress } from '@/hooks/useCurrentUserAddress';
import { useNeynarContext } from '@neynar/react';
import { useMiniApp } from '@neynar/react';
import { useEffect } from 'react';

export function YoinkPage() {
  const { user: neynarUser } = useNeynarContext();
  const { context } = useMiniApp();
  const countdownState = useYoinkCountdown();
  const { address, isLoading: addressLoading, error: addressError } = useCurrentUserAddress();
  const { yoinkTrain, isLoading, isSuccess, isError, error, reset, loadingText } = useYoinkFlow();

  const currentUserFid = neynarUser?.fid || context?.user?.fid;

  // Handle success and error states
  useEffect(() => {
    if (isSuccess) {
      console.log('🚩 You yoinker! You&apos;re now on ChooChoo!');
      reset();
    }
  }, [isSuccess, reset]);

  useEffect(() => {
    if (isError && error) {
      console.error('Yoink failed:', error);
      reset();
    }
  }, [isError, error, reset]);

  const handleYoink = async () => {
    if (!address) {
      console.error(
        'No verified Ethereum address found. Please verify an address in your Farcaster profile.'
      );
      return;
    }

    try {
      console.log(`User FID ${currentUserFid || 'unknown'} is yoinking ChooChoo! 🚂💨`);
      await yoinkTrain(address);
    } catch (err) {
      console.error('Yoink failed:', err);
    }
  };

  const canYoink = countdownState.isAvailable && !addressLoading && address && !isLoading;

  return (
    <div className="space-y-3 px-6 w-full max-w-md mx-auto">
      <Typography variant="h2" className="text-center mb-6 text-white font-comic">
        Yoink ChooChoo
      </Typography>

      <Card className="!bg-purple-600 !border-white">
        <Card.Header>
          <Card.Title className="!text-white font-comic">Rescue ChooChoo</Card.Title>
          <Card.Description className="!text-white font-comic">
            If ChooChoo gets stuck, and you haven&apos;t held the train before, you can yoink it to
            safety and become the next passenger!
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
                  : `🚂 ChooChoo can be yoinked in: ${countdownState.clockFormat}`}
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
            <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-3 mb-4">
              <Typography variant="small" className="!text-yellow-800 font-comic">
                💡 To yoink ChooChoo, you need a verified Ethereum address in your Farcaster
                profile. Go to Settings → Verified Addresses in the Farcaster app to add one.
              </Typography>
            </div>
          )}

          <Button
            onClick={handleYoink}
            disabled={!canYoink}
            className="w-full mt-4 bg-purple-600 text-white border-white hover:bg-purple-700 disabled:opacity-50"
            variant="default"
          >
            <Typography variant="body" className="!text-white font-comic">
              {isLoading
                ? 'Yoinking...'
                : !address
                  ? 'Need Verified Address'
                  : canYoink
                    ? 'Yoink ChooChoo!'
                    : 'Not Available Yet'}
            </Typography>
          </Button>
        </Card.Content>
      </Card>
    </div>
  );
}
