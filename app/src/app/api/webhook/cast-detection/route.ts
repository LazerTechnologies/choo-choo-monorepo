import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { apiLog } from '@/lib/event-log';
import { redis } from '@/lib/kv';
import type { CurrentHolderData } from '@/types/nft';

function validateWebhook(body: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto.createHmac('sha512', secret).update(body).digest('hex');

  return signature === expectedSignature;
}

/**
 * POST /api/webhook/cast-detection
 *
 * Handles the Neynar webhook for new casts.
 * Validates the webhook signature and updates the workflow state if the cast is from the current holder.
 *
 * @param request - The HTTP request object containing the webhook payload.
 * @returns 200 on success, 401 if signature is invalid, 500 on error.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    apiLog.info('webhook.received', {
      bodyPreview: `${rawBody.substring(0, 200)}...`,
      msg: 'Received webhook',
    });

    if (process.env.NEYNAR_WEBHOOK_SECRET) {
      const signature = request.headers.get('X-Neynar-Signature');
      if (!signature) {
        apiLog.error('webhook.failed', {
          msg: 'Neynar signature missing from request headers',
          availableHeaders: Object.keys(Object.fromEntries(request.headers.entries())),
        });
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
      }

      if (!validateWebhook(rawBody, signature, process.env.NEYNAR_WEBHOOK_SECRET)) {
        apiLog.error('webhook.failed', {
          msg: 'Invalid webhook signature',
          receivedSignature: `${signature.substring(0, 20)}...`,
        });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
      apiLog.info('webhook.signature_validated', {
        msg: 'Signature validation passed',
      });
    } else {
      apiLog.warn('webhook.failed', {
        msg: 'NEYNAR_WEBHOOK_SECRET not configured - skipping signature validation',
      });
    }

    const body = JSON.parse(rawBody);
    apiLog.debug('webhook.received', {
      webhookType: body.type,
      msg: `Webhook type: ${body.type}`,
    });

    if (body.type === 'cast.created') {
      const cast = body.data;
      const castText = cast.text;
      const authorFid = cast.author.fid;

      apiLog.info('webhook.received', {
        castHash: cast.hash,
        authorFid,
        castText: castText?.substring(0, 100),
        msg: `Processing cast.created: hash=${cast.hash}, author_fid=${authorFid}`,
      });

      const containsChoochoo = castText.toLowerCase().includes('@choochoo');
      let containsChoochooEmbed = false;
      try {
        const embeds: Array<Record<string, unknown>> = Array.isArray(cast.embeds)
          ? (cast.embeds as Array<Record<string, unknown>>)
          : [];
        containsChoochooEmbed = embeds.some((e: Record<string, unknown>) => {
          const raw = e as { url?: unknown; uri?: unknown; href?: unknown };
          const candidate = (raw.url || raw.uri || raw.href) as unknown;
          const url = typeof candidate === 'string' ? candidate.toLowerCase() : undefined;
          return !!url && (url.includes('choochoo.pro') || url.includes('choochoo'));
        });
      } catch {}
      apiLog.debug('webhook.received', {
        castHash: cast.hash,
        containsChoochoo,
        containsChoochooEmbed,
        msg: `Contains @choochoo: ${containsChoochoo}, contains choochoo.pro embed: ${containsChoochooEmbed}`,
      });

      if (containsChoochoo || containsChoochooEmbed) {
        apiLog.info('webhook.received', {
          castHash: cast.hash,
          msg: '@choochoo cast detected! Processing...',
        });

        const holderDataString = await redis.get('current-holder');
        if (!holderDataString) {
          apiLog.error('webhook.failed', {
            castHash: cast.hash,
            msg: 'No current holder found in Redis - this is a critical error',
          });
          return NextResponse.json({ success: true });
        }

        let currentHolder: CurrentHolderData;
        try {
          currentHolder = JSON.parse(holderDataString);
          apiLog.debug('webhook.received', {
            castHash: cast.hash,
            currentHolderFid: currentHolder.fid,
            msg: 'Current holder data retrieved',
          });
        } catch (parseError) {
          apiLog.error('webhook.failed', {
            castHash: cast.hash,
            error: parseError instanceof Error ? parseError.message : 'Unknown error',
            msg: 'Failed to parse current holder data',
          });
          return NextResponse.json({ success: true });
        }

        if (!currentHolder.fid) {
          apiLog.error('webhook.failed', {
            castHash: cast.hash,
            msg: 'Current holder missing FID field',
          });
          return NextResponse.json({ success: true });
        }

        // Ensure consistent string comparison for FIDs
        const currentHolderFid = String(currentHolder.fid);
        const castAuthorFid = String(authorFid);

        apiLog.debug('webhook.received', {
          castHash: cast.hash,
          currentHolderFid,
          castAuthorFid,
          fidMatch: currentHolderFid === castAuthorFid,
          msg: 'FID comparison',
        });

        if (currentHolderFid === castAuthorFid) {
          apiLog.info('webhook.cast_processed', {
            castHash: cast.hash,
            currentHolderFid,
            msg: 'FID match confirmed! Processing cast from current holder',
          });

          const workflowData = {
            state: 'CASTED',
            winnerSelectionStart: null,
            currentCastHash: cast.hash,
          };

          try {
            await redis.set('workflowState', JSON.stringify(workflowData));
            apiLog.info('webhook.workflow_updated', {
              castHash: cast.hash,
              state: 'CASTED',
              msg: `Updated workflow state to CASTED with hash ${cast.hash}`,
            });
          } catch (redisError) {
            apiLog.error('webhook.failed', {
              castHash: cast.hash,
              error: redisError instanceof Error ? redisError.message : 'Unknown error',
              msg: 'Failed to update workflow state in Redis',
            });
            return NextResponse.json({ error: 'Failed to update workflow state' }, { status: 500 });
          }

          apiLog.info('webhook.cast_processed', {
            castHash: cast.hash,
            msg: `@choochoo cast successfully processed from current holder: ${cast.hash}`,
          });
          return NextResponse.json({
            success: true,
            message: 'Cast processed',
          });
        }
        apiLog.info('webhook.cast_ignored', {
          castHash: cast.hash,
          currentHolderFid,
          castAuthorFid,
          currentHolderUsername: currentHolder.username,
          castAuthorUsername: cast.author.username,
          msg: '@choochoo cast detected but NOT from current holder',
        });
      } else {
        apiLog.info('webhook.cast_ignored', {
          castHash: cast.hash,
          msg: 'Cast does not contain @choochoo, ignoring',
        });
      }
    } else {
      apiLog.info('webhook.cast_ignored', {
        webhookType: body.type,
        msg: `Non-cast webhook type: ${body.type}, ignoring`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    apiLog.error('webhook.failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      msg: 'Critical webhook error',
    });
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
