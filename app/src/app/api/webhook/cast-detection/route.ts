import { NextResponse } from 'next/server';
import { setCastHash, getCurrentHolder } from '@/lib/kv';
import axios from 'axios';
import crypto from 'crypto';

function validateWebhook(body: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');

  return signature === `sha256=${expectedSignature}`;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    // Validate webhook signature if secret is configured
    if (process.env.WEBHOOK_SECRET) {
      const signature = request.headers.get('x-neynar-signature');
      if (!signature || !validateWebhook(rawBody, signature, process.env.WEBHOOK_SECRET)) {
        console.error('Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody);

    // Neynar webhook payload for new casts
    if (body.type === 'cast.created') {
      const cast = body.data;
      const castText = cast.text;
      const authorFid = cast.author.fid;

      // Check if this matches our template
      const expectedTextPart = "I'm riding @choochoo!";

      if (castText.includes(expectedTextPart)) {
        // Check if author is current holder
        const currentHolder = await getCurrentHolder();

        if (currentHolder?.fid === authorFid) {
          // Update the active cast hash
          await setCastHash(cast.hash);

          // Mark user as having casted
          await axios.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/user-casted-status`, {
            hasCurrentUserCasted: true,
          });

          console.log(`✅ Cast detected from current holder via webhook: ${cast.hash}`);
          return NextResponse.json({ success: true, message: 'Cast processed' });
        } else {
          console.log(`ℹ️ ChooChoo cast detected but not from current holder: FID ${authorFid}`);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
