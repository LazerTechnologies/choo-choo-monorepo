import { NextResponse } from 'next/server';
import { ADMIN_FIDS } from '@/lib/constants';

interface RequireFrameAdminOk {
  ok: true;
  adminFid: number;
}

interface RequireFrameAdminErr {
  ok: false;
  response: ReturnType<typeof NextResponse.json>;
}

export type RequireFrameAdminResult = RequireFrameAdminOk | RequireFrameAdminErr;

/**
 * Mini-app admin guard for proxy routes
 * Validates admin FID from mini-app context (no frame signatures needed)
 */
export async function requireFrameAdmin(request: Request): Promise<RequireFrameAdminResult & { body?: unknown }> {
  // Enforce JSON content type
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unsupported content type' }, { status: 415 }),
    };
  }

  try {
    // Parse request body to get mini-app context data
    const body = await request.json();

    const fid = body?.miniAppContext?.userFid || body?.untrustedData?.fid || body?.fid;

    if (!fid || !Number.isFinite(fid)) {
      console.log('[require-frame-admin] No valid FID found in mini-app context');
      return {
        ok: false,
        response: NextResponse.json({ error: 'Invalid mini-app context' }, { status: 400 }),
      };
    }

    console.log('[require-frame-admin] Checking FID from mini-app context:', fid);

    // Check if FID is in admin list
    if (!ADMIN_FIDS.includes(fid)) {
      console.log('[require-frame-admin] FID not in admin list:', fid, 'Admin FIDs:', ADMIN_FIDS);
      return {
        ok: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }

    console.log('[require-frame-admin] Admin FID validated:', fid);
    return { ok: true, adminFid: fid, body };
  } catch (error) {
    console.error('[require-frame-admin] Mini-app context validation failed:', error);
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentication failed' }, { status: 401 }),
    };
  }
}
