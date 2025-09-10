import { NextResponse } from 'next/server';
import { redis } from '@/lib/kv';
import type { CurrentHolderData } from '@/types/nft';
import crypto from 'crypto';

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
    console.log('🔔 [webhook] Received webhook:', rawBody.substring(0, 200) + '...');

    if (process.env.NEYNAR_WEBHOOK_SECRET) {
      const signature = request.headers.get('X-Neynar-Signature');
      if (!signature) {
        console.error('🚨 [webhook] Neynar signature missing from request headers');
        console.error('🚨 [webhook] Available headers:', Object.fromEntries(request.headers.entries()));
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
      }

      if (!validateWebhook(rawBody, signature, process.env.NEYNAR_WEBHOOK_SECRET)) {
        console.error('🚨 [webhook] Invalid webhook signature');
        console.error('🚨 [webhook] Expected signature validation failed');
        console.error('🚨 [webhook] Received signature:', signature);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
      console.log('✅ [webhook] Signature validation passed');
    } else {
      console.warn('⚠️ [webhook] NEYNAR_WEBHOOK_SECRET not configured - skipping signature validation');
    }

    const body = JSON.parse(rawBody);
    console.log('📨 [webhook] Webhook type:', body.type);
    console.log('📨 [webhook] Full webhook data:', JSON.stringify(body, null, 2));

    if (body.type === 'cast.created') {
      const cast = body.data;
      const castText = cast.text;
      const authorFid = cast.author.fid;

      console.log(`🔍 [webhook] Processing cast.created: hash=${cast.hash}, author_fid=${authorFid}`);
      console.log(`🔍 [webhook] Cast text: "${castText}"`);

      const containsChoochoo = castText.toLowerCase().includes('@choochoo');
      console.log(`🔍 [webhook] Contains @choochoo: ${containsChoochoo}`);

      if (containsChoochoo) {
        console.log(`🎯 [webhook] @choochoo cast detected! Processing...`);
        
        const holderDataString = await redis.get('current-holder');
        if (!holderDataString) {
          console.error('🚨 [webhook] No current holder found in Redis - this is a critical error');
          console.error('🚨 [webhook] Redis current-holder key is missing or null');
          return NextResponse.json({ success: true });
        }

        let currentHolder: CurrentHolderData;
        try {
          currentHolder = JSON.parse(holderDataString);
          console.log('🔍 [webhook] Current holder data:', JSON.stringify(currentHolder, null, 2));
        } catch (parseError) {
          console.error('🚨 [webhook] Failed to parse current holder data:', parseError);
          console.error('🚨 [webhook] Raw holder data:', holderDataString);
          return NextResponse.json({ success: true });
        }

        if (!currentHolder.fid) {
          console.error('🚨 [webhook] Current holder missing FID field');
          console.error('🚨 [webhook] Holder object:', currentHolder);
          return NextResponse.json({ success: true });
        }

        // Ensure consistent string comparison for FIDs
        const currentHolderFid = String(currentHolder.fid);
        const castAuthorFid = String(authorFid);

        console.log(`🔍 [webhook] FID Comparison Details:`);
        console.log(`🔍 [webhook]   Current holder FID: "${currentHolderFid}" (type: ${typeof currentHolder.fid})`);
        console.log(`🔍 [webhook]   Cast author FID: "${castAuthorFid}" (type: ${typeof authorFid})`);
        console.log(`🔍 [webhook]   FIDs match: ${currentHolderFid === castAuthorFid}`);

        if (currentHolderFid === castAuthorFid) {
          console.log(`✅ [webhook] FID match confirmed! Processing cast from current holder`);
          
          const workflowData = {
            state: 'CASTED',
            winnerSelectionStart: null,
            currentCastHash: cast.hash,
          };

          try {
            await redis.set('workflowState', JSON.stringify(workflowData));
            console.log(`✅ [webhook] Updated workflow state to CASTED with hash ${cast.hash}`);
            console.log(`✅ [webhook] Workflow data stored:`, workflowData);
          } catch (redisError) {
            console.error('🚨 [webhook] Failed to update workflow state in Redis:', redisError);
            return NextResponse.json({ error: 'Failed to update workflow state' }, { status: 500 });
          }

          console.log(`🎉 [webhook] @choochoo cast successfully processed from current holder: ${cast.hash}`);
          return NextResponse.json({ success: true, message: 'Cast processed' });
        } else {
          console.log(`ℹ️ [webhook] @choochoo cast detected but NOT from current holder`);
          console.log(`ℹ️ [webhook] Current holder: ${currentHolder.username} (FID: ${currentHolderFid})`);
          console.log(`ℹ️ [webhook] Cast author: ${cast.author.username} (FID: ${castAuthorFid})`);
          console.log(`ℹ️ [webhook] Ignoring cast from non-holder`);
        }
      } else {
        console.log(`ℹ️ [webhook] Cast does not contain @choochoo, ignoring`);
      }
    } else {
      console.log(`ℹ️ [webhook] Non-cast webhook type: ${body.type}, ignoring`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('🚨 [webhook] Critical webhook error:', error);
    console.error('🚨 [webhook] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
