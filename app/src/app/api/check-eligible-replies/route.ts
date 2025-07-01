import { NextResponse } from 'next/server';
import { isAddress } from 'viem';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

type Reply = { author?: { fid?: number } };

/**
 * Checks if a given cast has any eligible replies (replies with a valid primary wallet address).
 * Uses the first address in the verifications array as the primary wallet, falling back to custody_address if needed.
 *
 * @param castHash - The hash of the cast to check.
 * @returns True if there is at least one eligible reply, false otherwise.
 */
async function hasEligibleReplies(castHash: string): Promise<boolean> {
  if (!NEYNAR_API_KEY) throw new Error('Missing NEYNAR_API_KEY');
  let allReplies: Reply[] = [];
  let cursor: string | undefined = undefined;
  let foundEligible = false;

  do {
    const url = new URL(`https://api.neynar.com/v2/farcaster/cast/replies`);
    url.searchParams.set('cast_hash', castHash);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);

    const repliesRes = await fetch(url.toString(), {
      headers: { accept: 'application/json', api_key: NEYNAR_API_KEY },
    });
    if (!repliesRes.ok) throw new Error('Failed to fetch replies from Neynar');
    const repliesData = await repliesRes.json();
    const replies: Reply[] = repliesData?.result?.casts ?? [];
    allReplies = allReplies.concat(replies);
    cursor = repliesData?.result?.next?.cursor;

    // Collect all unique FIDs from reply authors so far
    const fids = [...new Set(allReplies.map((reply) => reply.author?.fid).filter(Boolean))];
    if (fids.length === 0) continue;

    // Batch fetch all users at once
    const userRes = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fids.join(',')}`,
      {
        headers: { accept: 'application/json', api_key: NEYNAR_API_KEY },
      }
    );
    if (!userRes.ok) throw new Error('Failed to fetch users from Neynar');
    const userData = await userRes.json();
    const users = userData?.users ?? [];

    // Check if any user has a valid primary wallet (verifications[0] or custody_address)
    for (const user of users) {
      const verifications = user?.verifications ?? [];
      const primaryWallet = verifications[0] || user?.custody_address;
      if (primaryWallet && isAddress(primaryWallet)) {
        foundEligible = true;
        break;
      }
    }
    if (foundEligible) break;
  } while (cursor);

  return foundEligible;
}

/**
 * GET /api/check-eligible-replies?castHash=...
 *
 * Checks if a cast has any eligible replies (with a valid primary wallet address).
 *
 * @param request - The HTTP request object (expects castHash as a query parameter).
 * @returns 200 with { hasReplies: boolean } or 400/500 with error message.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const castHash = searchParams.get('castHash');
    if (!castHash || typeof castHash !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid castHash' }, { status: 400 });
    }
    const hasReplies = await hasEligibleReplies(castHash);
    return NextResponse.json({ hasReplies });
  } catch (error) {
    console.error('Failed to check eligible replies:', error);
    return NextResponse.json({ error: 'Failed to check eligible replies.' }, { status: 500 });
  }
}
