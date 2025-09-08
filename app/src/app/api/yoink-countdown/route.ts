import { NextResponse } from 'next/server';
import { getLastMovedTimestamp } from '@/lib/redis-token-utils';
import { getContractService } from '@/lib/services/contract';

export async function GET() {
  try {
    const [lastMoved, contractService] = await Promise.all([
      getLastMovedTimestamp(),
      Promise.resolve(getContractService()),
    ]);

    const yoinkTimerHours = await contractService.getYoinkTimerHours();

    return NextResponse.json({
      lastMovedTimestamp: lastMoved?.timestamp || null,
      transactionHash: lastMoved?.transactionHash || null,
      yoinkTimerHours,
    });
  } catch (error) {
    console.error('Error fetching yoink countdown data:', error);
    return NextResponse.json({ error: 'Failed to fetch yoink countdown data' }, { status: 500 });
  }
}
