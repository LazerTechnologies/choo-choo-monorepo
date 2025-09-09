import { NextRequest, NextResponse } from 'next/server';
import { scheduler } from '@/lib/scheduler';

/**
 * GET /api/scheduler-status
 * 
 * Internal endpoint to check the status of scheduled jobs.
 * Protected by INTERNAL_SECRET to prevent unauthorized access.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify internal secret for security
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.INTERNAL_SECRET}`;
    
    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get scheduler status
    const status = scheduler.getStatus();

    return NextResponse.json({
      success: true,
      jobs: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[scheduler-status] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get scheduler status',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
