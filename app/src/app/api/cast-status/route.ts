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

    if (workflowStateJson) {
      const workflowData = JSON.parse(workflowStateJson);

      // User has casted if they're in CASTED, CHANCE_ACTIVE, CHANCE_EXPIRED, or MANUAL_SEND states
      const hasCurrentUserCasted = [
        WorkflowState.CASTED,
        WorkflowState.CHANCE_ACTIVE,
        WorkflowState.CHANCE_EXPIRED,
        WorkflowState.MANUAL_SEND,
      ].includes(workflowData.state as WorkflowState);

      if (hasCurrentUserCasted && workflowData.currentCastHash) {
        return NextResponse.json({
          hasCurrentUserCasted: true,
          currentCastHash: workflowData.currentCastHash,
        });
      }
    }

    // Fallback: Check recent casts for @choochoo (only if webhook hasn't detected it yet)
    if (process.env.NEYNAR_API_KEY) {
      try {
        const response = await fetch(
          `https://api.neynar.com/v2/farcaster/casts?fid=${fid}&limit=5`,
          {
            headers: {
              accept: 'application/json',
              api_key: process.env.NEYNAR_API_KEY,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

          for (const cast of data.casts || []) {
            const castDate = new Date(cast.timestamp);
            const castText = cast.text?.toLowerCase() || '';

            if (castDate > fiveMinutesAgo && castText.includes('@choochoo')) {
              console.log(`✅ Found recent @choochoo cast via API: ${cast.hash}`);

              const workflowData = {
                state: WorkflowState.CASTED,
                winnerSelectionStart: null,
                currentCastHash: cast.hash,
              };

              await redis.set('workflowState', JSON.stringify(workflowData));

              return NextResponse.json({
                hasCurrentUserCasted: true,
                currentCastHash: cast.hash,
              });
            }
          }
        }
      } catch (apiError) {
        console.error('Error checking recent casts:', apiError);
      }
    }

    return NextResponse.json({
      hasCurrentUserCasted: false,
      currentCastHash: null,
    });
  } catch (error) {
    console.error('Error checking cast status:', error);
    return NextResponse.json({ error: 'Failed to check cast status' }, { status: 500 });
  }
}
