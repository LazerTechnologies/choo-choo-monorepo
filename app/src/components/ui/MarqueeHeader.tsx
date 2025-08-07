'use client';

import { useEffect, useState } from 'react';
import { useMiniApp } from '@neynar/react';
import { useMarqueeContext } from '@/providers/MarqueeToastProvider';
import { useSoundPlayer } from '@/hooks/useSoundPlayer';
import Marquee from '@/components/base/Marquee';
import { MARQUEE_CONFIG } from '@/lib/constants';

export function MarqueeHeader() {
  const { context } = useMiniApp();
  const [animationKey, setAnimationKey] = useState<number>(() => Date.now());
  const { messages, addUserContext, onMessageComplete, hasEmergencyMessages, newToastAdded } =
    useMarqueeContext();
  const { playChooChoo } = useSoundPlayer();

  // Add user context when user is available
  useEffect(() => {
    if (context?.user) {
      addUserContext(context.user);
    }
  }, [context?.user, addUserContext]);

  // Play sound for new high priority messages
  useEffect(() => {
    if (newToastAdded) {
      playChooChoo({ volume: 0.3 });
      setAnimationKey(Date.now());
    }
  }, [newToastAdded, playChooChoo]);

  const handleItemComplete = (item: string, index: number) => {
    // Find the message by content and index, call onMessageComplete
    onMessageComplete(index);
  };

  // Extract content from all messages for seamless scrolling
  const marqueeItems = messages.map((msg) => msg.content);

  // If no messages, don't render anything
  if (marqueeItems.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 mx-4 mt-2 z-50">
      <Marquee
        key={animationKey}
        items={marqueeItems}
        onItemComplete={handleItemComplete}
        speed={MARQUEE_CONFIG.scrollSpeed}
        emergencyMode={hasEmergencyMessages}
        className="shadow-lg"
      />
    </div>
  );
}
