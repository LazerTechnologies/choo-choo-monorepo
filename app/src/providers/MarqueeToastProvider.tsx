'use client';

import type React from 'react';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { MessagePriority, MARQUEE_CONFIG, TRAIN_STATION_MESSAGES } from '@/lib/constants';

interface MarqueeMessage {
  id: string;
  content: string;
  type: 'standard' | 'toast' | 'user-context';
  priority: MessagePriority;
  scrollCycles?: number;
  expiresAt?: number;
  createdAt: number;
}

interface MarqueeContextType {
  messages: MarqueeMessage[];
  addToastMessage: (message: string, priority?: MessagePriority) => void;
  addUserContext: (user: User) => void;
  clearToasts: () => void;
  onMessageComplete: (index: number) => void;
  hasEmergencyMessages: boolean;
  newToastAdded: MarqueeMessage | null;
}

interface User {
  fid: number;
  username?: string;
  displayName?: string;
}

const MarqueeContext = createContext<MarqueeContextType | undefined>(undefined);

let messageIdCounter = 0;
const generateId = () => `msg_${++messageIdCounter}_${Date.now()}`;

const generateUserContextMessages = (user: User): string[] => [
  `👋 Welcome aboard, ${user.displayName || user.username}!`,
  `🆔 Passenger ${user.username || ''} (FID: ${user.fid})`,
  `🎫 Current ticket holder: ${user.displayName || user.username}`,
];

export function MarqueeToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<MarqueeMessage[]>([]);
  const [messageCycleCounts, setMessageCycleCounts] = useState<Map<string, number>>(new Map());
  const [newToastAdded, setNewToastAdded] = useState<MarqueeMessage | null>(null);

  // Initialize with standard messages
  useEffect(() => {
    const shuffled = [...TRAIN_STATION_MESSAGES].sort(() => Math.random() - 0.5);
    const standardMessages: MarqueeMessage[] = shuffled.map((content, index) => ({
      id: `standard_${index}`,
      content,
      type: 'standard' as const,
      priority: MessagePriority.STANDARD,
      createdAt: Date.now(),
    }));
    setMessages(standardMessages);
  }, []);

  // Clean up expired messages and reset newToastAdded
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setMessages((prevMessages) => {
        const filteredMessages = prevMessages.filter((msg) => {
          // Remove expired toast messages
          if (msg.type === 'toast' && msg.expiresAt && now > msg.expiresAt) {
            return false;
          }
          // Remove toast messages that have completed their cycles
          if (msg.type === 'toast' && msg.scrollCycles) {
            const cycleCount = messageCycleCounts.get(msg.id) || 0;
            if (cycleCount >= msg.scrollCycles) {
              return false;
            }
          }
          return true;
        });

        return filteredMessages;
      });

      // Reset newToastAdded after a delay
      setNewToastAdded(null);
    }, 1000);

    return () => clearInterval(interval);
  }, [messageCycleCounts]);

  const addToastMessage = useCallback(
    (message: string, priority: MessagePriority = MessagePriority.TOAST) => {
      const urgentMessage: MarqueeMessage = {
        id: generateId(),
        content: priority === MessagePriority.EMERGENCY ? `🚨🚨 ${message} 🚨🚨` : `🔔 ${message}`,
        type: 'toast',
        priority,
        scrollCycles: 1,
        expiresAt: Date.now() + MARQUEE_CONFIG.maxToastAge,
        createdAt: Date.now(),
      };

      const urgentDuplicate: MarqueeMessage = {
        ...urgentMessage,
        id: generateId(),
      };

      setMessages((prevMessages) => [urgentMessage, urgentDuplicate, ...prevMessages]);

      // Mark this as a new toast for sound triggering
      if (priority <= MessagePriority.TOAST) {
        setNewToastAdded(urgentMessage);
      }
    },
    [],
  );

  const addUserContext = useCallback((user: User) => {
    const userMessages = generateUserContextMessages(user);
    const userContextMessages: MarqueeMessage[] = userMessages.map((content, index) => ({
      id: generateId(),
      content,
      type: 'user-context',
      priority: MessagePriority.USER_CONTEXT,
      createdAt: Date.now() + index, // Slight delay for ordering
    }));

    setMessages((prevMessages) => {
      // Remove old user context messages and add new ones at the end
      const nonUserContext = prevMessages.filter((msg) => msg.type !== 'user-context');
      return [...nonUserContext, ...userContextMessages];
    });
  }, []);

  const clearToasts = useCallback(() => {
    setMessages((prevMessages) => prevMessages.filter((msg) => msg.type === 'standard'));
    setMessageCycleCounts(new Map());
  }, []);

  const onMessageComplete = useCallback(
    (index: number) => {
      const message = messages[index];
      if (message && message.type === 'toast') {
        setMessageCycleCounts((prevCounts) => {
          const newCounts = new Map(prevCounts);
          const currentCount = newCounts.get(message.id) || 0;
          newCounts.set(message.id, currentCount + 1);
          return newCounts;
        });
      }
    },
    [messages],
  );

  // Check if there are emergency messages
  const hasEmergencyMessages = messages.some((msg) => msg.priority === MessagePriority.EMERGENCY);

  const contextValue: MarqueeContextType = {
    messages,
    addToastMessage,
    addUserContext,
    clearToasts,
    onMessageComplete,
    hasEmergencyMessages,
    newToastAdded,
  };

  return <MarqueeContext.Provider value={contextValue}>{children}</MarqueeContext.Provider>;
}

export function useMarqueeContext(): MarqueeContextType {
  const context = useContext(MarqueeContext);
  if (context === undefined) {
    throw new Error('useMarqueeContext must be used within a MarqueeToastProvider');
  }
  return context;
}

export function useMarqueeToast() {
  const { addToastMessage } = useMarqueeContext();

  return {
    toast: ({
      description,
      priority,
      variant,
    }: {
      description: string;
      priority?: MessagePriority;
      variant?: 'default' | 'destructive';
    }) => {
      // Map variant to priority if priority not explicitly set
      let finalPriority = priority;
      if (!priority) {
        if (variant === 'destructive') {
          finalPriority = MessagePriority.EMERGENCY;
        } else {
          finalPriority = MessagePriority.TOAST;
        }
      }

      addToastMessage(description, finalPriority);
    },
  };
}
