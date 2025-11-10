import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiLog } from '@/lib/event-log';
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
      apiLog.warn('set-ticket-data.unauthorized', {
        msg: 'Unauthorized: Invalid or missing internal secret',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (err) {
      apiLog.error('set-ticket-data.parse_failed', {
        error: err instanceof Error ? err.message : 'Unknown error',
        msg: 'Invalid JSON in request body',
      });
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const validation = setTicketDataSchema.safeParse(body);
    if (!validation.success) {
      apiLog.warn('set-ticket-data.validation_failed', {
        errors: validation.error.format(),
        msg: 'Validation failed',
      });
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 },
      );
    }

    const { tokenId, tokenURI, image } = validation.data;

    apiLog.info('set-ticket-data.request', {
      tokenId,
      msg: `Setting ticket data for token ${tokenId}`,
    });

    try {
      const contractService = getContractService();
      const hash = await contractService.setTicketData(tokenId, tokenURI, image);

      apiLog.info('set-ticket-data.success', {
        tokenId,
        txHash: hash,
        msg: `Successfully set ticket data for token ${tokenId}, tx: ${hash}`,
      });

      const response: SetTicketDataResponse = {
        success: true,
        tokenId,
      };

      return NextResponse.json(response);
    } catch (contractError) {
      apiLog.error('set-ticket-data.failed', {
        tokenId,
        error: contractError instanceof Error ? contractError.message : 'Unknown error',
        msg: 'Contract interaction failed',
      });

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
    apiLog.error('set-ticket-data.failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      msg: 'Unexpected error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
