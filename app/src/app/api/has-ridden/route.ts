import { NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { getContractService } from '@/lib/services/contract';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 });
  }

  if (!isAddress(address)) {
    return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 });
  }

  try {
    const contractService = getContractService();
    const hasRidden = await contractService.hasBeenPassenger(address);

    return NextResponse.json({ hasRidden });
  } catch (error) {
    console.error('[has-ridden] Error checking ride history:', error);
    return NextResponse.json({ error: 'Failed to check ride history' }, { status: 500 });
  }
}
