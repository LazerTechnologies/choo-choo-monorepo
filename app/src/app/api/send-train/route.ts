import { NextResponse } from 'next/server';
import { redis } from '@/lib/kv';
import { orchestrateRandomSend } from '@/lib/train-orchestrator';

/**
 * POST /api/send-train
 *
 * Public random winner selection endpoint. Anyone can call this when chance mode is active.
 * Uses orchestrateRandomSend for centralized state management.
 *
 * @param request - The HTTP request object (no body required).
 * @returns 200 with { success: true, winner, tokenId, txHash, tokenURI, totalEligibleReactors } on success, or 400/500 with error message.
 */
export async function POST() {
  try {
    console.log('[send-train] 🫡 Public random winner selection request');

    // 1. Get current cast hash from workflow state
    let castHash;
    try {
      const workflowStateJson = await redis.get('workflowState');
      if (!workflowStateJson) {
        console.error('[send-train] No workflow state found in Redis');
        return NextResponse.json({ error: 'No active workflow state found.' }, { status: 400 });
      }

      const workflowData = JSON.parse(workflowStateJson);
      castHash = workflowData.currentCastHash;

      if (!castHash) {
        console.error('[send-train] No current cast hash found in workflow state');
        return NextResponse.json(
          { error: 'No active cast found. The current holder must publish a cast first.' },
          { status: 400 }
        );
      }
    } catch (err) {
      console.error('[send-train] Failed to get cast hash from Redis:', err);
      return NextResponse.json({ error: 'Failed to retrieve current cast' }, { status: 500 });
    }

    console.log(`[send-train] Starting orchestration for cast: ${castHash}`);

    // 2. Call centralized random send orchestrator
    const outcome = await orchestrateRandomSend(castHash);
    if (outcome.status === 409) {
      return NextResponse.json({ error: 'Random send already in progress' }, { status: 409 });
    }
    if (outcome.status !== 200) {
      return NextResponse.json(
        { error: outcome.body.error || 'Random send failed' },
        { status: 500 }
      );
    }

    return NextResponse.json(outcome.body);
  } catch (error) {
    console.error('[send-train] Orchestration failed:', error);
    return NextResponse.json({ error: 'Failed to process train movement' }, { status: 500 });
  }
}
