import { NextResponse } from 'next/server';
import { updateSignerStatus } from '@/lib/kv';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fid } = body;

    if (!fid) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    // Update signer status to approved
    await updateSignerStatus(parseInt(fid), 'approved');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error approving signer:', error);
    return NextResponse.json({ error: 'Failed to approve signer' }, { status: 500 });
  }
}
