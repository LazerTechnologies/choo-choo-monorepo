import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getContractService } from '@/lib/services/contract';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

// Validation schema
const setTicketDataSchema = z.object({
  tokenId: z.number().min(0, 'Token ID must be non-negative'),
  tokenURI: z.string().min(1, 'Token URI is required'),
  image: z.string().optional().default(''),
});

interface SetTicketDataResponse {
  success: boolean;
  tokenId: number;
  error?: string;
}

/**
 * POST /api/internal/set-ticket-data
 *
 * Internal endpoint for setting ticket metadata on the contract.
 * Uses the admin private key to call setTicketData on the contract.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify internal secret
    const authHeader = request.headers.get('x-internal-secret');
    if (!authHeader || authHeader !== INTERNAL_SECRET) {
      console.error('[internal/set-ticket-data] Unauthorized: Invalid or missing internal secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (err) {
      console.error('[internal/set-ticket-data] Invalid JSON in request body:', err);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const validation = setTicketDataSchema.safeParse(body);
    if (!validation.success) {
      console.error('[internal/set-ticket-data] Validation failed:', validation.error.format());
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { tokenId, tokenURI, image } = validation.data;

    console.log(`[internal/set-ticket-data] Setting ticket data for token ${tokenId}`);

    try {
      const contractService = getContractService();
      const hash = await contractService.setTicketData(tokenId, tokenURI, image);

      console.log(
        `[internal/set-ticket-data] Successfully set ticket data for token ${tokenId}, tx: ${hash}`
      );

      const response: SetTicketDataResponse = {
        success: true,
        tokenId,
      };

      return NextResponse.json(response);
    } catch (contractError) {
      console.error('[internal/set-ticket-data] Contract interaction failed:', contractError);

      let errorMessage = 'Failed to set ticket data on contract';
      if (contractError instanceof Error) {
        if (contractError.message.includes('Token does not exist')) {
          errorMessage = `Token ${tokenId} does not exist`;
        } else if (contractError.message.includes('Cannot update train NFT')) {
          errorMessage = 'Cannot update metadata for train NFT (token ID 0)';
        } else if (contractError.message.includes('Not an admin')) {
          errorMessage = 'Admin role required to set ticket data';
        } else {
          errorMessage = contractError.message;
        }
      }

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    console.error('[internal/set-ticket-data] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
