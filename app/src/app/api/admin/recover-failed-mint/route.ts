import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { redis } from '@/lib/kv';
import { REDIS_KEYS } from '@/lib/redis-token-utils';
import type { TokenData } from '@/types/nft';

/**
 * POST /api/admin/recover-failed-mint
 *
 * Admin endpoint to manually recover state when a mint succeeded on-chain
 * but the system marked it as failed due to RPC sync issues.
 *
 * Use this when:
 * - Transaction succeeded on Basescan
 * - System showed "Transaction does not exist" error
 * - Token was minted but Redis not updated
 */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();

    // Required fields
    const {
      tokenId,
      holderAddress,
      holderUsername,
      holderFid,
      transactionHash,
      imageHash,
      metadataHash,
      tokenURI,
      blockNumber,
    } = body;

    // Validate required fields
    if (
      !tokenId ||
      !holderAddress ||
      !holderUsername ||
      !holderFid ||
      !transactionHash ||
      !imageHash ||
      !metadataHash ||
      !tokenURI
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Missing required fields: tokenId, holderAddress, holderUsername, holderFid, transactionHash, imageHash, metadataHash, tokenURI',
        },
        { status: 400 },
      );
    }

    // Build token data
    const tokenData: TokenData = {
      tokenId: Number(tokenId),
      imageHash,
      metadataHash,
      tokenURI,
      holderAddress,
      holderUsername,
      holderFid: Number(holderFid),
      holderDisplayName: body.holderDisplayName || holderUsername,
      holderPfpUrl: body.holderPfpUrl || '',
      transactionHash,
      timestamp: body.timestamp || new Date().toISOString(),
      blockNumber: blockNumber ? Number(blockNumber) : undefined,
      attributes: body.attributes || [],
      sourceType: body.sourceType || 'manual',
      sourceCastHash: body.sourceCastHash,
      totalEligibleReactors: body.totalEligibleReactors,
    };

    // Store token data in Redis
    const tokenKey = REDIS_KEYS.token(tokenId);
    await redis.set(tokenKey, JSON.stringify(tokenData));

    // Update current token ID tracker
    const trackerData = await redis.get(REDIS_KEYS.currentTokenId);
    let currentTokenId = 0;
    if (trackerData) {
      const tracker = JSON.parse(trackerData);
      currentTokenId = tracker.currentTokenId;
    }

    // Only update if this token is higher
    if (tokenId > currentTokenId) {
      await redis.set(
        REDIS_KEYS.currentTokenId,
        JSON.stringify({
          currentTokenId: tokenId,
          lastUpdated: new Date().toISOString(),
        }),
      );
    }

    // If new holder address provided, update current holder
    if (body.newHolderAddress && body.newHolderUsername && body.newHolderFid) {
      const currentHolderData = {
        fid: Number(body.newHolderFid),
        username: body.newHolderUsername,
        displayName: body.newHolderDisplayName || body.newHolderUsername,
        pfpUrl: body.newHolderPfpUrl || '',
        address: body.newHolderAddress,
        timestamp: new Date().toISOString(),
      };
      await redis.set('current-holder', JSON.stringify(currentHolderData));
    }

    // Update last moved timestamp
    await redis.set(
      REDIS_KEYS.lastMovedTimestamp,
      JSON.stringify({
        timestamp: tokenData.timestamp,
        transactionHash,
      }),
    );

    console.log(
      `[admin/recover-failed-mint] Successfully recovered token ${tokenId} state from on-chain data`,
    );

    return NextResponse.json({
      success: true,
      message: `Token ${tokenId} state recovered successfully`,
      tokenData,
    });
  } catch (error) {
    console.error('[admin/recover-failed-mint] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
