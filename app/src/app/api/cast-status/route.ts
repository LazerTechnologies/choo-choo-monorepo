import { NextResponse } from 'next/server';
import { redis } from '@/lib/kv';
import { WorkflowState } from '@/lib/workflow-types';

/**
 * GET /api/cast-status
 *
 * Checks the workflow state to determine if the current user has casted.
 *
 * @param request - The HTTP request object containing the FID of the user to check.
 * @returns 200 on success, 400 if FID is missing.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get('fid');

  if (!fid) {
    return NextResponse.json({ error: 'FID required' }, { status: 400 });
  }

  try {
    const workflowStateJson = await redis.get('workflowState');

    if (!workflowStateJson) {
      return NextResponse.json({
        hasCurrentUserCasted: false,
        currentCastHash: null,
      });
    }

    const workflowData = JSON.parse(workflowStateJson);

    // User has casted if they're in CASTED, CHANCE_ACTIVE, CHANCE_EXPIRED, or MANUAL_SEND states
    const hasCurrentUserCasted = [
      WorkflowState.CASTED,
      WorkflowState.CHANCE_ACTIVE,
      WorkflowState.CHANCE_EXPIRED,
      WorkflowState.MANUAL_SEND,
    ].includes(workflowData.state as WorkflowState);

    return NextResponse.json({
      hasCurrentUserCasted,
      currentCastHash: workflowData.currentCastHash,
    });
  } catch (error) {
    console.error('Error checking cast status:', error);
    return NextResponse.json({ error: 'Failed to check cast status' }, { status: 500 });
  }
}
