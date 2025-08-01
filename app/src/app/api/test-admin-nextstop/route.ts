import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAddress, type Address } from 'viem';
import { getContractService } from '@/lib/services/contract';

// Validation schemas
const addressSchema = z.string().refine(isAddress, {
  message: 'Invalid Ethereum address',
});

const executeBodySchema = z.object({
  recipient: addressSchema,
  tokenURI: z.string().min(1, 'Token URI is required'),
});

/**
 * POST /api/test-admin-nextstop
 * Test endpoint for admin to manually execute nextStop function
 * WARNING: This is for testing purposes only - remove in production
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = executeBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { recipient, tokenURI } = parsed.data as { recipient: Address; tokenURI: string };

    // Add IPFS prefix if not present
    const fullTokenURI = tokenURI.startsWith('ipfs://') ? tokenURI : `ipfs://${tokenURI}`;

    const contractService = getContractService();

    // Get some contract info for context
    const contractInfo = await contractService.getContractInfo();

    // Execute the transaction
    const txHash = await contractService.executeNextStop(recipient, fullTokenURI);

    return NextResponse.json({
      success: true,
      txHash,
      recipient,
      tokenURI: fullTokenURI,
      contractInfo: {
        address: contractInfo.address,
        network: contractInfo.network,
        currentSupply: contractInfo.totalSupply,
        nextTokenId: contractInfo.nextTokenId,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Admin nextStop test error:', error);

    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
