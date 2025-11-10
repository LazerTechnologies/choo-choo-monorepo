import { NextResponse } from 'next/server';
import { checkBannedFid } from '@/lib/auth/check-banned-user';
import { apiLog } from '@/lib/event-log';
import { withAppPauseProtection } from '@/lib/middleware/app-maintenance';
import type { ApiHandler } from '@/lib/middleware/internal-auth';
import { orchestrateYoink } from '@/lib/train-orchestrator';

/**
 * POST /api/yoink
 *
 * Yoink endpoint using centralized orchestrator. Allows users to yoink the train if they have not ridden the train before and the cooldown has passed.
 * Uses orchestrateYoink for centralized state management and single-writer semantics.
 *
 * @param request - The HTTP request object with body containing { targetAddress, userFid }
 * @returns 200 with { success: true, txHash, tokenId, tokenURI, yoinkedBy } on success, or 400/500 with error message.
 */
const handlePost: ApiHandler = async (request) => {
  try {
    apiLog.info('yoink.request', {
      msg: 'Yoink request received',
    });

    // 1. Parse request body
    let targetAddress: string;
    let userFid: number;
    try {
      const body = await request.json();
      targetAddress = body.targetAddress;
      userFid = body.userFid;

      if (!targetAddress) {
        apiLog.warn('yoink.validation_failed', {
          msg: 'Missing targetAddress in request body',
        });
        return NextResponse.json(
          { error: 'targetAddress is required in request body' },
          { status: 400 },
        );
      }

      if (!userFid) {
        apiLog.warn('yoink.validation_failed', {
          msg: 'Missing userFid in request body',
        });
        return NextResponse.json({ error: 'userFid is required in request body' }, { status: 400 });
      }

      if (!/^0x[a-fA-F0-9]{40}$/i.test(targetAddress)) {
        apiLog.warn('yoink.validation_failed', {
          targetAddress,
          msg: 'Invalid address format',
        });
        return NextResponse.json({ error: 'Invalid address format' }, { status: 400 });
      }
    } catch (err) {
      apiLog.error('yoink.parse_failed', {
        error: err instanceof Error ? err.message : 'Unknown error',
        msg: 'Failed to parse request body',
      });
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // 2. Check if user is banned
    const bannedCheck = checkBannedFid(userFid);
    if (bannedCheck.isBanned) {
      apiLog.info('yoink.unauthorized', {
        fid: userFid,
        msg: 'Banned user blocked from yoink route',
      });
      return bannedCheck.response || NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // 3. Call centralized yoink orchestrator
    const outcome = await orchestrateYoink(userFid, targetAddress);
    if (outcome.status === 409) {
      return NextResponse.json({ error: 'Yoink already in progress' }, { status: 409 });
    }
    if (outcome.status !== 200) {
      apiLog.error('yoink.failed', {
        fid: userFid,
        status: outcome.status,
        error: outcome.body.error,
        msg: 'Yoink orchestration failed',
      });
      return NextResponse.json({ error: outcome.body.error || 'Yoink failed' }, { status: 500 });
    }

    apiLog.info('yoink.success', {
      fid: userFid,
      msg: 'Yoink request completed successfully',
    });
    return NextResponse.json(outcome.body);
  } catch (error) {
    apiLog.error('yoink.failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      msg: 'Yoink orchestration failed with exception',
    });
    return NextResponse.json({ error: 'Failed to process yoink' }, { status: 500 });
  }
};

export const POST = withAppPauseProtection(handlePost);
