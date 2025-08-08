import { NextResponse } from 'next/server';
import { ADMIN_FIDS, APP_URL } from '@/lib/constants';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

interface AdminSendCastBody {
  adminFid: number;
  text: string;
  idem?: string;
  channel_id?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AdminSendCastBody;

    if (!body || typeof body.adminFid !== 'number' || typeof body.text !== 'string') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    if (!ADMIN_FIDS.includes(body.adminFid)) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    if (!INTERNAL_SECRET) {
      return NextResponse.json(
        { error: 'Server misconfigured: INTERNAL_SECRET missing' },
        { status: 500 }
      );
    }

    const trimmed = body.text.trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'Cast text cannot be empty' }, { status: 400 });
    }

    const payload: Record<string, unknown> = { text: trimmed };
    if (body.idem) payload.idem = body.idem;
    if (body.channel_id) payload.channel_id = body.channel_id;

    const response = await fetch(`${APP_URL}/api/internal/send-cast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        { error: data || 'Failed to send cast' },
        { status: response.status }
      );
    }

    try {
      const parsed = JSON.parse(data);
      return NextResponse.json({ success: true, cast: parsed.cast });
    } catch {
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('[admin-send-cast] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
