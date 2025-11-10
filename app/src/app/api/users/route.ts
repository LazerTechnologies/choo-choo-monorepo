import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { NextResponse } from 'next/server';

/**
 * API Route: /api/users
 *
 * This endpoint is a proxy to the Neynar API to fetch user data for specific FIDs.
 *
 * Usage:
 *   - Send a GET request to /api/users?fids=123,456,789
 *   - The endpoint will return user data for the provided FIDs as returned by Neynar.
 *
 * Query Parameters:
 *   - fids (string, required): Comma-separated list of Farcaster IDs (FIDs) to fetch user data for.
 *     Example: fids=123,456,789
 *
 * Responses:
 *   - 200: { users: User[] } - Array of user objects as returned by Neynar for the provided FIDs.
 *   - 400: { error: string } - Returned if the 'fids' parameter is missing.
 *   - 500: { error: string } - Returned if the Neynar API key is missing or if there is an error fetching users from Neynar.
 */

/**
 * Handles GET requests to fetch user data for a list of FIDs via Neynar.
 *
 * @param {Request} request - The incoming HTTP request object.
 * @returns {Promise<Response>} JSON response containing user data or an error message.
 */
export async function GET(request: Request) {
  const apiKey = process.env.NEYNAR_API_KEY;
  const { searchParams } = new URL(request.url);
  const fids = searchParams.get('fids');

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'Neynar API key is not configured. Please add NEYNAR_API_KEY to your environment variables.',
      },
      { status: 500 },
    );
  }

  if (!fids) {
    return NextResponse.json({ error: 'FIDs parameter is required' }, { status: 400 });
  }

  try {
    const neynar = new NeynarAPIClient({ apiKey });
    const fidsArray = fids.split(',').map((fid) => Number.parseInt(fid.trim()));

    const { users } = await neynar.fetchBulkUsers({
      fids: fidsArray,
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users. Please check your Neynar API key and try again.' },
      { status: 500 },
    );
  }
}
