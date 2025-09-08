import { NextResponse } from 'next/server';
import { redis } from '@/lib/kv';
import { CHOOCHOO_CAST_TEMPLATES, APP_URL } from '@/lib/constants';
import type { NeynarBulkUsersResponse } from '@/types/neynar';

export async function POST() {
  try {
    // Enable public send
    await redis.set('isPublicSendEnabled', 'true');

    // Resolve current holder username (fallback to fid if missing)
    let username = 'a passenger';
    try {
      const holderString = await redis.get('current-holder');
      if (holderString) {
        const holder = JSON.parse(holderString) as { fid?: number; username?: string };
        if (holder?.username) {
          username = holder.username;
        } else if (holder?.fid) {
          // Fallback: resolve via Neynar API
          const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
          if (NEYNAR_API_KEY) {
            const userResponse = await fetch(
              `https://api.neynar.com/v2/farcaster/user/bulk?fids=${holder.fid}`,
              {
                headers: {
                  accept: 'application/json',
                  'x-api-key': NEYNAR_API_KEY,
                },
              }
            );
            if (userResponse.ok) {
              const userData: NeynarBulkUsersResponse = await userResponse.json();
              const users = userData?.users || [];
              if (users.length > 0 && users[0].username) {
                username = users[0].username;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[enable-public-send] Failed to resolve current holder username:', err);
    }

    // Send the PUBLIC_SEND_OPEN cast
    const INTERNAL_SECRET = process.env.INTERNAL_SECRET;
    const castResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/internal/send-cast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET || '',
      },
      body: JSON.stringify({
        text: CHOOCHOO_CAST_TEMPLATES.PUBLIC_SEND_OPEN(username),
        embeds: [{ url: APP_URL }],
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
