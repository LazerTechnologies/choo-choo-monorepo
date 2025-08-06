import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/auth';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

// Validation schema
const adminSetTicketDataSchema = z.object({
  tokenId: z.number().positive('Token ID must be positive'),
  tokenURI: z.string().min(1, 'Token URI is required'),
  image: z.string().optional().default(''),
  traits: z.string().optional().default(''),
  adminFid: z.number().positive('Admin FID is required'),
});

interface AdminSetTicketDataResponse {
  success: boolean;
  tokenId: number;
  error?: string;
}

/**
 * POST /api/admin-set-ticket-data
 *
 * Admin endpoint for setting ticket metadata on the contract.
 * Requires admin authentication and uses internal endpoint to execute.
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user?.fid) {
      console.error('[admin-set-ticket-data] Unauthorized: No valid session');
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (err) {
      console.error('[admin-set-ticket-data] Invalid JSON in request body:', err);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const validation = adminSetTicketDataSchema.safeParse(body);
    if (!validation.success) {
      console.error('[admin-set-ticket-data] Validation failed:', validation.error.format());
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { tokenId, tokenURI, image, traits, adminFid } = validation.data;

    // Verify that the authenticated user matches the admin FID
    if (session.user.fid !== adminFid) {
      console.error('[admin-set-ticket-data] FID mismatch: session FID does not match admin FID');
      return NextResponse.json(
        { error: 'Unauthorized - Invalid admin credentials' },
        { status: 403 }
      );
    }

    console.log(
      `[admin-set-ticket-data] Admin FID ${adminFid} setting ticket data for token ${tokenId}`
    );

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
            traits,
          }),
        }
      );

      if (!internalResponse.ok) {
        const errorData = await internalResponse.json();
        throw new Error(errorData.error || 'Internal endpoint failed');
      }

      const internalData = await internalResponse.json();

      if (!internalData.success) {
        throw new Error(internalData.error || 'Internal endpoint returned failure');
      }

      console.log(`[admin-set-ticket-data] Successfully set ticket data for token ${tokenId}`);

      const response: AdminSetTicketDataResponse = {
        success: true,
        tokenId,
      };

      return NextResponse.json(response);
    } catch (internalError) {
      console.error('[admin-set-ticket-data] Internal endpoint failed:', internalError);

      let errorMessage = 'Failed to set ticket data';
      if (internalError instanceof Error) {
        errorMessage = internalError.message;
      }

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    console.error('[admin-set-ticket-data] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
