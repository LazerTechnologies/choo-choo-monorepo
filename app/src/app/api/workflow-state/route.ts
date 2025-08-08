import { NextResponse } from 'next/server';
import { z } from 'zod';
import { redis } from '@/lib/kv';
import { WorkflowState, WorkflowData, DEFAULT_WORKFLOW_DATA } from '@/lib/workflow-types';

// Validation schema for POST requests
const updateWorkflowSchema = z.object({
  state: z.nativeEnum(WorkflowState),
  winnerSelectionStart: z.string().nullable().optional(),
  currentCastHash: z.string().nullable().optional(),
});

/**
 * GET /api/workflow-state
 *
 * Returns the current workflow state from Redis
 */
export async function GET() {
  try {
    const [workflowState, winnerSelectionStart, currentCastHash, hasCurrentUserCasted] =
      await Promise.all([
        redis.get('workflow-state'),
        redis.get('winnerSelectionStart'),
        redis.get('current-cast-hash'),
        redis.get('hasCurrentUserCasted'),
      ]);

    // If no workflow state exists, determine it from legacy flags
    let currentState = workflowState as WorkflowState;

    if (!currentState) {
      // Migrate from legacy state to new workflow state
      if (!hasCurrentUserCasted || hasCurrentUserCasted !== 'true') {
        currentState = WorkflowState.NOT_CASTED;
      } else if (currentCastHash) {
        // Check if we're in chance mode
        const [useRandomWinner, isPublicSendEnabled] = await Promise.all([
          redis.get('useRandomWinner'),
          redis.get('isPublicSendEnabled'),
        ]);

        if (useRandomWinner === 'true') {
          if (isPublicSendEnabled === 'true') {
            currentState = WorkflowState.CHANCE_EXPIRED;
          } else {
            currentState = WorkflowState.CHANCE_ACTIVE;
          }
        } else {
          currentState = WorkflowState.CASTED;
        }
      } else {
        currentState = WorkflowState.CASTED;
      }

      // Save the migrated state
      await redis.set('workflow-state', currentState);
    }

    const response: WorkflowData = {
      state: currentState,
      winnerSelectionStart: winnerSelectionStart || null,
      currentCastHash: currentCastHash || null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching workflow state:', error);
    return NextResponse.json(DEFAULT_WORKFLOW_DATA);
  }
}

/**
 * POST /api/workflow-state
 *
 * Updates the workflow state in Redis
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = updateWorkflowSchema.parse(body);

    // Update workflow state
    await redis.set('workflow-state', validated.state);

    // Update additional data if provided
    if (validated.winnerSelectionStart !== undefined) {
      if (validated.winnerSelectionStart === null) {
        await redis.del('winnerSelectionStart');
      } else {
        await redis.set('winnerSelectionStart', validated.winnerSelectionStart);
      }
    }

    if (validated.currentCastHash !== undefined) {
      if (validated.currentCastHash === null) {
        await redis.del('current-cast-hash');
      } else {
        await redis.set('current-cast-hash', validated.currentCastHash);
      }
    }

    // Set appropriate flags based on state
    switch (validated.state) {
      case WorkflowState.NOT_CASTED:
        await Promise.all([
          redis.del('hasCurrentUserCasted'),
          redis.del('current-cast-hash'),
          redis.del('winnerSelectionStart'),
          redis.del('useRandomWinner'),
          redis.del('isPublicSendEnabled'),
        ]);
        break;

      case WorkflowState.CASTED:
        await redis.set('hasCurrentUserCasted', 'true');
        await Promise.all([
          redis.del('useRandomWinner'),
          redis.del('isPublicSendEnabled'),
          redis.del('winnerSelectionStart'),
        ]);
        break;

      case WorkflowState.CHANCE_ACTIVE:
        await Promise.all([
          redis.set('hasCurrentUserCasted', 'true'),
          redis.set('useRandomWinner', 'true'),
          redis.set('isPublicSendEnabled', 'false'),
        ]);
        break;

      case WorkflowState.CHANCE_EXPIRED:
        await Promise.all([
          redis.set('hasCurrentUserCasted', 'true'),
          redis.set('useRandomWinner', 'true'),
          redis.set('isPublicSendEnabled', 'true'),
        ]);
        break;

      case WorkflowState.MANUAL_SEND:
        await redis.set('hasCurrentUserCasted', 'true');
        break;
    }

    const response: WorkflowData = {
      state: validated.state,
      winnerSelectionStart: validated.winnerSelectionStart || null,
      currentCastHash: validated.currentCastHash || null,
    };

    return NextResponse.json(response);
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
