'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface MarqueeProps {
  items: string[];
  onItemComplete?: (item: string, index: number) => void;
  speed?: number; // pixels per second
  className?: string;
  itemClassName?: string;
  emergencyMode?: boolean; // For slowing down important messages
}

export default function Marquee({
  items,
  onItemComplete,
  speed = 50,
  className = '',
  itemClassName = '',
  emergencyMode = false,
}: MarqueeProps) {
  const [currentItems, setCurrentItems] = useState<string[]>(items);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const currentItemIndexRef = useRef(0);
  const lastCompletedIndexRef = useRef(-1);

  // Update items when props change
  useEffect(() => {
    setCurrentItems(items);
  }, [items]);

  // Measure container width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Calculate animation duration based on speed
  const animationDuration = containerWidth > 0 ? containerWidth / speed : 10;
  const adjustedDuration = emergencyMode ? animationDuration * 1.5 : animationDuration; // Slow down for emergencies

  // Track animation cycles and call onItemComplete
  const trackItemCompletion = useCallback(() => {
    if (onItemComplete && currentItems.length > 0) {
      const currentIndex = currentItemIndexRef.current;

      // Only call completion once per item per cycle
      if (currentIndex !== lastCompletedIndexRef.current) {
        const item = currentItems[currentIndex];
        if (item) {
          onItemComplete(item, currentIndex);
          lastCompletedIndexRef.current = currentIndex;
        }
      }

      // Move to next item
      currentItemIndexRef.current = (currentIndex + 1) % currentItems.length;
    }
  }, [currentItems, onItemComplete]);

  // Handle animation end events
  useEffect(() => {
    const handleAnimationIteration = () => {
      trackItemCompletion();
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('animationiteration', handleAnimationIteration);
      return () => container.removeEventListener('animationiteration', handleAnimationIteration);
    }
  }, [trackItemCompletion]);

  if (currentItems.length === 0) {
    return null;
  }

  const baseClasses =
    'relative flex w-full overflow-x-hidden bg-gradient-to-r from-purple-500 via-purple-600 to-purple-500 text-white font-mono text-sm font-bold uppercase tracking-wide border-2 border-white';
  const itemClasses = 'mx-4 whitespace-nowrap';

  return (
    <div
      ref={containerRef}
      className={`${baseClasses} ${className}`}
      style={{
        background: 'linear-gradient(90deg, #a855f7, #9333ea, #a855f7)',
      }}
    >
      <div
        className="animate-marquee py-3 flex whitespace-nowrap"
        style={{
          animationDuration: `${adjustedDuration}s`,
        }}
      >
        {currentItems.map((item, index) => (
          <span key={`${item}_${index}_1`} className={`${itemClasses} ${itemClassName}`}>
            {item}
          </span>
        ))}
      </div>

      <div
        className="absolute top-0 animate-marquee2 py-3 flex whitespace-nowrap"
        style={{
          animationDuration: `${adjustedDuration}s`,
        }}
      >
        {currentItems.map((item, index) => (
          <span key={`${item}_${index}_2`} className={`${itemClasses} ${itemClassName}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
