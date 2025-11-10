import { NextResponse } from 'next/server';
import { apiLog } from '@/lib/event-log';
import { getCurrentTokenId, getTokenDataRange } from '@/lib/redis-token-utils';
import type { TokenData } from '@/types/nft';

export interface JourneyItem {
  tokenId: number;
  username: string;
  displayName: string;
  address: string;
  nftImage: string;
  ticketNumber: number;
  date: string;
  duration: string;
  avatarSrc?: string;
  timestamp: string;
  transactionHash: string;
}

/**
 * GET /api/journey
 *
 * Returns the complete journey timeline with all minted tokens.
 * Calculates duration each holder had the train and formats data for the timeline.
 *
 * @notice Token timestamps represent when holders SENT the train (departure time),
 * so we calculate arrival times by using the previous holder's departure timestamp.
 * Special case: First holder uses contract deployment time as their start time.
 */
export async function GET() {
  try {
    // Get the current token ID to know how many tokens exist
    const currentTokenId = await getCurrentTokenId();

    if (!currentTokenId || currentTokenId < 1) {
      return NextResponse.json({
        success: true,
        journey: [],
        totalStops: 0,
      });
    }

    // Fetch all token data from Redis
    const tokens = await getTokenDataRange(1, currentTokenId);

    // Filter out null tokens and sort by tokenId (highest first)
    const validTokens = tokens
      .filter((token): token is TokenData => token !== null)
      .sort((a, b) => b.tokenId - a.tokenId);

    // Build the gateway URL for images
    const pinataGateway = process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud';

    // Contract deployment timestamp (when first holder received ChooChoo)
    const CONTRACT_DEPLOYMENT_TIME = new Date('2025-09-08T15:43:55.000Z');

    // Transform token data into journey items with duration calculation
    const journeyItems: JourneyItem[] = validTokens.map((token, index) => {
      // Calculate duration (time this holder had the train)
      // @note this incorrectly calculates the duration because it's not the arrival time
      // const holderStartTime = new Date(token.timestamp);
      // @notice Token timestamp represents when holder SENT the train (departure time),
      // but we need when they RECEIVED it (arrival time) to calculate correct duration
      let holderStartTime: Date;
      let holderEndTime: Date;

      if (index === validTokens.length - 1) {
        // Last token in array (lowest tokenId = first holder)
        // Use contract deployment time as their start time (when they received ChooChoo)
        holderStartTime = CONTRACT_DEPLOYMENT_TIME;
      } else {
        // For all other holders, their start time is when the previous holder sent the train
        // (which is the next token's timestamp in our descending sort)
        holderStartTime = new Date(validTokens[index + 1].timestamp);
      }

      if (index === 0) {
        // First token in array (highest tokenId = current holder), use current time
        holderEndTime = new Date();
      } else {
        // Previous holder - use the timestamp of when they sent the train (token timestamp)
        holderEndTime = new Date(token.timestamp);
      }

      const durationMs = holderEndTime.getTime() - holderStartTime.getTime();

      // Log negative durations only in development (reduce log volume in production)
      if (durationMs < 0 && process.env.NODE_ENV === 'development') {
        apiLog.warn('journey.validation_failed', {
          tokenId: token.tokenId,
          holderStartTime: holderStartTime.toISOString(),
          holderEndTime: holderEndTime.toISOString(),
          durationMs,
          msg: `Negative duration detected for token ${token.tokenId}: ${durationMs}ms`,
        });
      }

      const duration = formatDuration(Math.max(0, durationMs)); // Ensure non-negative

      return {
        tokenId: token.tokenId,
        username: token.holderUsername || 'Anonymous',
        displayName: token.holderDisplayName || token.holderUsername || 'Anonymous',
        address: token.holderAddress,
        nftImage: `${pinataGateway}/ipfs/${token.imageHash}`,
        ticketNumber: token.tokenId,
        date: new Date(token.timestamp).toLocaleDateString(),
        duration,
        avatarSrc: token.holderPfpUrl,
        timestamp: token.timestamp,
        transactionHash: token.transactionHash,
      };
    });

    return NextResponse.json({
      success: true,
      journey: journeyItems,
      totalStops: journeyItems.length,
    });
  } catch (error) {
    apiLog.error('journey.failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      msg: 'Failed to fetch journey data',
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch journey data',
        journey: [],
        totalStops: 0,
      },
      { status: 500 },
    );
  }
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  // Handle negative or very small values
  if (ms < 0) {
    return '0s';
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  if (seconds > 0) {
    return `${seconds}s`;
  }
  return 'just now';
}
