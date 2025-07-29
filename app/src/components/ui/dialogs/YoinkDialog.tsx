'use client';

import { Dialog } from '@/components/base/Dialog';
import { Button } from '@/components/base/Button';

interface YoinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
}
// @todo: add a yoink timer
export function YoinkDialog({ isOpen, onClose }: YoinkDialogProps) {
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
        <Dialog.Header className="bg-red-500 text-white">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚩</span>
            <h2 className="text-lg font-bold">Yoink Choo-Choo!</h2>
          </div>
        </Dialog.Header>

        <div className="p-6 space-y-4">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              What if Choo-Choo goes to a dead wallet?
            </h3>

            <p className="text-gray-700 dark:text-gray-300">
              {/* @todo: add specific times */}
              If the train gets stuck, previous passengers can &quot;yoink&quot; the train after a
              certain time:
            </p>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">⏰</span>
                <span className="font-medium text-yellow-800 dark:text-yellow-200">
                  After 2 days of no movement
                </span>
              </div>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 ml-7">
                The immediate previous passenger can yoink the train
              </p>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">⏰</span>
                <span className="font-medium text-orange-800 dark:text-orange-200">
                  After 3 days of no movement
                </span>
              </div>
              <p className="text-sm text-orange-700 dark:text-orange-300 ml-7">
                Any previous passenger can yoink the train
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
                You&apos;ll rescue Choo-Choo and become the new conductor! The train will move to
                your wallet, and you&apos;ll be able to send it on its next adventure.
              </p>
            </div>
          </div>
        </div>

        <Dialog.Footer>
          <Button onClick={onClose} variant="outline" className="mr-2">
            Cancel
          </Button>
          <Button onClick={handleYoink} className="bg-red-500 hover:bg-red-600 text-white">
            🚩 Yoink the Train!
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
