import { NextResponse } from 'next/server';
import { redis } from '@/lib/kv';
import { CHOOCHOO_CAST_TEMPLATES } from '@/lib/constants';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

export async function POST() {
  try {
    // Enable public send
    await redis.set('isPublicSendEnabled', 'true');

    // Send the PUBLIC_SEND_OPEN cast
    const castResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/internal/send-cast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET || '',
      },
      body: JSON.stringify({
        text: CHOOCHOO_CAST_TEMPLATES.PUBLIC_SEND_OPEN(),
        channel_id: 'base',
      }),
    });

    if (!castResponse.ok) {
      console.warn('Failed to send PUBLIC_SEND_OPEN cast (non-critical)');
    } else {
      const castData = await castResponse.json();
      console.log(
        `[enable-public-send] Successfully sent PUBLIC_SEND_OPEN cast: ${castData.cast?.hash}`
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[enable-public-send] Error:', error);
    return NextResponse.json({ error: 'Failed to enable public send' }, { status: 500 });
  }
}
