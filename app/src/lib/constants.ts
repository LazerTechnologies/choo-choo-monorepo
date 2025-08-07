export const APP_URL = process.env.NEXT_PUBLIC_URL!;
export const APP_NAME = process.env.NEXT_PUBLIC_MINI_APP_NAME;
export const APP_DESCRIPTION = process.env.NEXT_PUBLIC_MINI_APP_DESCRIPTION;
export const APP_PRIMARY_CATEGORY = process.env.NEXT_PUBLIC_MINI_APP_PRIMARY_CATEGORY;
export const APP_TAGS = process.env.NEXT_PUBLIC_MINI_APP_TAGS?.split(',');
export const APP_ICON_URL = `${APP_URL}/icon.png`;
export const APP_OG_IMAGE_URL = `${APP_URL}/api/opengraph-image`;
export const APP_SPLASH_URL = `${APP_URL}/splash.png`;
export const APP_SPLASH_BACKGROUND_COLOR = '#f7f7f7';
export const APP_BUTTON_TEXT = process.env.NEXT_PUBLIC_MINI_APP_BUTTON_TEXT;
export const APP_WEBHOOK_URL =
  process.env.NEYNAR_API_KEY && process.env.NEYNAR_CLIENT_ID
    ? `https://api.neynar.com/f/app/${process.env.NEYNAR_CLIENT_ID}/event`
    : `${APP_URL}/api/webhook`;
export const USE_WALLET = process.env.NEXT_PUBLIC_USE_WALLET === 'true';

// Admin FIDs for administrative functions
export const ADMIN_FIDS = process.env.ADMIN_FIDS
  ? process.env.ADMIN_FIDS.split(',').map((fid) => parseInt(fid.trim(), 10))
  : [377557, 2802, 243300];
export const CHOOCHOO_TRAIN_ADDRESS = (() => {
  const address = process.env.NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS;
  if (!address) {
    throw new Error('NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS environment variable is required');
  }
  return address as `0x${string}`;
})();

// ChooChoo Train Metadata
export const CHOOCHOO_TRAIN_METADATA_URI = process.env.NEXT_PUBLIC_CHOOCHOO_TRAIN_METADATA_URI;

// ChooChoo Cast Templates
export const CHOOCHOO_CAST_TEMPLATES = {
  // [@choochoo] Cast sent to previous holder when their ticket is minted
  TICKET_ISSUED: (previousHolderUsername: string, tokenId: number) =>
    `🎫 Ticket #${tokenId} has been minted by the conductor and delivered to @${previousHolderUsername} to commemorate their ride. All aboard for the next stop!`,

  // [@choochoo] Generic journey announcement
  JOURNEY_CONTINUES: () =>
    `🚂 The ChooChoo journey continues across Base! 🔵\n\n` +
    `Every stop is a new adventure, every passenger gets a unique ticket NFT. ` +
    `Where will ChooChoo go next?\n\n` +
    `Join the ride by replying to cast announcements! 🚋`,

  // [@choochoo] Sent to new passenger when they get ChooChoo
  WELCOME_PASSENGER: (username: string) =>
    `🚂 Welcome aboard, @${username}! 🎫\n\n` +
    `You're now part of the ChooChoo journey on Base! ` +
    `Head to the ChooChoo app to let your friends know.\n\n` +
    `Thanks for riding with us! 🔵`,

  // [@user] Cast sent by current holder to announce they have ChooChoo
  USER_NEW_PASSENGER_CAST: () =>
    `I'm riding @choochoo! 🚂\n\n` +
    `Soon you could be too! React to this cast to be in the running for next passenger.\n\n` +
    `All aboard!`,

  // [@choochoo] Cast sent when someone yoinks the train
  YOINK_ANNOUNCEMENT: (username: string) =>
    `YOINK! @${username} has boarded ChooChoo! 🚂💨\n\n` +
    `After 48 hours of being stuck, ChooChoo is back on the rails! ` +
    `The journey continues on Base! 🔵\n\n` +
    `All aboard for the next adventure! 🎫`,

  // [@choochoo] Cast sent when current holder toggles random winner mode
  RANDOM_WINNER_ENABLED: (username: string) =>
    `🎲 @${username} has decided to let the community pick ChooChoo's next stop!\n\n` +
    `React to their cast for a chance to ride next! The community will be able to ` +
    `pick a random reactor in 30 minutes. 🚂\n\n` +
    `All aboard! 🎫`,

  // [@choochoo] Cast sent when public send mode is enabled (30 minute timer expires)
  PUBLIC_SEND_OPEN: () =>
    `🚂 All aboard!\n\n` +
    `Anyone can now go to the mini-app and pick a random user to receive ChooChoo! ` +
    `The current passenger left it up to chance - who will be next? 🎲\n\n` +
    `Don't miss your chance to join the journey! 🚂`,

  // [@choochoo] Cast sent when the journey begins with initial holder
  JOURNEY_BEGINS: (username: string) =>
    `🚂 All aboard! The ChooChoo journey begins! 🎫\n\n` +
    `@${username} is our first passenger and the journey across Base has officially started! ` +
    `Watch for their announcement cast to see how you can be next.\n\n` +
    `Learn more in the ChooChoo mini-app! 🔵`,

  // [@choochoo] Cast sent when app enters maintenance mode
  MAINTENANCE_STARTED: () =>
    `🚧 ChooChoo has stopped back at the station for maintenance.\n\n` +
    `We're making some quick improvements to keep the journey smooth. ` +
    `Stay tuned for updates when ChooChoo is back on the move! 🚂\n\n` +
    `Thanks for your patience!`,

  // [@choochoo] Cast sent when maintenance ends
  MAINTENANCE_ENDED: () =>
    `🚂 All aboard! ChooChoo is back on the rails! 🎉\n\n` +
    `Maintenance is complete and we're ready to continue the journey across Base! ` +
    `Thank you for your patience.\n\n` +
    `The adventure continues! 🔵`,
} as const;

// Train Station Marquee Messages
export const TRAIN_STATION_MESSAGES = [
  '🚂 Next departure: Platform 9¾',
  '⛔ Mind the gap',
  '🍾 Reminder: No sex in the champagne room',
  '🎫 All aboard the ChooChoo express!',
  '🚃 The 4:20 express is now boarding on platform... uh... platform? lol',
  '📢 The conductor has been found, thank you',
  '🎵 Now playing: Thomas the Tank Engine ASMR',
  '🚂 Choo choo mfer!',
  '⏰ Delays expected due to cows on the tracks',
  '🚉 Please keep your tickets ready for inspection',
  '🚀 Next Stop: The Moon',
  '🎲 Try leaving the next stop up to chance... ChooChoo loves chaos',
] as const;

// Marquee Configuration
export const MARQUEE_CONFIG = {
  scrollPxPerSecond: 10,
  standardMessages: TRAIN_STATION_MESSAGES,
  toastScrollCycles: 2,
  maxToastAge: 10000, // 10 seconds
  priorityDelayMs: 500,
  userContextFrequency: 5, // Every 5th message cycle
} as const;

// Message Priority Levels
export enum MessagePriority {
  EMERGENCY = 0, // Immediate injection (errors, critical alerts)
  TOAST = 1, // Normal toast notifications
  USER_CONTEXT = 2, // User info, achievements
  STANDARD = 3, // Default train humor
}
