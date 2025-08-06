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
export const CHOOCHOO_TRAIN_ADDRESS = (() => {
  const address = process.env.NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS;
  if (!address) {
    throw new Error('NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS environment variable is required');
  }
  return address as `0x${string}`;
})();

// ChooChoo Cast Templates
export const CHOOCHOO_CAST_TEMPLATES = {
  // [@choochoo] Cast sent to previous holder when their ticket is minted
  TICKET_ISSUED: (previousHolderUsername: string, tokenId: number, ipfsImageHash: string) =>
    `🎫 Ticket #${tokenId} has been minted by the conductor and delivered to @${previousHolderUsername} to commemorate their ride. All aboard for the next stop!\n\n` +
    `${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/${ipfsImageHash}`,

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
    `React to this cast to have a chance at being the next passenger, or comment and I just might chose you directly.\n\n` +
    `All aboard!`,

  // [@choochoo] Cast sent when someone yoinks the train
  YOINK_ANNOUNCEMENT: (username: string) =>
    `YOINK! @${username} has boarded ChooChoo! 🚂💨\n\n` +
    `After 48 hours of being stuck, ChooChoo is back on the rails! ` +
    `The journey continues on Base! 🔵\n\n` +
    `All aboard for the next adventure! 🎫`,

  // [@choochoo] Cast sent when public send mode is enabled
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
} as const;
