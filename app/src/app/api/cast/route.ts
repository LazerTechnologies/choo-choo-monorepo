import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient, isApiErrorResponse } from '@neynar/nodejs-sdk';
import { redis } from '@/lib/kv';

export async function POST(request: NextRequest) {
  const apiKey = process.env.NEYNAR_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ message: 'Neynar API key is not configured' }, { status: 500 });
  }

  const { signerUuid, text, isUserCast } = (await request.json()) as {
    signerUuid: string;
    text: string;
    isUserCast?: boolean;
  };

  if (!signerUuid || !text) {
    return NextResponse.json(
      { message: 'Missing required fields: signerUuid and text' },
      { status: 400 }
    );
  }

  try {
    const client = new NeynarAPIClient({ apiKey });

    const response = await client.publishCast({
      signerUuid,
      text,
    });

    // Store cast hash in Redis for future reference
    // User casts are what people react to for ChooChoo selection
    if (response.cast?.hash) {
      await redis.set('current-cast-hash', response.cast.hash);
      console.log(
        `[cast-api] Stored cast hash in Redis: ${response.cast.hash} (isUserCast: ${!!isUserCast})`
      );
    }

    return NextResponse.json(
      { message: `Cast published successfully`, cast: response.cast },
      { status: 200 }
    );
  } catch (err) {
    console.error('Cast publishing error:', err);
    if (isApiErrorResponse(err)) {
      return NextResponse.json(
        { message: err.response.data.message || 'Failed to publish cast' },
        { status: err.response.status }
      );
    } else {
      return NextResponse.json({ message: 'Something went wrong' }, { status: 500 });
    }
  }
}
