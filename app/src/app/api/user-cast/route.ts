import neynarClient from '@/lib/neynarClient';
import { NextResponse } from 'next/server';
import { getSignerInfo } from '@/lib/kv';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.signer_uuid) {
      console.error('Missing signer_uuid in request body');
      return NextResponse.json({ error: 'Signer UUID is required' }, { status: 400 });
    }

    if (!body.text) {
      console.error('Missing text in request body');
      return NextResponse.json({ error: 'Cast text is required' }, { status: 400 });
    }

    // Validate that we have this signer and it's approved
    // We need the FID to check our Redis store
    if (body.fid) {
      const signerInfo = await getSignerInfo(parseInt(body.fid));
      if (!signerInfo) {
        console.error('No signer found for FID:', body.fid);
        return NextResponse.json({ error: 'No signer found for this user' }, { status: 400 });
      }

      if (signerInfo.status !== 'approved') {
        console.error('Signer not approved for FID:', body.fid, 'Status:', signerInfo.status);
        return NextResponse.json({ error: 'Signer not approved' }, { status: 400 });
      }

      if (signerInfo.signerUuid !== body.signer_uuid) {
        console.error('Signer UUID mismatch for FID:', body.fid);
        return NextResponse.json({ error: 'Invalid signer UUID' }, { status: 400 });
      }

      console.log('Signer validated for FID:', body.fid);
    }

    console.log('Publishing cast with signer:', body.signer_uuid);

    const cast = await neynarClient.publishCast({
      signerUuid: body.signer_uuid,
      text: body.text,
    });

    console.log('Cast published successfully:', cast);
    return NextResponse.json(cast, { status: 200 });
  } catch (error) {
    console.error('Error publishing cast:', error);

    // More detailed error logging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    // Check if it's a Neynar API error
    if (error && typeof error === 'object' && 'response' in error) {
      const neynarError = error as { response?: { data?: unknown }; message?: string };
      console.error('Neynar API error:', neynarError.response?.data || neynarError.message);

      return NextResponse.json(
        {
          error: 'Failed to publish cast',
          details: neynarError.response?.data || neynarError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'An error occurred while publishing cast',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
