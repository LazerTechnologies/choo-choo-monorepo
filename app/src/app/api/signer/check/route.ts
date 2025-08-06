import { NextResponse } from 'next/server';
import { getSignerInfo } from '@/lib/kv';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fidParam = searchParams.get('fid');

  if (!fidParam) {
    return NextResponse.json({ error: 'FID parameter is required' }, { status: 400 });
  }

  const fid = parseInt(fidParam.trim());
  if (isNaN(fid) || fid <= 0) {
    return NextResponse.json({ error: 'Invalid FID parameter' }, { status: 400 });
  }

  try {
    // Check Redis for approved signers
    const signerInfo = await getSignerInfo(fid);

    if (signerInfo && signerInfo.status === 'approved') {
      return NextResponse.json({
        hasApprovedSigner: true,
        signers: [{ signer_uuid: signerInfo.signerUuid }],
      });
    }

    // If not found or not approved, return false
    return NextResponse.json({
      hasApprovedSigner: false,
      signers: [],
    });
  } catch (error) {
    console.error('Error checking signers:', error);
    return NextResponse.json({ error: 'Failed to check signers' }, { status: 500 });
  }
}
