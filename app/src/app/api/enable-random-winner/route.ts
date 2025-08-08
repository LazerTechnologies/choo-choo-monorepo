import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/kv';
import { CHOOCHOO_CAST_TEMPLATES } from '@/lib/constants';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

/**
 * POST /api/enable-random-winner
 *
 * Enables random winner mode by sending a cast announcing the feature.
 * Updates the workflow state to CHANCE_ACTIVE with the announcement cast hash.
 *
 * @param request - The HTTP request object containing the username of the user enabling random winner.
 * @returns 200 on success, 400 if username is missing, 500 on error.
 */
export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const startTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

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

        const workflowData = {
          state: 'CHANCE_ACTIVE',
          winnerSelectionStart: startTime,
          currentCastHash: castData.cast?.hash || null,
        };

        await redis.set('workflowState', JSON.stringify(workflowData));
      } else {
        const castErrorData = await castResponse.json();
        console.warn(
          '[enable-random-winner] Failed to send random winner enabled cast (non-critical):',
          castErrorData.error
        );

        const workflowData = {
          state: 'CHANCE_ACTIVE',
          winnerSelectionStart: startTime,
          currentCastHash: null,
        };

        await redis.set('workflowState', JSON.stringify(workflowData));
      }
    } catch (err) {
      console.warn(
        '[enable-random-winner] Failed to send random winner enabled cast (non-critical):',
        err
      );
    }

    return NextResponse.json({
      success: true,
      winnerSelectionStart: startTime,
      castHash: null,
    });
  } catch (error) {
    console.error('[enable-random-winner] Error:', error);
    return NextResponse.json({ error: 'Failed to enable random winner' }, { status: 500 });
  }
}
