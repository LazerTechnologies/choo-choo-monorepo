import { NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { composeImage, uploadImageToPinata, uploadMetadataToPinata } from 'generator';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const APP_URL = process.env.APP_URL;
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

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
  // 1. Fetch all replies to the cast with pagination
  let allReplies: Array<{
    author?: { fid?: number };
    reactions?: { likes?: unknown[]; recasts?: unknown[] };
  }> = [];
  let cursor: string | undefined = undefined;
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
    const replies = repliesData?.result?.casts ?? [];
    allReplies = allReplies.concat(replies);
    cursor = repliesData?.result?.next?.cursor;
  } while (cursor);

  // 2. Collect all unique fids
  const fidSet = new Set<number>();
  for (const reply of allReplies) {
    if (reply.author?.fid) fidSet.add(reply.author.fid);
  }
  const allFids = Array.from(fidSet);

  // 3. Bulk fetch user data in chunks of 100
  const fidToUser: Record<number, { verifications?: string[]; custody_address?: string }> = {};
  for (let i = 0; i < allFids.length; i += 100) {
    const chunk = allFids.slice(i, i + 100);
    const userRes = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${chunk.join(',')}`,
      {
        headers: { accept: 'application/json', api_key: NEYNAR_API_KEY },
      }
    );
    if (!userRes.ok) continue;
    const userData = await userRes.json();
    for (const user of userData?.users ?? []) {
      if (user.fid) fidToUser[user.fid] = user;
    }
  }

  // 4. Assemble results using the user map
  const results: Array<{ primaryWallet: string; reactions: number; fid: number }> = [];
  for (const reply of allReplies) {
    const fid = reply.author?.fid;
    if (!fid) continue;
    const user = fidToUser[fid];
    if (!user) continue;
    const verifications = user?.verifications ?? [];
    const primaryWallet = verifications[0] || user?.custody_address;
    if (!primaryWallet || !isAddress(primaryWallet)) continue;
    // Sum reactions (likes + recasts)
    const reactions =
      (reply.reactions?.likes?.length ?? 0) + (reply.reactions?.recasts?.length ?? 0);
    results.push({ primaryWallet, reactions, fid });
  }
  return results;
}

/**
 * POST /api/send-train
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
 * - Generates a unique NFT image and metadata using the `generator` package.
 * - Uploads assets to Pinata and calls /api/internal/next-stop/execute with the winner's address and tokenURI.
 *
 * @param request - The HTTP request object (expects JSON body with castHash).
 * @returns 200 with { success: true, winner } on success, or 400/500 with error message.
 */
export async function POST(request: Request) {
  try {
    if (!APP_URL) {
      throw new Error('APP_URL environment variable is not set');
    }
    if (!INTERNAL_SECRET) {
      throw new Error('INTERNAL_SECRET is not set in the environment');
    }

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

    // 3. Get the next token ID from our contract
    // @todo: Add KV store-based fetching to prevent unlikely race conditions and avoid RPC misuse
    const totalSupplyRes = await fetch(`${APP_URL}/api/internal/next-stop/read`, {
      headers: {
        'x-internal-secret': INTERNAL_SECRET,
      },
    });
    if (!totalSupplyRes.ok) {
      throw new Error('Failed to fetch total supply from internal API');
    }
    const { totalSupply } = await totalSupplyRes.json();
    const tokenId = totalSupply + 1;

    // 4. Generate the unique NFT image and attributes
    const { imageBuffer, attributes } = await composeImage();

    // 5. Upload the image to Pinata
    const imageCid = await uploadImageToPinata(imageBuffer, `ChooChooTrain #${tokenId}.png`);

    // 6. Upload the final metadata to Pinata
    const metadataCid = await uploadMetadataToPinata(tokenId, imageCid, attributes);
    const tokenURI = `ipfs://${metadataCid}`;

    // 7. Call the internal endpoint to execute the on-chain transaction
    const nextStopRes = await fetch(`${APP_URL}/api/internal/next-stop/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET,
      },
      body: JSON.stringify({ recipient: winnerAddress, tokenURI }),
    });

    if (!nextStopRes.ok) {
      const data = await nextStopRes.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to call internal/next-stop/execute');
    }

    return NextResponse.json({ success: true, winner: winnerAddress, tokenURI });
  } catch (error) {
    console.error('Failed to trigger next stop:', error);
    return NextResponse.json({ error: 'Failed to trigger next stop.' }, { status: 500 });
  }
}
