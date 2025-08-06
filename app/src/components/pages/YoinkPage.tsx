'use client';

import { Button } from '@/components/base/Button';
import { Card } from '@/components/base/Card';
import { Typography } from '@/components/base/Typography';
import { useYoinkCountdown } from '@/hooks/useYoinkCountdown';

export function YoinkPage() {
  const countdownState = useYoinkCountdown();

  const handleYoink = () => {
    // @todo: implement `api/yoink` which should update all of the redis data just like the `api/send-train` route, but it goes to the caller's wallet and call the ChooChooTrain.yoink() function on the contract via the admin wallet, sending the ticket NFT to the person it was yoinked from
    // @todo: update the ChooChooTrain.yoink() function to only be callable by people who haven't held the train before, and use a global 48 hour cooldown
    // @todo: similar to how the CurrentHolderItem triggers a toast when the current holder changes, add one that says "{username} is yoinking ChooChoo!" at the start of the process, then another toast once the current holder changes (should trigger automatically).
    console.log('Yoink initiated!');
  };

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
          {/* Countdown Display */}
          <div className="bg-purple-700 border border-white rounded-lg p-4 text-center mb-4">
            {countdownState.isLoading ? (
              <Typography variant="body" className="!text-white font-comic">
                Loading countdown...
              </Typography>
            ) : countdownState.error ? (
              <Typography variant="body" className="!text-red-300 font-comic">
                Error: {countdownState.error}
              </Typography>
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
            <Typography variant="small" className="!text-white font-comic">
              • If ChooChoo is stuck with an inactive holder, anyone who hasn&apos;t ridden the
              train before can hop aboard and become the next passenger
            </Typography>
            <Typography variant="small" className="!text-white font-comic">
              • ChooChoo can be yoinked 48 hours after he last moved
            </Typography>
            <Typography variant="small" className="!text-blue-300 font-comic-bold">
              • After yoinking, don&apos;t forget to send a cast from the home page to let everyone
              know you&apos;re on board!
            </Typography>
          </div>

          <Button
            onClick={handleYoink}
            disabled={!countdownState.isAvailable}
            className="w-full mt-4 bg-purple-600 text-white border-white hover:bg-purple-700"
            variant="default"
          >
            <Typography variant="body" className="!text-white font-comic">
              {countdownState.isAvailable ? 'Yoink ChooChoo!' : 'Not Available Yet'}
            </Typography>
          </Button>
        </Card.Content>
      </Card>
    </div>
  );
}
