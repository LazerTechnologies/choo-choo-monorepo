import { NextResponse } from 'next/server';
import { getServerSession, type Session } from 'next-auth';
import { authOptions } from '@/auth';
import { ADMIN_FIDS, APP_URL } from '@/lib/constants';

interface RequireAdminOk {
  ok: true;
  adminFid: number;
}

interface RequireAdminErr {
  ok: false;
  response: ReturnType<typeof NextResponse.json>;
}

export type RequireAdminResult = RequireAdminOk | RequireAdminErr;


export function isTrustedOrigin(request: Request): boolean {
  try {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host) {
      const originUrl = new URL(origin);
      if (originUrl.host === host) return true;
    }

    if (APP_URL) {
      const app = new URL(APP_URL);
      if (origin) {
        const req = new URL(origin);
        if (app.hostname === req.hostname && app.protocol === req.protocol) return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

export async function requireAdmin(request: Request): Promise<RequireAdminResult> {
  // 0b) Optional header-based fallback for emergencies (checked early to allow server-to-server calls)
  const adminSecret = process.env.ADMIN_SECRET;
  const headerSecret = request.headers.get('x-admin-secret') || '';
  if (adminSecret && headerSecret && adminSecret === headerSecret) {
    const headerFid = parseInt(request.headers.get('x-admin-fid') || '', 10);
    if (Number.isFinite(headerFid) && ADMIN_FIDS.includes(headerFid)) {
      return { ok: true, adminFid: headerFid };
    }
  }

  // For non-frame, non-secret requests, enforce JSON content type and same-origin CSRF check
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unsupported content type' }, { status: 415 }),
    };
  }
  if (!isTrustedOrigin(request)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden origin' }, { status: 403 }),
    };
  }

  // 1) Try NextAuth session (preferred for in-app admin UI)
  try {
    const session = (await getServerSession(authOptions)) as Session | null;
    const fidFromSession = session?.user?.fid as number | undefined;
    if (fidFromSession && ADMIN_FIDS.includes(fidFromSession)) {
      return { ok: true, adminFid: fidFromSession };
    }
  } catch {
    // fall through to other strategies
  }

  // Not authorized
  return {
    ok: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  };
}
