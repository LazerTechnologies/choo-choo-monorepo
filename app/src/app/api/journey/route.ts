import { NextResponse } from 'next/server';
import { getTokenDataRange, getCurrentTokenId } from '@/lib/redis-token-utils';
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

    // Transform token data into journey items with duration calculation
    const journeyItems: JourneyItem[] = validTokens.map((token, index) => {
      // Calculate duration (time this holder had the train)
      const holderStartTime = new Date(token.timestamp);
      let holderEndTime: Date;

      if (index === 0) {
        // First token in array (highest tokenId = current holder), use current time
        holderEndTime = new Date();
      } else {
        // Previous holder - use the timestamp of when the next person got the train
        // Since tokens are sorted by tokenId descending, the previous token in array
        // has the timestamp of when this holder lost the train
        holderEndTime = new Date(validTokens[index - 1].timestamp);
      }

      const durationMs = holderEndTime.getTime() - holderStartTime.getTime();

      // Log negative durations for debugging
      if (durationMs < 0) {
        console.warn(
          `[journey] Negative duration detected for token ${token.tokenId}: ${durationMs}ms`,
          {
            tokenId: token.tokenId,
            holderStartTime: holderStartTime.toISOString(),
            holderEndTime: holderEndTime.toISOString(),
            durationMs,
          }
        );
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
    console.error('[journey] Failed to fetch journey data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch journey data',
        journey: [],
        totalStops: 0,
      },
      { status: 500 }
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
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else if (seconds > 0) {
    return `${seconds}s`;
  } else {
    return 'just now';
  }
}
