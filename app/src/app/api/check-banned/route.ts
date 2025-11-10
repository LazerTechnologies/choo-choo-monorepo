import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { checkBannedFid } from '@/lib/auth/check-banned-user';
import { apiLog } from '@/lib/event-log';

/**
 * GET /api/check-banned?fid=123
 *
 * Checks if a user with the given FID is banned.
 * Returns whether the user is banned without exposing the full banned list.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');

    if (!fidParam) {
      return NextResponse.json({ error: 'FID parameter is required' }, { status: 400 });
    }

    const fid = Number.parseInt(fidParam, 10);
    if (Number.isNaN(fid) || fid <= 0) {
      return NextResponse.json({ error: 'Invalid FID parameter' }, { status: 400 });
    }

    const bannedCheck = checkBannedFid(fid);

    return NextResponse.json({
      banned: bannedCheck.isBanned,
      fid,
    });
  } catch (error) {
    apiLog.error('check-banned.failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      msg: 'Failed to check banned status',
    });
    return NextResponse.json(
      {
        error: 'Failed to check banned status',
      },
      { status: 500 },
    );
  }
}
