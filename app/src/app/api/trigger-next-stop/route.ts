import { NextResponse } from 'next/server';
import { isAddress } from 'viem';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

/**
 * Fetches replies to a given cast from Neynar, along with each reply author's primary wallet address and total reactions.
 * Uses the first address in verifications as the primary wallet, falling back to custody_address if needed.
 *
 * @param castHash - The hash of the cast to fetch replies for.
 * @returns An array of objects with primaryWallet, reactions, and fid for each eligible reply.
 * @throws If the Neynar API key is missing or the API call fails.
 */
async function fetchRepliesAndReactions(
  castHash: string
): Promise<Array<{ primaryWallet: string; reactions: number; fid: number }>> {
  if (!NEYNAR_API_KEY) throw new Error('Missing NEYNAR_API_KEY');
  // 1. Fetch replies to the cast
  const repliesRes = await fetch(
    `https://api.neynar.com/v2/farcaster/cast/replies?cast_hash=${castHash}&limit=100`,
    {
      headers: { accept: 'application/json', api_key: NEYNAR_API_KEY },
    }
  );
  if (!repliesRes.ok) throw new Error('Failed to fetch replies from Neynar');
  const repliesData = await repliesRes.json();
  const replies = repliesData?.result?.casts ?? [];

  // 2. For each reply, fetch reactions and primary wallet address
  const results: Array<{ primaryWallet: string; reactions: number; fid: number }> = [];
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
    if (!primaryWallet || !isAddress(primaryWallet)) continue;
    // Sum reactions (likes + recasts)
    const reactions =
      (reply.reactions?.likes?.length ?? 0) + (reply.reactions?.recasts?.length ?? 0);
    results.push({ primaryWallet, reactions, fid });
  }
  return results;
}

/**
 * POST /api/trigger-next-stop
 *
 * Orchestrates the next stop for the ChooChoo train journey. Anyone can call this endpoint.
 *
 * Expects a JSON body:
 *   { castHash: string }
 *
 * - Fetches replies to the given cast from Neynar.
 * - For each reply, fetches the author's primary wallet address and sums reactions (likes + recasts).
 * - Filters for replies with a valid primary wallet address.
 * - Selects the reply with the most reactions as the winner.
 * - Generates placeholder NFT metadata.
 * - Uploads metadata to Pinata and calls /api/next-stop with the winner's address and tokenURI.
 *
 * @param request - The HTTP request object (expects JSON body with castHash).
 * @returns 200 with { success: true, winner } on success, or 400/500 with error message.
 */
export async function POST(request: Request) {
  try {
    // 0. Parse body for castHash
    const body = await request.json();
    const castHash = body.castHash;
    if (!castHash || typeof castHash !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid castHash' }, { status: 400 });
    }

    // 1. Fetch cast replies and reactions from Neynar
    const replies = await fetchRepliesAndReactions(castHash);
    if (!replies.length) {
      return NextResponse.json({ error: 'No eligible replies found' }, { status: 400 });
    }

    // 2. Select the winner (most reactions)
    const winner = replies.reduce(
      (max, curr) => (curr.reactions > max.reactions ? curr : max),
      replies[0]
    );
    const winnerAddress = winner.primaryWallet;
    if (!isAddress(winnerAddress)) {
      return NextResponse.json({ error: 'Winner address is invalid' }, { status: 400 });
    }

    // 3. Generate NFT metadata and image (placeholder)
    const metadata = {
      name: 'ChooChoo Ticket',
      description: 'Thank you for riding ChooChoo!',
      attributes: [{ trait_type: 'Reactions', value: winner.reactions.toString() }],
    };

    // 4. Upload to Pinata
    const pinataRes = await fetch(`${process.env.NEXTAUTH_URL}/api/pinata/mint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });
    if (!pinataRes.ok) {
      const data = await pinataRes.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to upload to Pinata');
    }
    const { tokenURI } = await pinataRes.json();

    // 5. Call /api/next-stop
    const nextStopRes = await fetch(`${process.env.NEXTAUTH_URL}/api/next-stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_SECRET || '',
      },
      body: JSON.stringify({ recipient: winnerAddress, tokenURI }),
    });
    if (!nextStopRes.ok) {
      const data = await nextStopRes.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to call next-stop');
    }

    return NextResponse.json({ success: true, winner: winnerAddress });
  } catch (error) {
    console.error('Failed to trigger next stop:', error);
    return NextResponse.json({ error: 'Failed to trigger next stop.' }, { status: 500 });
  }
}
