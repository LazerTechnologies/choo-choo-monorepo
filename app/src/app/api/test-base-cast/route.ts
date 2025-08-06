import { NextResponse } from 'next/server';
import { getSession } from '@/auth';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;
const ADMIN_FIDS = [377557, 2802, 243300];

export async function POST() {
  try {
    // 1. Authentication - only allow admin users
    const session = await getSession();
    if (!session?.user?.fid || !ADMIN_FIDS.includes(session.user.fid)) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }

    // 2. Call internal send-cast endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/internal/send-cast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET || '',
      },
      body: JSON.stringify({
        text: 'testing',
        parent: 'https://onchainsummer.xyz', // Base channel
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error || 'Failed to send test cast' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in test base cast:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
