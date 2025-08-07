import { NextResponse } from 'next/server';
import { redis } from '@/lib/kv';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get('fid');

  if (!fid) {
    return NextResponse.json({ error: 'FID required' }, { status: 400 });
  }

  try {
    // Check if user has been marked as having casted
    const hasCurrentUserCasted = await redis.get('hasCurrentUserCasted');
    const currentCastHash = await redis.get('current-cast-hash');

    return NextResponse.json({
      hasCurrentUserCasted: hasCurrentUserCasted === 'true',
      currentCastHash,
    });
  } catch (error) {
    console.error('Error checking cast status:', error);
    return NextResponse.json({ error: 'Failed to check cast status' }, { status: 500 });
  }
}
