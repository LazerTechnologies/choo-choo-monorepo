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
  // Normal cast sent after a winner is selected from reactions
  NORMAL_ARRIVAL: (username: string, tokenId: number) =>
    `All aboard! @${username} is on the ChooChoo! 🎫\n\n` +
    `Ticket #${tokenId} has been minted and delivered to their wallet. ` +
    `The journey continues...\n\n` +
    `Who will be the next passenger? Reply to this cast to get in line!`,

  // Admin cast sent when admin manually sends ChooChoo to someone
  ADMIN_ARRIVAL: (username: string, tokenId: number) =>
    `🚂✨ Special delivery! ChooChoo has been sent to @${username}! 🎫\n\n` +
    `Ticket #${tokenId} has been minted by the conductor and delivered to their wallet. ` +
    `All aboard for the next stop!\n\n` +
    `Reply to this cast to join the journey! 🚋`,

  // Generic journey announcement
  JOURNEY_CONTINUES: () =>
    `🚂 The ChooChoo journey continues across Base! 🔵\n\n` +
    `Every stop is a new adventure, every passenger gets a unique ticket NFT. ` +
    `Where will ChooChoo go next?\n\n` +
    `Join the ride by replying to cast announcements! 🚋`,

  // Welcome message for new passengers
  WELCOME_PASSENGER: (username: string) =>
    `🚂 Welcome aboard, @${username}! 🎫\n\n` +
    `You're now part of the ChooChoo journey on Base! ` +
    `Head to the ChooChoo app to let your friends know.\n\n` +
    `Thanks for riding with us! 🔵`,
} as const;
