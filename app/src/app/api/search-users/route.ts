import { NextRequest, NextResponse } from 'next/server';
import { getNeynarClient } from '@/lib/neynar';

/**
 * API Route: /api/search-users
 *
 * This endpoint searches for Farcaster users by username using Neynar API.
 *
 * Usage:
 *   - Send a GET request to /api/search-users?q=username&limit=10
 *   - The endpoint will return user search results as returned by Neynar.
 *
 * Query Parameters:
 *   - q (string, required): Search query (username to search for)
 *   - limit (number, optional): Maximum number of results to return (default: 10, max: 25)
 *
 * Responses:
 *   - 200: { result: { users: User[] } } - Array of user objects matching the search query
 *   - 400: { error: string } - Returned if the 'q' parameter is missing
 *   - 500: { error: string } - Returned if there is an error with the Neynar API
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const limitParam = searchParams.get('limit');

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: 'Search query (q) parameter is required' }, { status: 400 });
  }

  const limit = limitParam ? Math.min(parseInt(limitParam), 25) : 10;

  try {
    const client = getNeynarClient();

    const searchResult = await client.searchUser({
      q: query.trim(),
      limit,
    });

    return NextResponse.json({
      result: {
        users: searchResult.result.users,
      },
    });
  } catch (error) {
    console.error('Failed to search users:', error);
    return NextResponse.json(
      { error: 'Failed to search users. Please try again.' },
      { status: 500 }
    );
  }
}
