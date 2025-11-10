import { NextResponse } from 'next/server';
import { APP_URL } from '@/lib/constants';
import { adminMiddleware } from '@/lib/auth/simple-admin-middleware';

export const revalidate = 0;

export async function POST(request: Request) {
  const auth = await adminMiddleware(request);
  if (!auth.ok) return auth.response;

  const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
  if (!ADMIN_SECRET) {
    return NextResponse.json(
      { error: 'Server misconfigured: ADMIN_SECRET missing' },
      { status: 500 },
    );
  }

  try {
    const body = auth.body;

    const upstream = await fetch(`${APP_URL}/api/admin/repair-redis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': ADMIN_SECRET,
        'x-admin-fid': String(auth.adminFid),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[repair-redis-proxy] Error forwarding request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
