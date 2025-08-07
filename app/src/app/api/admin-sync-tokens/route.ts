import { NextResponse } from 'next/server';
import { syncTokenTracker } from '@/lib/redis-token-utils';
import { ADMIN_FIDS } from '@/lib/constants';

interface AdminSyncTokensRequest {
  adminFid: number;
}

/**
 * POST /api/admin-sync-tokens
 *
 * Admin endpoint to sync the Redis token tracker with existing token data
 * This fixes any sync issues between the tracker and actual token data
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AdminSyncTokensRequest;
    const { adminFid } = body;

    // Verify admin access
    if (!ADMIN_FIDS.includes(adminFid)) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    console.log(`[admin-sync-tokens] Admin ${adminFid} syncing token tracker`);

    // Sync the token tracker
    const highestTokenId = await syncTokenTracker();

    return NextResponse.json({
      success: true,
      highestTokenId,
      message: `Token tracker synced to highest token ID: ${highestTokenId}`,
    });
  } catch (error) {
    console.error('[admin-sync-tokens] Error:', error);
    return NextResponse.json({ error: 'Failed to sync token tracker' }, { status: 500 });
  }
}
