import { NextResponse } from 'next/server';
import { isAddress } from 'viem';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

/**
 * Checks if a given cast has any eligible replies (replies with a valid primary wallet address).
 * Uses the first address in the verifications array as the primary wallet, falling back to custody_address if needed.
 *
 * @param castHash - The hash of the cast to check.
 * @returns True if there is at least one eligible reply, false otherwise.
 */
async function hasEligibleReplies(castHash: string): Promise<boolean> {
  if (!NEYNAR_API_KEY) throw new Error('Missing NEYNAR_API_KEY');
  const repliesRes = await fetch(
    `https://api.neynar.com/v2/farcaster/cast/replies?cast_hash=${castHash}&limit=100`,
    {
      headers: { accept: 'application/json', api_key: NEYNAR_API_KEY },
    }
  );
  if (!repliesRes.ok) throw new Error('Failed to fetch replies from Neynar');
  const repliesData = await repliesRes.json();
  const replies = repliesData?.result?.casts ?? [];
  for (const reply of replies) {
    const fid = reply.author?.fid;
    if (!fid) continue;
    const userRes = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
      headers: { accept: 'application/json', api_key: NEYNAR_API_KEY },
    });
    if (!userRes.ok) continue;
    const userData = await userRes.json();
    // Use the first address in verifications as the primary wallet, fallback to custody_address
    const verifications = userData?.users?.[0]?.verifications ?? [];
    const primaryWallet = verifications[0] || userData?.users?.[0]?.custody_address;
    if (primaryWallet && isAddress(primaryWallet)) return true;
  }
  return false;
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
