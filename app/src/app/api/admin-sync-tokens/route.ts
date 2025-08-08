import { NextResponse } from 'next/server';
import { syncTokenTracker } from '@/lib/redis-token-utils';
import { requireAdmin } from '@/lib/auth/require-admin';

/**
 * POST /api/admin-sync-tokens
 *
 * Admin endpoint to sync the Redis token tracker with existing token data
 * This fixes any sync issues between the tracker and actual token data
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    console.log(`[admin-sync-tokens] Admin ${auth.adminFid} syncing token tracker`);

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
