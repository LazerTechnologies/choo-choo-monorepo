import { NextResponse } from 'next/server';
import { getLastMovedTimestamp } from '@/lib/redis-token-utils';

export async function GET() {
  try {
    const lastMoved = await getLastMovedTimestamp();

    return NextResponse.json({
      lastMovedTimestamp: lastMoved?.timestamp || null,
      transactionHash: lastMoved?.transactionHash || null,
    });
  } catch (error) {
    console.error('Error fetching last moved timestamp:', error);
    return NextResponse.json({ error: 'Failed to fetch last moved timestamp' }, { status: 500 });
  }
}
