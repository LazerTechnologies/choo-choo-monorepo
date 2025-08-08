import { NextResponse } from 'next/server';
import { CHOOCHOO_CAST_TEMPLATES } from '@/lib/constants';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const authHeader = request.headers.get('x-internal-secret');
    const isAuthorized =
      !!INTERNAL_SECRET && (authHeader === INTERNAL_SECRET || token === INTERNAL_SECRET);

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const text = CHOOCHOO_CAST_TEMPLATES.JOURNEY_CONTINUES();
    // Idempotency key to prevent duplicate daily casts if retried
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const idem = `journey-continues-${today}`;

    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/internal/send-cast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET || '',
      },
      body: JSON.stringify({ text, idem }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json(
        { success: false, error: `Failed to trigger send-cast: ${errorData}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, cast: data.cast });
  } catch (err) {
    console.error('[internal/daily-journey] Failed to send daily cast:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
