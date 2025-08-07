'use client';

import { useMarqueeToast } from '@/providers/MarqueeToastProvider';
import { MessagePriority } from '@/lib/constants';
import { Button } from '@/components/base/Button';

const HIGH_PRIORITY_TEST_MESSAGES = [
  'Emergency brakes engaged! 🚨',
  'Train has derailed at Platform 3! 💥',
  'All aboard! ChooChoo is departing NOW! 🚂',
  'URGENT: Conductor missing! 👮‍♂️',
  'Station on fire! Please evacuate! 🔥',
  'Mystery package found on train! 📦',
  'ChooChoo has gone rogue! 🤖',
  'ALERT: Cows detected on tracks! 🐄',
  'Signal failure at junction! ⚡',
  'Emergency chocolate shortage! 🍫',
  'Train traveling backwards! Help! ↩️',
  'Platform flooding detected! 🌊',
];

export function MarqueeTestButtons() {
  const { toast } = useMarqueeToast();

  const testRegularToast = () => {
    toast({
      description: 'Regular toast notification test! 📢',
    });
  };

  const testEmergencyToast = () => {
    toast({
      description: 'EMERGENCY: Train derailed! 🚨',
      variant: 'destructive',
    });
  };

  const testSuccessToast = () => {
    toast({
      description: 'ChooChoo successfully delivered! ✅',
    });
  };

  const testRandomHighPriority = () => {
    const randomMessage =
      HIGH_PRIORITY_TEST_MESSAGES[Math.floor(Math.random() * HIGH_PRIORITY_TEST_MESSAGES.length)];

    // Randomly choose between emergency and regular high priority
    const isEmergency = Math.random() > 0.5;

    toast({
      description: randomMessage,
      priority: isEmergency ? MessagePriority.EMERGENCY : MessagePriority.TOAST,
    });
  };

  return (
    <div className="flex flex-col gap-2 p-4 bg-purple-600 rounded-lg border-2 border-white">
      <h3 className="text-white font-bold text-center">Marquee Test Controls</h3>
      <Button onClick={testRegularToast} variant="outline" size="sm">
        Test Regular Toast
      </Button>
      <Button onClick={testEmergencyToast} variant="outline" size="sm">
        Test Emergency Toast
      </Button>
      <Button onClick={testSuccessToast} variant="outline" size="sm">
        Test Success Toast
      </Button>
      <Button
        onClick={testRandomHighPriority}
        variant="secondary"
        size="sm"
        className="bg-orange-500 hover:bg-orange-600 text-white border-white"
      >
        🎲 Random High Priority!
      </Button>
    </div>
  );
}
