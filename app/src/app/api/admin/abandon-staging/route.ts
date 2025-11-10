import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { stagingLog } from '@/lib/event-log';
import { redis } from '@/lib/kv';
import { REDIS_KEYS } from '@/lib/redis-token-utils';
import { abandonStaging, getStaging } from '@/lib/staging-manager';

/**
 * POST /api/admin/abandon-staging
 *
 * Admin endpoint to manually abandon a stuck staging entry and clean up related cache.
 * Use this when a staging entry is stuck and needs to be cleared to allow retry.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let tokenId: number | undefined;

  try {
    const body = await request.json();
    const rawTokenId = Number(body?.tokenId);
    const reason = body?.reason || 'Manually abandoned by admin';

    if (!Number.isInteger(rawTokenId) || rawTokenId <= 0) {
      return NextResponse.json(
        { success: false, error: 'tokenId must be a positive integer' },
        { status: 400 },
      );
    }

    tokenId = rawTokenId;

    // Check if staging exists
    const staging = await getStaging(tokenId);
    if (!staging) {
      return NextResponse.json(
        { success: false, error: `No staging entry found for token ${tokenId}` },
        { status: 404 },
      );
    }

    // Abandon the staging
    await abandonStaging(tokenId, reason);

    // Clean up pending NFT cache
    try {
      await redis.del(REDIS_KEYS.pendingNFT(tokenId));
      stagingLog.info('lifecycle.abandoned', {
        tokenId,
        action: 'cleaned_pending_nft_cache',
      });
    } catch (cacheError) {
      stagingLog.warn('lifecycle.abandoned', {
        tokenId,
        error: cacheError,
        msg: 'Failed to clean pending NFT cache (non-critical)',
      });
    }

    stagingLog.info('lifecycle.abandoned', {
      tokenId,
      reason,
      msg: 'Staging entry manually abandoned via admin endpoint',
      adminFid: auth.adminFid,
    });

    return NextResponse.json({
      success: true,
      tokenId,
      message: `Token ${tokenId} staging abandoned. You can now retry the operation.`,
      previousStatus: staging.status,
    });
  } catch (error) {
    stagingLog.error('lifecycle.abandoned', {
      error,
      msg: 'Failed to abandon staging entry via admin endpoint',
      tokenId,
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
