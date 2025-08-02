import { NextResponse } from 'next/server';
import { getSession } from '@/auth';
import { redis } from '@/lib/kv';

/**
 * GET /api/current-holder
 *
 * Returns information about the current train holder and whether the
 * authenticated user is the current holder.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.fid) {
      return NextResponse.json(
        { error: '🔒 Unauthorized - Farcaster authentication required' },
        { status: 401 }
      );
    }

    const currentUserFid = session.user.fid;

    // Get the current holder FID from Redis
    let currentHolderFid: string | null = null;
    try {
      currentHolderFid = await redis.get('current-holder');
    } catch (err) {
      console.error('[current-holder] Failed to get current holder from Redis:', err);
      return NextResponse.json(
        { error: 'Failed to retrieve current holder information' },
        { status: 500 }
      );
    }

    if (!currentHolderFid) {
      return NextResponse.json({
        hasCurrentHolder: false,
        isCurrentHolder: false,
        currentUserFid,
        currentHolderFid: null,
      });
    }

    const isCurrentHolder = currentUserFid.toString() === currentHolderFid;

    return NextResponse.json({
      hasCurrentHolder: true,
      isCurrentHolder,
      currentUserFid,
      currentHolderFid: parseInt(currentHolderFid),
    });
  } catch (error) {
    console.error('[current-holder] Error:', error);
    return NextResponse.json({ error: 'Failed to check current holder status' }, { status: 500 });
  }
}
