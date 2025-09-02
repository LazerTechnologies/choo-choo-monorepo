import { NextResponse } from 'next/server';
import { APP_URL, ADMIN_FIDS } from '@/lib/constants';
import { isTrustedOrigin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
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
    // Extract the actual request data (no frame wrapper needed)
    const body = await request.json();

    // Use first admin FID as fallback since we're relying on UI gating
    const fallbackAdminFid = ADMIN_FIDS[0] || 0;

    const upstream = await fetch(`${APP_URL}/api/admin/initial-holder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': ADMIN_SECRET,
        'x-admin-fid': String(fallbackAdminFid),
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
    console.error('[initial-holder-proxy] Error forwarding request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
