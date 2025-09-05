import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/kv';
import { CHOOCHOO_CAST_TEMPLATES } from '@/lib/constants';
import type { NeynarBulkUsersResponse } from '@/types/neynar';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

/**
 * POST /api/enable-random-winner
 *
 * Enables random winner mode by sending a cast announcing the feature.
 * Updates the workflow state to CHANCE_ACTIVE with the announcement cast hash.
 *
 * @param request - The HTTP request object containing the FID of the user enabling random winner.
 * @returns 200 on success, 400 if FID is missing, 500 on error.
 */
export async function POST(request: NextRequest) {
  try {
    const { fid } = await request.json();

    if (!fid) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    // Resolve username from FID using Neynar API (same pattern as /api/users/address)
    let username = `user-${fid}`; // fallback
    try {
      if (NEYNAR_API_KEY) {
        console.log('[enable-random-winner] Calling Neynar API for FID:', fid);
        const userResponse = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
          headers: {
            accept: 'application/json',
            'x-api-key': NEYNAR_API_KEY,
          },
        });
        
        console.log('[enable-random-winner] Neynar API response status:', userResponse.status);
        
        if (userResponse.ok) {
          const userData: NeynarBulkUsersResponse = await userResponse.json();
          const users = userData?.users || [];
          
          console.log('[enable-random-winner] Neynar API returned users count:', users.length);
          
          if (users.length > 0 && users[0].username) {
            username = users[0].username;
            console.log('[enable-random-winner] Resolved username:', username);
          } else {
            console.log('[enable-random-winner] No username found, using fallback');
          }
        } else {
          console.warn('[enable-random-winner] Neynar API returned non-OK status:', userResponse.status);
        }
      } else {
        console.warn('[enable-random-winner] No Neynar API key configured');
      }
    } catch (error) {
      console.warn('[enable-random-winner] Failed to resolve username for FID:', fid, error);
      // Continue with fallback username
    }
    
    console.log('[enable-random-winner] Final username for cast:', username);

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
