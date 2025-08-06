import { NextResponse } from 'next/server';
import { redis } from '@/lib/kv';

/**
 * GET /api/admin-check-holder-status
 *
 * Simple endpoint to check if a current holder exists in Redis.
 * Used by admin functions to determine if initial holder can be set.
 */
export async function GET() {
  try {
    // Check if there's a current holder in Redis
    const existingHolderData = await redis.get('current-holder');
    const hasCurrentHolder = !!existingHolderData;

    return NextResponse.json({
      hasCurrentHolder,
      canSetInitialHolder: !hasCurrentHolder,
    });
  } catch (error) {
    console.error('[admin-check-holder-status] Error:', error);
    return NextResponse.json({ error: 'Failed to check holder status' }, { status: 500 });
  }
}
