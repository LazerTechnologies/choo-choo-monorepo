import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/kv';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication - only allow internal microservice calls
    const internalSecret = request.headers.get('x-internal-secret');
    if (!INTERNAL_SECRET || internalSecret !== INTERNAL_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized - Internal secret required' },
        { status: 401 }
      );
    }

    const { hasCurrentUserCasted } = await request.json();

    if (typeof hasCurrentUserCasted !== 'boolean') {
      return NextResponse.json(
        { error: 'hasCurrentUserCasted must be a boolean' },
        { status: 400 }
      );
    }

    // Set or clear the flag in Redis
    if (hasCurrentUserCasted) {
      await redis.set('hasCurrentUserCasted', 'true');
    } else {
      await redis.del('hasCurrentUserCasted');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting user casted flag:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
