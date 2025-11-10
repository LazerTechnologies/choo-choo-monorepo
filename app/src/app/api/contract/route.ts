import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAddress, type Address } from 'viem';
import { getContractService } from '@/lib/services/contract';
import { withInternalAuth, withLogging, withMiddleware } from '@/lib/middleware/internal-auth';

// Validation schemas
const addressSchema = z.string().refine(isAddress, {
  message: 'Invalid Ethereum address',
});

const executeBodySchema = z.object({
  recipient: addressSchema,
  tokenURI: z.string().refine((val) => val.startsWith('ipfs://'), {
    message: 'tokenURI must be an IPFS URI',
  }),
});

/**
 * GET /api/contract
 * Get contract information (total supply, status, etc.)
 */
async function handleGet() {
  const contractService = getContractService();
  const info = await contractService.getContractInfo();

  return NextResponse.json(info);
}

/**
 * POST /api/contract
 * Execute nextStop function on the contract
 */
async function handlePost(request: Request) {
  const body = await request.json();
  const parsed = executeBodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid request body',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { recipient, tokenURI } = parsed.data as { recipient: Address; tokenURI: string };

  const contractService = getContractService();
  const txHash = await contractService.executeNextStop(recipient, tokenURI);

  return NextResponse.json({
    success: true,
    txHash,
    recipient,
    tokenURI,
  });
}

// Apply middleware and export handlers
export const GET = withLogging(handleGet, 'CONTRACT-READ');

export const POST = withMiddleware(withInternalAuth, (handler) =>
  withLogging(handler, 'CONTRACT-EXECUTE'),
)(handlePost);
