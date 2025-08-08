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
    console.log('🔔 Webhook received:', rawBody.substring(0, 200) + '...');

    if (process.env.NEYNAR_WEBHOOK_SECRET) {
      const signature = request.headers.get('X-Neynar-Signature');
      if (!signature) {
        console.error('Neynar signature missing from request headers');
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
      }

      if (!validateWebhook(rawBody, signature, process.env.NEYNAR_WEBHOOK_SECRET)) {
        console.error('Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody);
    console.log('📨 Webhook type:', body.type);

    if (body.type === 'cast.created') {
      const cast = body.data;
      const castText = cast.text;
      const authorFid = cast.author.fid;

      const expectedTextPart = "I'm riding @choochoo!";

      if (castText.includes(expectedTextPart)) {
        const holderDataString = await redis.get('current-holder');
        if (!holderDataString) {
          console.log('❌ No current holder found in Redis');
          return NextResponse.json({ success: true });
        }

        const currentHolder: CurrentHolderData = JSON.parse(holderDataString);
        if (!currentHolder.fid) {
          console.log('❌ Current holder missing FID');
          return NextResponse.json({ success: true });
        }

        const currentHolderFid = Number(currentHolder.fid);
        const castAuthorFid = Number(authorFid);

        console.log(
          `🔍 Comparing FIDs: currentHolder=${currentHolderFid}, castAuthor=${castAuthorFid}`
        );
        console.log('🔍 Current holder data:', JSON.stringify(currentHolder));

        if (currentHolderFid === castAuthorFid) {
          const workflowData = {
            state: 'CASTED',
            winnerSelectionStart: null,
            currentCastHash: cast.hash,
          };

          await redis.set('workflowState', JSON.stringify(workflowData));

          console.log(`✅ Cast detected from current holder via webhook: ${cast.hash}`);
          return NextResponse.json({ success: true, message: 'Cast processed' });
        } else {
          console.log(
            `ℹ️ ChooChoo cast detected but not from current holder: currentHolder=${currentHolderFid}, castAuthor=${castAuthorFid}`
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
