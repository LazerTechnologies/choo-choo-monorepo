import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/auth';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication - only allow authenticated Farcaster users
    const session = await getSession();
    if (!session?.user?.fid) {
      return NextResponse.json(
        { error: 'Unauthorized - Farcaster authentication required' },
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

    // Call the internal endpoint with proper authentication
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/set-user-casted`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET || '',
      },
      body: JSON.stringify({ hasCurrentUserCasted }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error || 'Failed to update user casted status' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in user casted status proxy:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    // 1. Authentication - only allow authenticated Farcaster users
    const session = await getSession();
    if (!session?.user?.fid) {
      return NextResponse.json(
        { error: 'Unauthorized - Farcaster authentication required' },
        { status: 401 }
      );
    }

    // Call the internal get endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/get-user-casted`, {
      method: 'GET',
      headers: {
        'x-internal-secret': INTERNAL_SECRET || '',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error || 'Failed to get user casted status' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in get user casted status proxy:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
