import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/kv';
import { CHOOCHOO_CAST_TEMPLATES } from '@/lib/constants';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Set winner selection start time (30 minutes from now)
    const startTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // Update Redis flags
    await Promise.all([
      redis.set('useRandomWinner', 'true'),
      redis.set('winnerSelectionStart', startTime),
      redis.set('isPublicSendEnabled', 'false'),
    ]);

    // Send cast announcing random winner mode is enabled
    try {
      const castText = CHOOCHOO_CAST_TEMPLATES.RANDOM_WINNER_ENABLED(username);

      const castResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/internal/send-cast`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET || '',
          },
          body: JSON.stringify({
            text: castText,
          }),
        }
      );

      if (castResponse.ok) {
        const castData = await castResponse.json();
        console.log(
          `[enable-random-winner] Successfully sent random winner enabled cast: ${castData.cast?.hash}`
        );
      } else {
        const castErrorData = await castResponse.json();
        console.warn(
          '[enable-random-winner] Failed to send random winner enabled cast (non-critical):',
          castErrorData.error
        );
      }
    } catch (err) {
      console.warn(
        '[enable-random-winner] Failed to send random winner enabled cast (non-critical):',
        err
      );
      // Don't fail the request for cast sending issues
    }

    return NextResponse.json({
      success: true,
      winnerSelectionStart: startTime,
    });
  } catch (error) {
    console.error('[enable-random-winner] Error:', error);
    return NextResponse.json({ error: 'Failed to enable random winner' }, { status: 500 });
  }
}
