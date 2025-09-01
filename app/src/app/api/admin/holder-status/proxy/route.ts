import { NextResponse } from 'next/server';
import { requireFrameAdmin } from '@/lib/auth/require-frame-admin';
import { APP_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  // For GET requests, we can't validate frame context, so we'll use a simple approach
  // This is less secure but needed for compatibility
  const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
  if (!ADMIN_SECRET) {
    return NextResponse.json({ error: 'Server misconfigured: ADMIN_SECRET missing' }, { status: 500 });
  }

  try {
    const upstream = await fetch(`${APP_URL}/api/admin/holder-status`, {
      method: 'GET',
      headers: {
        'x-admin-secret': ADMIN_SECRET,
        'x-admin-fid': '0', // Placeholder since we can't validate
      },
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
    console.error('[holder-status-proxy] Error forwarding GET request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireFrameAdmin(request);
  if (!auth.ok) return auth.response;

  const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
  if (!ADMIN_SECRET) {
    return NextResponse.json({ error: 'Server misconfigured: ADMIN_SECRET missing' }, { status: 500 });
  }

  try {
    const upstream = await fetch(`${APP_URL}/api/admin/holder-status`, {
      method: 'GET',
      headers: {
        'x-admin-secret': ADMIN_SECRET,
        'x-admin-fid': String(auth.adminFid),
      },
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
    console.error('[holder-status-proxy] Error forwarding POST request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
