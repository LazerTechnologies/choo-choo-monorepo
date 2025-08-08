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

// Typed subset of Neynar frame/validate response used for fid extraction
interface NeynarFrameValidateResponse {
  action?: {
    interactor?: { fid?: number };
    requester?: { fid?: number };
  };
  fid?: number;
}

function isTrustedOrigin(request: Request): boolean {
  try {
    const origin = request.headers.get('origin');
    if (!origin) return false;
    const app = new URL(APP_URL);
    const req = new URL(origin);
    return app.hostname === req.hostname && app.protocol === req.protocol;
  } catch {
    return false;
  }
}

async function getAdminFidFromFrame(request: Request): Promise<number | null> {
  try {
    const clone = request.clone();
    const body = (await clone.json().catch(() => null)) as {
      trustedData?: { messageBytes?: string };
    } | null;
    const messageBytes = body?.trustedData?.messageBytes;
    if (!messageBytes) return null;

    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) return null;

    const res = await fetch('https://api.neynar.com/v2/farcaster/frame/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        api_key: apiKey,
      },
      body: JSON.stringify({ message_bytes_in_hex: messageBytes }),
    });

    if (!res.ok) return null;
    const data: NeynarFrameValidateResponse = await res.json();

    const fid: number | undefined =
      data?.action?.interactor?.fid ?? data?.action?.requester?.fid ?? data?.fid;

    if (!fid || !Number.isFinite(fid)) return null;
    if (!ADMIN_FIDS.includes(fid)) return null;
    return fid;
  } catch {
    return null;
  }
}

export async function requireAdmin(request: Request): Promise<RequireAdminResult> {
  // 0) If this is a valid Frame request, allow without origin/session
  const frameAdminFid = await getAdminFidFromFrame(request);
  if (frameAdminFid) {
    return { ok: true, adminFid: frameAdminFid };
  }

  // For non-frame requests, enforce JSON content type and same-origin CSRF check
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

  // 2) Optional header-based fallback for emergencies (disabled unless ADMIN_SECRET set)
  const adminSecret = process.env.ADMIN_SECRET;
  const headerSecret = request.headers.get('x-admin-secret') || '';
  if (adminSecret && headerSecret && adminSecret === headerSecret) {
    const headerFid = parseInt(request.headers.get('x-admin-fid') || '', 10);
    if (Number.isFinite(headerFid) && ADMIN_FIDS.includes(headerFid)) {
      return { ok: true, adminFid: headerFid };
    }
  }

  // Not authorized
  return {
    ok: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  };
}
