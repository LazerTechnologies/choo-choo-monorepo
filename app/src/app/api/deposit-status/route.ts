import { NextRequest, NextResponse } from 'next/server';
import { getContractService } from '@/lib/services/contract';

/**
 * GET /api/deposit-status?fid=123
 *
 * Returns deposit status for a specific FID.
 * Used by the frontend to check if a user has deposited enough USDC.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');

    if (!fidParam) {
      return NextResponse.json({ error: 'FID parameter is required' }, { status: 400 });
    }

    const fid = parseInt(fidParam, 10);
    if (isNaN(fid) || fid <= 0) {
      return NextResponse.json({ error: 'Invalid FID parameter' }, { status: 400 });
    }

    const contractService = getContractService();

    const [deposited, required] = await Promise.all([
      contractService.getFidDeposited(fid),
      contractService.getDepositCost(),
    ]);

    const satisfied = deposited >= required;

    return NextResponse.json({
      success: true,
      fid,
      depositStatus: {
        required: required.toString(),
        deposited: deposited.toString(),
        satisfied,
        requiredFormatted: `${Number(required) / 10 ** 6} USDC`,
        depositedFormatted: `${Number(deposited) / 10 ** 6} USDC`,
      },
    });
  } catch (error) {
    console.error('[deposit-status] Failed to get deposit status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get deposit status',
      },
      { status: 500 }
    );
  }
}
