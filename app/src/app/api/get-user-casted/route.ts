import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/kv';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication - only allow internal microservice calls
    const internalSecret = request.headers.get('x-internal-secret');
    if (!INTERNAL_SECRET || internalSecret !== INTERNAL_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized - Internal secret required' },
        { status: 401 }
      );
    }

    // Check if the flag exists in Redis
    const hasCurrentUserCasted = await redis.get('hasCurrentUserCasted');

    return NextResponse.json({
      hasCurrentUserCasted: hasCurrentUserCasted === 'true',
    });
  } catch (error) {
    console.error('Error getting user casted flag:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
