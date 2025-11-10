import { NextResponse } from 'next/server';
import { ADMIN_FIDS } from '@/lib/constants';

interface AdminMiddlewareResult {
  ok: true;
  adminFid: number;
  body: unknown;
}

interface AdminMiddlewareError {
  ok: false;
  response: NextResponse;
}

/**
 * Simple admin middleware following Neynar's recommended pattern
 * Gets FID from request body (mini-app context) and validates admin access
 */
export async function adminMiddleware(
  request: Request,
): Promise<AdminMiddlewareResult | AdminMiddlewareError> {
  try {
    const body = await request.json();

    const userFid =
      body?.miniAppContext?.userFid || body?.untrustedData?.fid || body?.fid || body?.user?.fid;

    if (!userFid || !ADMIN_FIDS.includes(userFid)) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: 'Insufficient permissions',
            code: 'ADMIN_ONLY',
          },
          { status: 403 },
        ),
      };
    }

    return {
      ok: true,
      adminFid: userFid,
      body,
    };
  } catch (error) {
    console.error('[adminMiddleware] Authentication failed:', error);
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Authentication failed',
          code: 'AUTH_ERROR',
        },
        { status: 401 },
      ),
    };
  }
}
