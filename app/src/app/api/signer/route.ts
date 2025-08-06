import { getSignedKey } from '@/utils/getSignedKey';
import { NextResponse } from 'next/server';
import { setSignerInfo } from '@/lib/kv';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fid } = body;

    if (!fid) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    const signedKey = await getSignedKey();

    // Store signer info in Redis with pending status
    await setSignerInfo({
      fid: parseInt(fid),
      signerUuid: signedKey.signer_uuid,
      status: 'pending',
      createdAt: Date.now(),
    });

    return NextResponse.json(signedKey, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}
