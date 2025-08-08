import { NextResponse } from 'next/server';
import { z } from 'zod';
import { redis } from '@/lib/kv';
import { WorkflowState, WorkflowData, DEFAULT_WORKFLOW_DATA } from '@/lib/workflow-types';

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
      return NextResponse.json(DEFAULT_WORKFLOW_DATA);
    }

    const workflowData = JSON.parse(workflowStateJson) as WorkflowData;
    return NextResponse.json(workflowData);
  } catch (error) {
    console.error('Error fetching workflow state:', error);
    return NextResponse.json(DEFAULT_WORKFLOW_DATA);
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

    const workflowData: WorkflowData = {
      state: validated.state,
      winnerSelectionStart: validated.winnerSelectionStart || null,
      currentCastHash: validated.currentCastHash || null,
    };

    await redis.set('workflowState', JSON.stringify(workflowData));

    return NextResponse.json(workflowData);
  } catch (error) {
    console.error('Error updating workflow state:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Failed to update workflow state' }, { status: 500 });
  }
}
