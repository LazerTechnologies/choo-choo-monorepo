import { NextResponse } from 'next/server';
import { redis } from '@/lib/kv';
import { CHOOCHOO_CAST_TEMPLATES } from '@/lib/constants';
import { requireAdmin } from '@/lib/auth/require-admin';

const APP_PAUSE_KEY = 'app-paused';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

/**
 * Send a maintenance cast from the ChooChoo account
 */
async function sendMaintenanceCast(isPaused: boolean): Promise<void> {
  if (!INTERNAL_SECRET) {
    console.warn('[admin-app-pause] INTERNAL_SECRET not configured, skipping cast');
    return;
  }

  try {
    const castText = isPaused
      ? CHOOCHOO_CAST_TEMPLATES.MAINTENANCE_STARTED()
      : CHOOCHOO_CAST_TEMPLATES.MAINTENANCE_ENDED();

    const response = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/internal/send-cast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET,
      },
      body: JSON.stringify({
        text: castText,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`[admin-app-pause] Maintenance cast sent: ${result.cast?.hash}`);
    } else {
      const errorText = await response.text();
      console.error('[admin-app-pause] Failed to send maintenance cast:', errorText);
    }
  } catch (error) {
    console.error('[admin-app-pause] Error sending maintenance cast:', error);
  }
}

/**
 * GET /api/admin-app-pause
 *
 * Returns the current app pause state
 */
export async function GET() {
  try {
    const isPaused = await redis.get(APP_PAUSE_KEY);
    return NextResponse.json({
      isPaused: isPaused === 'true',
    });
  } catch (error) {
    console.error('[admin-app-pause] Error getting pause state:', error);
    return NextResponse.json({ error: 'Failed to get pause state' }, { status: 500 });
  }
}

/**
 * POST /api/admin-app-pause
 *
 * Sets the app pause state
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { isPaused } = body as { isPaused: boolean };

    // Validate isPaused is boolean
    if (typeof isPaused !== 'boolean') {
      return NextResponse.json({ error: 'isPaused must be a boolean' }, { status: 400 });
    }

    // Set the pause state in Redis
    await redis.set(APP_PAUSE_KEY, isPaused.toString());

    console.log(`[admin-app-pause] Admin ${auth.adminFid} set app pause state to: ${isPaused}`);

    // Send maintenance cast announcement
    try {
      await sendMaintenanceCast(isPaused);
    } catch (error) {
      console.error('[admin-app-pause] Failed to send maintenance cast (non-blocking):', error);
      // Don't fail the API call if cast fails
    }

    return NextResponse.json({
      success: true,
      isPaused,
    });
  } catch (error) {
    console.error('[admin-app-pause] Error setting pause state:', error);
    return NextResponse.json({ error: 'Failed to set pause state' }, { status: 500 });
  }
}
