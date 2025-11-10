import { type NextRequest, NextResponse } from 'next/server';
import { apiLog } from '@/lib/event-log';
import { scheduler } from '@/lib/scheduler';

/**
 * POST /api/init-scheduler
 *
 * Internal endpoint to initialize the scheduler.
 * This can be called during application startup or health checks.
 *
 * Protected by INTERNAL_SECRET to prevent unauthorized access.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify internal secret for security
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.INTERNAL_SECRET}`;

    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize the scheduler
    scheduler.initialize();

    return NextResponse.json({
      success: true,
      message: 'Scheduler initialized successfully',
    });
  } catch (error) {
    apiLog.error('init-scheduler.failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      msg: 'Error',
    });
    return NextResponse.json(
      {
        error: 'Failed to initialize scheduler',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/init-scheduler
 *
 * Health check endpoint that also ensures scheduler is running
 */
export async function GET() {
  try {
    // Initialize scheduler if not already running
    scheduler.initialize();

    return NextResponse.json({
      success: true,
      message: 'Scheduler is running',
    });
  } catch (error) {
    apiLog.error('init-scheduler.failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      msg: 'Error',
    });
    return NextResponse.json(
      {
        error: 'Scheduler initialization failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
