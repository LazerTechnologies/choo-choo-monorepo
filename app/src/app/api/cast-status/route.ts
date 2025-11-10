import { NextResponse } from 'next/server';
import { apiLog } from '@/lib/event-log';
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

  apiLog.info('cast-status.request', {
    fid,
    msg: `Checking cast status for FID: ${fid}`,
  });

  if (!fid) {
    apiLog.warn('cast-status.validation_failed', {
      msg: 'Missing FID parameter',
    });
    return NextResponse.json({ error: 'FID required' }, { status: 400 });
  }

  try {
    const workflowStateJson = await redis.get('workflowState');
    apiLog.debug('cast-status.request', {
      fid,
      hasWorkflowState: !!workflowStateJson,
      msg: 'Retrieved workflow state from Redis',
    });

    if (workflowStateJson) {
      const workflowData = JSON.parse(workflowStateJson);
      apiLog.debug('cast-status.request', {
        fid,
        state: workflowData.state,
        currentCastHash: workflowData.currentCastHash,
        msg: 'Parsed workflow data',
      });

      // User has casted if they're in CASTED, CHANCE_ACTIVE, CHANCE_EXPIRED, or MANUAL_SEND states
      const hasCurrentUserCasted = [
        WorkflowState.CASTED,
        WorkflowState.CHANCE_ACTIVE,
        WorkflowState.CHANCE_EXPIRED,
        WorkflowState.MANUAL_SEND,
      ].includes(workflowData.state as WorkflowState);

      apiLog.debug('cast-status.request', {
        fid,
        state: workflowData.state,
        hasCurrentUserCasted,
        currentCastHash: workflowData.currentCastHash,
        msg: `Current state: ${workflowData.state}, hasCurrentUserCasted: ${hasCurrentUserCasted}`,
      });

      if (hasCurrentUserCasted && workflowData.currentCastHash) {
        apiLog.info('cast-status.cast_found', {
          fid,
          currentCastHash: workflowData.currentCastHash,
          msg: `Returning positive cast status for FID ${fid}`,
        });
        return NextResponse.json({
          hasCurrentUserCasted: true,
          currentCastHash: workflowData.currentCastHash,
        });
      }
    } else {
      apiLog.info('cast-status.cast_not_found', {
        fid,
        msg: 'No workflow state found in Redis - checking API fallback',
      });
    }

    // Fallback: Check recent casts for @choochoo or embeds containing choochoo.pro
    if (process.env.NEYNAR_API_KEY) {
      apiLog.info('cast-status.api_fallback', {
        fid,
        msg: `Checking fallback API for FID ${fid} - webhook detection failed`,
      });
      try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const afterTime = fifteenMinutesAgo.toISOString().split('.')[0]; // Remove milliseconds for API

        const response = await fetch(
          `https://api.neynar.com/v2/farcaster/cast/search/?q=@choochoo after:${afterTime}&author_fid=${fid}&limit=5`,
          {
            headers: {
              accept: 'application/json',
              'x-api-key': process.env.NEYNAR_API_KEY,
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          const casts = Array.isArray(data?.result?.casts)
            ? (data.result.casts as Array<Record<string, unknown>>)
            : [];
          apiLog.debug('cast-status.api_fallback', {
            fid,
            castsCount: casts.length,
            afterTime: fifteenMinutesAgo.toISOString(),
            msg: `Checking ${casts.length} casts since ${fifteenMinutesAgo.toISOString()}`,
          });

          for (const cast of casts) {
            const ts = (cast as { timestamp?: unknown }).timestamp;
            const castDate =
              ts && (typeof ts === 'string' || typeof ts === 'number') ? new Date(ts) : new Date(0);
            const rawText = (cast as { text?: unknown }).text;

            const hash = (cast as { hash?: unknown }).hash;
            const hashStr = typeof hash === 'string' ? hash : 'unknown-hash';
            const preview = typeof rawText === 'string' ? rawText.substring(0, 50) : '';
            apiLog.debug('cast-status.api_fallback', {
              fid,
              castHash: hashStr,
              preview,
              castDate: castDate.toISOString(),
              msg: `Examining cast ${hashStr}: "${preview}..." (${castDate.toISOString()})`,
            });

            // Search already filtered for @choochoo and time, so any result is a match
            if (castDate > fifteenMinutesAgo) {
              apiLog.info('cast-status.cast_found', {
                fid,
                castHash: hashStr,
                msg: `Found recent @choochoo cast via API fallback: ${hashStr}`,
              });

              const workflowData = {
                state: WorkflowState.CASTED,
                winnerSelectionStart: null,
                currentCastHash: hashStr,
              };

              await redis.set('workflowState', JSON.stringify(workflowData));
              apiLog.info('cast-status.workflow_updated', {
                fid,
                castHash: hashStr,
                state: 'CASTED',
                msg: `Updated workflow state to CASTED with hash ${hashStr}`,
              });

              return NextResponse.json({
                hasCurrentUserCasted: true,
                currentCastHash: hashStr,
              });
            }
          }
          apiLog.warn('cast-status.cast_not_found', {
            fid,
            msg: `No @choochoo casts found in last 15 minutes for FID ${fid}`,
          });
        } else {
          apiLog.error('cast-status.failed', {
            fid,
            status: response.status,
            statusText: response.statusText,
            msg: `Neynar API error: ${response.status} ${response.statusText}`,
          });
        }
      } catch (apiError) {
        apiLog.error('cast-status.failed', {
          fid,
          error: apiError instanceof Error ? apiError.message : 'Unknown error',
          msg: 'Error checking recent casts',
        });
      }
    } else {
      apiLog.warn('cast-status.failed', {
        fid,
        msg: 'NEYNAR_API_KEY not configured - fallback detection disabled',
      });
    }

    apiLog.info('cast-status.cast_not_found', {
      fid,
      msg: `No cast found for FID ${fid} - returning negative result`,
    });
    return NextResponse.json({
      hasCurrentUserCasted: false,
      currentCastHash: null,
    });
  } catch (error) {
    apiLog.error('cast-status.failed', {
      fid,
      error: error instanceof Error ? error.message : 'Unknown error',
      msg: 'Error checking cast status',
    });
    return NextResponse.json({ error: 'Failed to check cast status' }, { status: 500 });
  }
}
