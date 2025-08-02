import { NextResponse } from 'next/server';
import { getSession } from '@/auth';
import { redis } from '@/lib/kv';
import type { CurrentHolderData } from '@/types/nft';

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

    // Get the current holder data from Redis
    let currentHolderData: CurrentHolderData | null = null;
    try {
      const holderDataString = await redis.get('current-holder');
      if (holderDataString) {
        currentHolderData = JSON.parse(holderDataString);
      }
    } catch (err) {
      console.error('[current-holder] Failed to get current holder from Redis:', err);
      return NextResponse.json(
        { error: 'Failed to retrieve current holder information' },
        { status: 500 }
      );
    }

    if (!currentHolderData) {
      return NextResponse.json({
        hasCurrentHolder: false,
        isCurrentHolder: false,
        currentUserFid,
        currentHolder: null,
      });
    }

    const isCurrentHolder = currentUserFid.toString() === currentHolderData.fid.toString();

    return NextResponse.json({
      hasCurrentHolder: true,
      isCurrentHolder,
      currentUserFid,
      currentHolder: {
        fid: currentHolderData.fid,
        username: currentHolderData.username,
        displayName: currentHolderData.displayName,
        pfpUrl: currentHolderData.pfpUrl,
        address: currentHolderData.address,
        timestamp: currentHolderData.timestamp,
      },
    });
  } catch (error) {
    console.error('[current-holder] Error:', error);
    return NextResponse.json({ error: 'Failed to check current holder status' }, { status: 500 });
  }
}
