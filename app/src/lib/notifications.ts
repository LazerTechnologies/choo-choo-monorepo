import { CHOOCHOO_CAST_TEMPLATES, APP_URL } from '@/lib/constants';

export interface NotificationFilters {
  exclude_fids?: number[];
  following_fid?: number;
  minimum_user_score?: number;
  near_location?: {
    latitude: number;
    longitude: number;
    radius?: number;
  };
}

export interface SendNotificationParams {
  title: string;
  body: string;
  targetUrl?: string;
  targetFids?: number[];
  filters?: NotificationFilters;
}

/**
 * Send a notification to mini app users
 */
export async function sendNotification(params: SendNotificationParams): Promise<boolean> {
  try {
    const response = await fetch(`${APP_URL}/api/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to send notification:', error);
      return false;
    }

    const result = await response.json();
    console.log('Notification sent successfully:', result);
    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
}

/**
 * Predefined notification templates for ChooChoo events
 */
export const ChooChooNotifications = {
  /**
   * Notify when ChooChoo arrives in a user's wallet
   */
  chooChooArrived: (username: string, targetFid?: number) => ({
    title: '🚂 ChooChoo Has Arrived!',
    body: `Welcome aboard, ${username}! ChooChoo is now in your wallet. Time to decide where to go next!`,
    targetUrl: `${process.env.NEXT_PUBLIC_URL}/`,
    targetFids: targetFid ? [targetFid] : [],
  }),

  /**
   * Notify when a new journey begins
   */
  journeyBegins: (username: string) => ({
    title: '🚂 All Aboard!',
    body: CHOOCHOO_CAST_TEMPLATES.JOURNEY_BEGINS(username),
    targetUrl: `${process.env.NEXT_PUBLIC_URL}/`,
    targetFids: [], // Send to all users
  }),

  /**
   * Notify when someone yoinks ChooChoo
   */
  yoinkAnnouncement: (username: string) => ({
    title: '🚂 YOINK!',
    body: `${username} is now riding ChooChoo! Watch for their announcement cast - you could be next!`,
    targetUrl: `${process.env.NEXT_PUBLIC_URL}/`,
    targetFids: [], // Send to all users
  }),

  /**
   * Notify when random winner mode is enabled
   */
  randomWinnerEnabled: (username: string) => ({
    title: 'ChooChoo\'s next stop is up to chance!',
    body: `Reply to ${username}\'s cast about ChooChoo for a chance to ride next!`,
    targetUrl: `${process.env.NEXT_PUBLIC_URL}/`,
    targetFids: [], // Send to all users
  }),

  /**
   * Notify when public send mode opens
   */
  publicSendOpen: (username: string) => ({
    title: '🚂 All Aboard',
    body: `The 30-minute timer has expired! Anyone can now trigger ChooChoo to be randomly sent to someone who replied to ${username}'s cast!`,
    targetUrl: `${process.env.NEXT_PUBLIC_URL}/`,
    targetFids: [], // Send to all users
  }),

  /**
   * Notify when a ticket NFT is minted
   */
  ticketMinted: (username: string, tokenId: number, targetFid?: number) => ({
    title: '🎫 Your ChooChoo Ticket!',
    body: `Your ticket #${tokenId} has been minted! Thanks for riding ChooChoo, ${username}!`,
    targetUrl: `${process.env.NEXT_PUBLIC_URL}/`,
    targetFids: targetFid ? [targetFid] : [],
  }),

  /**
   * Notify about maintenance mode
   */
  maintenanceStarted: () => ({
    title: '🚧 ChooChoo Maintenance',
    body: 'ChooChoo has stopped for maintenance. We\'ll be back on the rails soon!',
    targetUrl: `${process.env.NEXT_PUBLIC_URL}/`,
    targetFids: [], // Send to all users
  }),

  /**
   * Notify when maintenance ends
   */
  maintenanceEnded: () => ({
    title: '🚂 Back on Track!',
    body: 'Maintenance complete! ChooChoo is back and ready to continue the journey across Base!',
    targetUrl: `${process.env.NEXT_PUBLIC_URL}/`,
    targetFids: [], // Send to all users
  }),

  /**
   * Notify when yoink becomes available
   */
  yoinkAvailable: (currentHolderUsername: string) => ({
    title: '⏰ YOINK Time!',
    body: `The yoink timer has expired! ChooChoo can now be yoinked from @${currentHolderUsername}. First come, first served!`,
    targetUrl: `${process.env.NEXT_PUBLIC_URL}/yoink`,
    targetFids: [], // Send to all users
  }),
} as const;

/**
 * Helper function to send ChooChoo-specific notifications
 */
export async function sendChooChooNotification(
  notificationType: keyof typeof ChooChooNotifications,
  ...args: unknown[]
): Promise<boolean> {
  const notificationTemplate = ChooChooNotifications[notificationType];
  
  if (typeof notificationTemplate === 'function') {
    const notificationParams = (notificationTemplate as (...args: unknown[]) => SendNotificationParams)(...args);
    return sendNotification(notificationParams);
  }
  
  console.error('Invalid notification type:', notificationType);
  return false;
}
