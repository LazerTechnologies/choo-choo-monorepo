'use client';

import { useState, useEffect } from 'react';
import { Dialog } from '@/components/base/Dialog';
import { Button } from '@/components/base/Button';
import { getYoinkCountdownState } from '@/utils/countdown';

interface YoinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// @todo: add a yoink timer
export function YoinkDialog({ isOpen, onClose }: YoinkDialogProps) {
  const [countdownState, setCountdownState] = useState(() => getYoinkCountdownState());

  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownState(getYoinkCountdownState());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleYoink = () => {
    // TODO: Implement yoink logic
    console.log('Yoink initiated!');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <Dialog.Content
        size="lg"
        title="Yoink the Train"
        description="Rescue Choo-Choo if it gets stuck"
        className="rounded-lg p-0 bg-background"
        style={{ background: 'var(--background)' }}
      >
        <Dialog.Header className="text-white">
          <div className="flex items-center gap-2"></div>
        </Dialog.Header>

        <div className="p-6 space-y-4">
          {/* Countdown Display */}
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {countdownState.isAvailable
                ? '🚂 Choo-Choo can be yoinked now!'
                : `🚂 Choo-Choo can be yoinked in: ${countdownState.shortFormat}`}
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              What if Choo-Choo goes to a dead wallet?
            </h3>

            <p className="text-gray-700 dark:text-gray-300">
              If the train gets stuck, anyone can &quot;yoink&quot; the train after 2 days of no
              movement:
            </p>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">⏰</span>
                <span className="font-medium text-green-800 dark:text-green-200">
                  After 2 days of no movement
                </span>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300 ml-7">
                Anyone can yoink the train to their wallet
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🎫</span>
                <span className="font-medium text-blue-800 dark:text-blue-200">
                  What happens when you yoink?
                </span>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                You&apos;ll rescue Choo-Choo and it will move directly to your wallet! You&apos;ll
                become the new conductor and be able to send it on its next adventure.
              </p>
            </div>
          </div>
        </div>

        <Dialog.Footer>
          <Button onClick={onClose} variant="outline" className="mr-2">
            Cancel
          </Button>
          <Button
            onClick={handleYoink}
            disabled={!countdownState.isAvailable}
            className={`${
              countdownState.isAvailable
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-gray-400 cursor-not-allowed text-gray-600'
            }`}
          >
            {countdownState.isAvailable ? '🏁' : '🕑'}{' '}
            {countdownState.isAvailable
              ? 'Yoink the Train!'
              : `Available in ${countdownState.shortFormat}`}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
