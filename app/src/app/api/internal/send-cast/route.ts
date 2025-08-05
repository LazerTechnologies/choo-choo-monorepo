import { NextResponse } from 'next/server';
import { z } from 'zod';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const CHOOCHOO_SIGNER_UUID = process.env.CHOOCHOO_SIGNER_UUID;

// Validation schemas
const embedSchema = z.object({
  cast_id: z
    .object({
      hash: z.string(),
      fid: z.number(),
    })
    .optional(),
  url: z.string().optional(),
});

const sendCastBodySchema = z.object({
  text: z.string().min(1, 'Cast text is required'),
  embeds: z.array(embedSchema).optional(),
  parent: z.string().optional(),
  channel_id: z.string().optional(),
  parent_author_fid: z.number().optional(),
  idem: z.string().optional(),
});

interface SendCastRequest {
  text: string;
  embeds?: Array<{
    cast_id?: {
      hash: string;
      fid: number;
    };
    url?: string;
  }>;
  parent?: string;
  channel_id?: string;
  parent_author_fid?: number;
  idem?: string;
}

interface SendCastResponse {
  success: boolean;
  cast?: {
    hash: string;
    text: string;
    author: {
      fid: number;
      username: string;
    };
  };
  error?: string;
}

/**
 * POST /api/internal/send-cast
 *
 * Internal endpoint for sending casts on behalf of the ChooChoo Farcaster account.
 * Uses the CHOOCHOO_SIGNER_UUID to authenticate with Neynar.
 *
 * @param request - The HTTP request object with body containing cast data
 * @returns 200 with cast data on success, or error response on failure
 */
export async function POST(request: Request) {
  try {
    // 1. Authentication check
    const authHeader = request.headers.get('x-internal-secret');
    if (!INTERNAL_SECRET || authHeader !== INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Environment variable checks
    if (!NEYNAR_API_KEY) {
      console.error('[internal/send-cast] Neynar API key not configured');
      return NextResponse.json(
        { success: false, error: 'Neynar API key not configured' },
        { status: 500 }
      );
    }

    if (!CHOOCHOO_SIGNER_UUID) {
      console.error('[internal/send-cast] ChooChoo signer UUID not configured');
      return NextResponse.json(
        { success: false, error: 'ChooChoo signer UUID not configured' },
        { status: 500 }
      );
    }

    // 3. Parse and validate request body
    let body: SendCastRequest;
    try {
      const rawBody = await request.json();
      const parsed = sendCastBodySchema.safeParse(rawBody);

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

      body = parsed.data;
    } catch (err) {
      console.error('[internal/send-cast] Error parsing request body:', err);
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    console.log(`[internal/send-cast] Sending cast: "${body.text.substring(0, 50)}..."`);

    // 4. Send cast via Neynar API
    try {
      const neynarPayload = {
        signer_uuid: CHOOCHOO_SIGNER_UUID,
        text: body.text,
        ...(body.embeds && { embeds: body.embeds }),
        ...(body.parent && { parent: body.parent }),
        ...(body.channel_id && { channel_id: body.channel_id }),
        ...(body.parent_author_fid && { parent_author_fid: body.parent_author_fid }),
        ...(body.idem && { idem: body.idem }),
      };

      const response = await fetch('https://api.neynar.com/v2/farcaster/cast/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': NEYNAR_API_KEY,
        },
        body: JSON.stringify(neynarPayload),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('[internal/send-cast] Neynar API error:', response.status, errorData);

        let errorMessage = 'Failed to send cast';
        try {
          const parsedError = JSON.parse(errorData);
          errorMessage = parsedError.message || errorMessage;
        } catch {
          // Keep default error message if JSON parsing fails
        }

        return NextResponse.json(
          { success: false, error: `Neynar API error: ${errorMessage}` },
          { status: response.status }
        );
      }

      const castData = await response.json();
      console.log(`[internal/send-cast] Successfully sent cast: ${castData.cast?.hash}`);

      const result: SendCastResponse = {
        success: true,
        cast: {
          hash: castData.cast?.hash || '',
          text: castData.cast?.text || body.text,
          author: {
            fid: castData.cast?.author?.fid || 0,
            username: castData.cast?.author?.username || 'choochoo',
          },
        },
      };

      return NextResponse.json(result);
    } catch (err) {
      console.error('[internal/send-cast] Failed to send cast:', err);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to send cast: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[internal/send-cast] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
