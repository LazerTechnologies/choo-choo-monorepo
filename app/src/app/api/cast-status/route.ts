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

  console.log(`🔍 [cast-status] Checking cast status for FID: ${fid}`);

  if (!fid) {
    console.error(`🚨 [cast-status] Missing FID parameter`);
    return NextResponse.json({ error: 'FID required' }, { status: 400 });
  }

  try {
    const workflowStateJson = await redis.get('workflowState');
    console.log(`🔍 [cast-status] Retrieved workflow state from Redis:`, workflowStateJson);

    if (workflowStateJson) {
      const workflowData = JSON.parse(workflowStateJson);
      console.log(`🔍 [cast-status] Parsed workflow data:`, workflowData);

      // User has casted if they're in CASTED, CHANCE_ACTIVE, CHANCE_EXPIRED, or MANUAL_SEND states
      const hasCurrentUserCasted = [
        WorkflowState.CASTED,
        WorkflowState.CHANCE_ACTIVE,
        WorkflowState.CHANCE_EXPIRED,
        WorkflowState.MANUAL_SEND,
      ].includes(workflowData.state as WorkflowState);

      console.log(`🔍 [cast-status] Current state: ${workflowData.state}, hasCurrentUserCasted: ${hasCurrentUserCasted}`);
      console.log(`🔍 [cast-status] Current cast hash: ${workflowData.currentCastHash}`);

      if (hasCurrentUserCasted && workflowData.currentCastHash) {
        console.log(`✅ [cast-status] Returning positive cast status for FID ${fid}`);
        return NextResponse.json({
          hasCurrentUserCasted: true,
          currentCastHash: workflowData.currentCastHash,
        });
      }
    } else {
      console.log(`ℹ️ [cast-status] No workflow state found in Redis - checking API fallback`);
    }

    // Fallback: Check recent casts for @choochoo (only if webhook hasn't detected it yet)
    if (process.env.NEYNAR_API_KEY) {
      console.log(`🔍 [cast-status] Checking fallback API for FID ${fid} - webhook detection failed`);
      try {
        const response = await fetch(
          `https://api.neynar.com/v2/farcaster/casts?fid=${fid}&limit=10`,
          {
            headers: {
              accept: 'application/json',
              api_key: process.env.NEYNAR_API_KEY,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
          console.log(`🔍 [cast-status] Checking ${data.casts?.length || 0} casts since ${fifteenMinutesAgo.toISOString()}`);

          for (const cast of data.casts || []) {
            const castDate = new Date(cast.timestamp);
            const castText = cast.text?.toLowerCase() || '';

            console.log(`🔍 [cast-status] Examining cast ${cast.hash}: "${cast.text?.substring(0, 50)}..." (${castDate.toISOString()})`);

            if (castDate > fifteenMinutesAgo && castText.includes('@choochoo')) {
              console.log(`✅ [cast-status] Found recent @choochoo cast via API fallback: ${cast.hash}`);
              console.log(`✅ [cast-status] Cast details: FID=${cast.author.fid}, text="${cast.text}", timestamp=${cast.timestamp}`);

              const workflowData = {
                state: WorkflowState.CASTED,
                winnerSelectionStart: null,
                currentCastHash: cast.hash,
              };

              await redis.set('workflowState', JSON.stringify(workflowData));
              console.log(`✅ [cast-status] Updated workflow state to CASTED with hash ${cast.hash}`);

              return NextResponse.json({
                hasCurrentUserCasted: true,
                currentCastHash: cast.hash,
              });
            }
          }
          console.log(`🚨 [cast-status] No @choochoo casts found in last 15 minutes for FID ${fid}`);
        } else {
          console.error(`🚨 [cast-status] Neynar API error: ${response.status} ${response.statusText}`);
          const errorText = await response.text();
          console.error(`🚨 [cast-status] Neynar API error body:`, errorText);
        }
      } catch (apiError) {
        console.error('🚨 [cast-status] Error checking recent casts:', apiError);
        console.error('🚨 [cast-status] API Error details:', {
          message: apiError instanceof Error ? apiError.message : 'Unknown error',
          stack: apiError instanceof Error ? apiError.stack : undefined,
        });
      }
    } else {
      console.warn('⚠️ [cast-status] NEYNAR_API_KEY not configured - fallback detection disabled');
    }

    console.log(`🚨 [cast-status] No cast found for FID ${fid} - returning negative result`);
    return NextResponse.json({
      hasCurrentUserCasted: false,
      currentCastHash: null,
    });
  } catch (error) {
    console.error('🚨 [cast-status] Error checking cast status:', error);
    console.error('🚨 [cast-status] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: 'Failed to check cast status' }, { status: 500 });
  }
}
