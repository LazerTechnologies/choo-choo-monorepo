import { NextResponse } from 'next/server';
import { z } from 'zod';
import { redis } from '@/lib/kv';
import { WorkflowState, type WorkflowData, DEFAULT_WORKFLOW_DATA } from '@/lib/workflow-types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const updateWorkflowSchema = z.object({
  state: z.nativeEnum(WorkflowState),
  winnerSelectionStart: z.string().nullable().optional(),
  currentCastHash: z.string().nullable().optional(),
});

/**
 * GET /api/workflow-state
 *
 * Returns the current workflow state from Redis
 *
 * @returns 200 on success, 500 on error.
 */
export async function GET() {
  try {
    const workflowStateJson = await redis.get('workflowState');

    if (!workflowStateJson) {
      return NextResponse.json(DEFAULT_WORKFLOW_DATA, {
        headers: {
          'Cache-Control': 'no-store',
        },
      });
    }

    // Check if the data is corrupted with Redis command prefix
    let cleanedJson = workflowStateJson;
    if (
      typeof workflowStateJson === 'string' &&
      workflowStateJson.startsWith('SET workflowState ')
    ) {
      console.warn('Detected corrupted workflow state data with SET prefix, cleaning...');
      // Extract the JSON part after the SET command
      const jsonMatch = workflowStateJson.match(/SET workflowState '(.+)'$/);
      if (jsonMatch && jsonMatch[1]) {
        cleanedJson = jsonMatch[1];
        console.log('Cleaned workflow state data:', cleanedJson);

        // Store the cleaned data back to Redis
        await redis.set('workflowState', cleanedJson);
        console.log('Stored cleaned workflow state back to Redis');
      } else {
        console.error('Could not extract JSON from corrupted data, using default');
        cleanedJson = JSON.stringify(DEFAULT_WORKFLOW_DATA);
        await redis.set('workflowState', cleanedJson);
      }
    }

    const workflowData = JSON.parse(cleanedJson) as WorkflowData;
    return NextResponse.json(workflowData, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error fetching workflow state:', error);
    console.error('Raw workflow state data:', await redis.get('workflowState'));

    // Reset to default state if parsing fails
    try {
      await redis.set('workflowState', JSON.stringify(DEFAULT_WORKFLOW_DATA));
      console.log('Reset workflow state to default due to parsing error');
    } catch (resetError) {
      console.error('Failed to reset workflow state:', resetError);
    }

    return NextResponse.json(DEFAULT_WORKFLOW_DATA, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }
}

/**
 * POST /api/workflow-state
 *
 * Updates the workflow state in Redis
 *
 * @param request - The HTTP request object containing the workflow state data.
 * @returns 200 on success, 400 if request data is invalid, 500 on error.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = updateWorkflowSchema.parse(body);

    // Read existing workflow state to support partial updates (preserve unspecified fields)
    let existing: WorkflowData = DEFAULT_WORKFLOW_DATA;
    try {
      const existingJson = await redis.get('workflowState');
      if (existingJson) existing = JSON.parse(existingJson) as WorkflowData;
    } catch (err) {
      console.warn('[workflow-state] Failed to read existing state, using defaults:', err);
    }

    // Determine whether the request explicitly included these fields
    const bodyHasWinnerStart = Object.hasOwn(body, 'winnerSelectionStart');
    const bodyHasCastHash = Object.hasOwn(body, 'currentCastHash');

    const merged: WorkflowData = {
      state: validated.state,
      // If field present in request: use validated value (can be null to clear)
      // If absent: preserve existing value
      winnerSelectionStart: bodyHasWinnerStart
        ? (validated.winnerSelectionStart ?? null)
        : (existing.winnerSelectionStart ?? null),
      currentCastHash: bodyHasCastHash
        ? (validated.currentCastHash ?? null)
        : (existing.currentCastHash ?? null),
    };

    await redis.set('workflowState', JSON.stringify(merged));

    return NextResponse.json(merged, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error updating workflow state:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(
      { error: 'Failed to update workflow state' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
