import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { apiLog } from '@/lib/event-log';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

// Validation schema
const adminSetTicketDataSchema = z.object({
  tokenId: z.number().min(0, 'Token ID must be non-negative'),
  tokenURI: z.string().min(1, 'Token URI is required'),
  image: z.string().optional().default(''),
});

interface AdminSetTicketDataResponse {
  success: boolean;
  tokenId: number;
  error?: string;
}

/**
 * POST /api/admin/set-ticket-data
 *
 * Admin endpoint for setting ticket metadata on the contract.
 * Requires admin authentication and uses internal endpoint to execute.
 */
export async function POST(request: NextRequest) {
  try {
    // Admin auth
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (err) {
      apiLog.error('admin-set-ticket-data.parse_failed', {
        error: err instanceof Error ? err.message : 'Unknown error',
        msg: 'Invalid JSON in request body',
      });
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const validation = adminSetTicketDataSchema.safeParse(body);
    if (!validation.success) {
      apiLog.warn('admin-set-ticket-data.validation_failed', {
        errors: validation.error.format(),
        msg: 'Validation failed',
      });
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 },
      );
    }

    const { tokenId, tokenURI, image } = validation.data;

    apiLog.info('admin-set-ticket-data.request', {
      adminFid: auth.adminFid,
      tokenId,
      msg: `Admin FID ${auth.adminFid} setting ticket data for token ${tokenId}`,
    });

    // Call internal endpoint to execute the transaction
    try {
      const internalResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/internal/set-ticket-data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET || '',
          },
          body: JSON.stringify({
            tokenId,
            tokenURI,
            image,
          }),
        },
      );

      if (!internalResponse.ok) {
        const errorData = await internalResponse.json();
        throw new Error(errorData.error || 'Internal endpoint failed');
      }

      const internalData = await internalResponse.json();

      if (!internalData.success) {
        throw new Error(internalData.error || 'Internal endpoint returned failure');
      }

      apiLog.info('admin-set-ticket-data.success', {
        tokenId,
        msg: `Successfully set ticket data for token ${tokenId}`,
      });

      const response: AdminSetTicketDataResponse = {
        success: true,
        tokenId,
      };

      return NextResponse.json(response);
    } catch (internalError) {
      apiLog.error('admin-set-ticket-data.failed', {
        tokenId,
        error: internalError instanceof Error ? internalError.message : 'Unknown error',
        msg: 'Internal endpoint failed',
      });

      let errorMessage = 'Failed to set ticket data';
      if (internalError instanceof Error) {
        errorMessage = internalError.message;
      }

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    apiLog.error('admin-set-ticket-data.failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      msg: 'Unexpected error',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
