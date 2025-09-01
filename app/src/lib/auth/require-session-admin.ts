import { NextResponse } from 'next/server';
import { getServerSession, type Session } from 'next-auth';
import { authOptions } from '@/auth';
import { ADMIN_FIDS } from '@/lib/constants';

interface RequireSessionAdminOk {
  ok: true;
  adminFid: number;
}

interface RequireSessionAdminErr {
  ok: false;
  response: ReturnType<typeof NextResponse.json>;
}

export type RequireSessionAdminResult = RequireSessionAdminOk | RequireSessionAdminErr;

/**
 * Session-only admin guard for proxy routes
 */
export async function requireSessionAdmin(request: Request): Promise<RequireSessionAdminResult> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unsupported content type' }, { status: 415 }),
    };
  }

  try {
    const session = (await getServerSession(authOptions)) as Session | null;
    const fidFromSession = session?.user?.fid as number | undefined;
    if (fidFromSession && ADMIN_FIDS.includes(fidFromSession)) {
      return { ok: true, adminFid: fidFromSession };
    }
  } catch (error) {
    console.error('[require-session-admin] Session check failed:', error);
  }

  return {
    ok: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  };
}
