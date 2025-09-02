import { NextResponse } from 'next/server';
import { getContractService } from '@/lib/services/contract';
import { getCurrentTokenId, getTokenDataRange } from '@/lib/redis-token-utils';

interface TokenSyncHealthCheck {
  healthy: boolean;
  onChainTotalTickets: number;
  redisCurrentTokenId: number | null;
  redisTokensFound: number;
  missingTokenIds: number[];
  extraTokenIds: number[];
  warnings: string[];
  errors: string[];
}

/**
 * GET /api/health/token-sync
 *
 * Health check endpoint that validates Redis and on-chain token data are in sync.
 * This helps detect off-by-one issues and missing token data.
 */
export async function GET(): Promise<NextResponse<TokenSyncHealthCheck>> {
  const warnings: string[] = [];
  const errors: string[] = [];
  let healthy = true;

  try {
    // Get on-chain data
    const contractService = getContractService();
    const onChainTotalTickets = await contractService.getTotalTickets();

    // Get Redis data
    const redisCurrentTokenId = await getCurrentTokenId();

    console.log(`[health/token-sync] On-chain total tickets: ${onChainTotalTickets}`);
    console.log(`[health/token-sync] Redis current token ID: ${redisCurrentTokenId}`);

    // Check if Redis tracker matches on-chain data
    if (redisCurrentTokenId !== null && redisCurrentTokenId !== onChainTotalTickets) {
      warnings.push(
        `Redis current token ID (${redisCurrentTokenId}) doesn't match on-chain total tickets (${onChainTotalTickets})`
      );
      healthy = false;
    }

    // Check for missing or extra tokens in Redis
    const missingTokenIds: number[] = [];
    const extraTokenIds: number[] = [];
    let redisTokensFound = 0;

    if (onChainTotalTickets > 0) {
      // Check tokens 1 through onChainTotalTickets
      const redisTokens = await getTokenDataRange(1, onChainTotalTickets);
      redisTokensFound = redisTokens.length;

      // Find missing tokens
      const foundTokenIds = new Set(redisTokens.map((token) => token.tokenId));
      for (let i = 1; i <= onChainTotalTickets; i++) {
        if (!foundTokenIds.has(i)) {
          missingTokenIds.push(i);
        }
      }

      // Find extra tokens (tokens in Redis that shouldn't exist on-chain)
      for (const token of redisTokens) {
        if (token.tokenId > onChainTotalTickets) {
          extraTokenIds.push(token.tokenId);
        }
      }
    }

    // Report issues
    if (missingTokenIds.length > 0) {
      errors.push(`Missing token data in Redis for token IDs: ${missingTokenIds.join(', ')}`);
      healthy = false;
    }

    if (extraTokenIds.length > 0) {
      warnings.push(`Extra token data in Redis for token IDs: ${extraTokenIds.join(', ')}`);
      healthy = false;
    }

    // Check if we have no tokens but should have some
    if (onChainTotalTickets > 0 && redisTokensFound === 0) {
      errors.push('No token data found in Redis despite on-chain tickets existing');
      healthy = false;
    }

    // Check if Redis tracker is null but we have tokens
    if (onChainTotalTickets > 0 && redisCurrentTokenId === null) {
      errors.push('Redis current token ID tracker is null despite on-chain tickets existing');
      healthy = false;
    }

    const result: TokenSyncHealthCheck = {
      healthy,
      onChainTotalTickets,
      redisCurrentTokenId,
      redisTokensFound,
      missingTokenIds,
      extraTokenIds,
      warnings,
      errors,
    };

    console.log(`[health/token-sync] Health check result:`, result);

    return NextResponse.json(result, {
      status: healthy ? 200 : 500,
    });
  } catch (error) {
    console.error('[health/token-sync] Health check failed:', error);

    const result: TokenSyncHealthCheck = {
      healthy: false,
      onChainTotalTickets: 0,
      redisCurrentTokenId: null,
      redisTokensFound: 0,
      missingTokenIds: [],
      extraTokenIds: [],
      warnings: [],
      errors: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };

    return NextResponse.json(result, { status: 500 });
  }
}
