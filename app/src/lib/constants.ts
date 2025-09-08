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
  : [];
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
    `Be on the lookout for their announcement cast, you could be the next passenger! ` +
    `The journey continues on Base! 🔵\n\n` +
    `All aboard for the next adventure! 🎫`,

  // [@choochoo] Cast sent when current holder toggles random winner mode
  RANDOM_WINNER_ENABLED: (username: string) =>
    `🎲 @${username} has decided to leave ChooChoo's next stop up to chance!\n\n` +
    `React to their cast for a chance to ride next! Anyone can ` +
    `trigger ChooChoo to be randomly sent to an account who reacted to the current holder's cast in 30 minutes. 🚂\n\n` +
    `All aboard! 🎫`,

  // [@choochoo] Cast sent when public send mode is enabled (30 minute timer expires)
  PUBLIC_SEND_OPEN: (username: string) =>
    `🚂 All aboard!\n\n` +
    `Head to the mini-app and pick a random user to receive ChooChoo! ` +
    `@${username} left it up to chance! Anyone can now trigger ChooChoo to be randomly sent to someone who reacted to their cast! 🎲\n\n` +
    `Don't miss your chance to join the journey! 🚂`,

  // [@choochoo] Cast sent when the journey begins with initial holder
  JOURNEY_BEGINS: (username: string) =>
    `🚂 All aboard! ChooChoo has officially left the station! 🎫\n\n` +
    `@${username} is our first passenger and the journey across Base has officially started! ` +
    `Follow them and watch out for their announcement cast for your chance to ride.\n\n` +
    `Learn more in the ChooChoo mini-app! 🔵`,

  // [@choochoo] Cast sent when app enters maintenance mode
  MAINTENANCE_STARTED: () =>
    `🚧 ChooChoo has stopped back at the station for maintenance.\n\n` +
    `We're making some quick improvements to keep the journey smooth. ` +
    `Stay tuned for updates when ChooChoo is back on the move! 🚂\n\n` +
    `Thanks for your patience!`,

  // [@choochoo] Cast sent when maintenance ends
  MAINTENANCE_ENDED: () =>
    `🚂 All aboard! ChooChoo is back on the rails!\n\n` +
    `Maintenance is complete and ChooChoo is back to blazing across Base!\n\n` +
    `The adventure continues! 🔵`,
} as const;

// Train Station Marquee Messages
export const TRAIN_STATION_MESSAGES = [
  `🔵 If you're reading this, you're based`,
  '🔵 Is it day two yet?',
  '📈 $10T is FUD',
  '⛔ Mind the gap ⛔',
  '🔔 Reminder: Regularly revoke unused token approvals',
  '🔔 Reminder: Never share your private key or seed phrase',
  '🔔 Reminder: Not your keys, not your crypto',
  '📢 Has anyone seen the conductor???',
  '📢 The 4:20 express is now boarding on platform... uh... 420...',
  '📢 The conductor has been found, thank you',
  '📢 Delays expected due to manlets on the tracks',
  '🎵 Now playing: Thomas the Tank Engine ASMR',
  '🍪 The edibles are kicking in... I repeat, the edibles are kicking in',
  '🚂 Choo choo mfer!',
  '🎫 Get your tickets ready for inspection',
  '⬆ Next Stop: Higher ⬆',
  '👋 Welcome to Costco, I love you',
  '🎲 Leave the next stop up to chance... ChooChoo loves chaos',
] as const;

// Marquee Configuration
export const MARQUEE_CONFIG = {
  scrollSpeed: parseInt(process.env.NEXT_PUBLIC_MARQUEE_SCROLL_SPEED || '10', 10),
  standardMessages: TRAIN_STATION_MESSAGES,
  toastScrollCycles: 2,
  maxToastAge: 10000,
  priorityDelayMs: 500,
  userContextFrequency: 5, // USER_CONTEXT priorities can show every 5th message cycle to avoid spam
} as const;

// Message Priority Levels
export enum MessagePriority {
  EMERGENCY = 0, // immediate injection (errors, critical alerts)
  TOAST = 1, // normal toast notifications
  USER_CONTEXT = 2, // user info, achievements
  STANDARD = 3, // default messages
}
