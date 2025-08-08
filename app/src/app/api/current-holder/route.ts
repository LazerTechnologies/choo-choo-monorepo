import { NextResponse } from 'next/server';
import { getSession } from '@/auth';
import { redis } from '@/lib/kv';
import type { CurrentHolderData } from '@/types/nft';

/**
 * GET /api/current-holder
 *
 * Returns information about the current train holder.
 * If user is authenticated via Farcaster, also returns whether they are the current holder.
 */
export async function GET() {
  try {
    // Get session (optional - endpoint works without authentication)
    const session = await getSession();
    const currentUserFid = session?.user?.fid || null;

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
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (!currentHolderData) {
      return NextResponse.json(
        {
          hasCurrentHolder: false,
          isCurrentHolder: false,
          currentUserFid,
          currentHolder: null,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Only calculate isCurrentHolder if user is authenticated
    const isCurrentHolder = currentUserFid
      ? currentUserFid.toString() === currentHolderData.fid.toString()
      : false;

    return NextResponse.json(
      {
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
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[current-holder] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check current holder status' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
