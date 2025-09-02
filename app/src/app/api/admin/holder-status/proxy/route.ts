import { NextResponse } from 'next/server';
import { APP_URL, ADMIN_FIDS } from '@/lib/constants';
import { isTrustedOrigin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  // Basic origin check for CSRF protection
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
  }

  const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
  if (!ADMIN_SECRET) {
    return NextResponse.json(
      { error: 'Server misconfigured: ADMIN_SECRET missing' },
      { status: 500 }
    );
  }

  try {
    // Use first admin FID as fallback since we're relying on UI gating
    const fallbackAdminFid = ADMIN_FIDS[0] || 0;

    const upstream = await fetch(`${APP_URL}/api/admin/holder-status`, {
      method: 'GET',
      headers: {
        'x-admin-secret': ADMIN_SECRET,
        'x-admin-fid': String(fallbackAdminFid),
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
