import { NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { composeImage, uploadImageToPinata, uploadMetadataToPinata } from 'generator';
import { getContractService } from '@/lib/services/contract';
import { redis } from '@/lib/kv';
import type { NeynarBulkUsersResponse } from '@/types/neynar';

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
  const fidToUser: Record<number, NeynarBulkUsersResponse['users'][0]> = {};
  for (let i = 0; i < allFids.length; i += 100) {
    const chunk = allFids.slice(i, i + 100);
    const userRes = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${chunk.join(',')}`,
      {
        headers: { accept: 'application/json', 'x-api-key': NEYNAR_API_KEY },
      }
    );
    if (!userRes.ok) continue;
    const userData: NeynarBulkUsersResponse = await userRes.json();
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

    // Get first verified Ethereum address (primary if available, otherwise first in array)
    const verifiedAddresses = user.verified_addresses;
    const primaryWallet =
      verifiedAddresses?.primary?.eth_address || verifiedAddresses?.eth_addresses?.[0];

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
    // 0. Parse body for castHash
    let body;
    try {
      body = await request.json();
    } catch (err) {
      console.error('[send-train] Failed to parse request body:', err);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const castHash = body.castHash;
    if (!castHash || typeof castHash !== 'string') {
      console.error('[send-train] Missing or invalid castHash:', castHash);
      return NextResponse.json({ error: 'Missing or invalid castHash' }, { status: 400 });
    }

    // 1. Fetch cast replies and reactions from Neynar
    let replies;
    try {
      replies = await fetchRepliesAndReactions(castHash);
    } catch (err) {
      console.error('[send-train] Failed to fetch replies and reactions:', err);
      return NextResponse.json({ error: 'Failed to fetch replies from Neynar' }, { status: 500 });
    }
    if (!replies.length) {
      console.error('[send-train] No eligible replies found for castHash:', castHash);
      return NextResponse.json({ error: 'No eligible replies found' }, { status: 400 });
    }

    // 2. Select the winner (most reactions)
    let winner;
    try {
      winner = replies.reduce(
        (max, curr) => (curr.reactions > max.reactions ? curr : max),
        replies[0]
      );
    } catch (err) {
      console.error('[send-train] Failed to select winner:', err);
      return NextResponse.json({ error: 'Failed to select winner' }, { status: 500 });
    }
    const winnerAddress = winner.primaryWallet;
    if (!isAddress(winnerAddress)) {
      console.error('[send-train] Winner address is invalid:', winnerAddress);
      return NextResponse.json({ error: 'Winner address is invalid' }, { status: 400 });
    }

    // 3. Get the next token ID from our contract
    let contractService, totalSupply, tokenId;
    try {
      contractService = getContractService();
      totalSupply = await contractService.getTotalSupply();
      tokenId = totalSupply + 1;
    } catch (err) {
      console.error('[send-train] Failed to get contract service or total supply:', err);
      return NextResponse.json({ error: 'Failed to get contract state' }, { status: 500 });
    }

    // 4. Generate the unique NFT image and attributes
    let imageBuffer, attributes;
    try {
      const result = await composeImage();
      imageBuffer = result.imageBuffer;
      attributes = result.attributes;
    } catch (err) {
      console.error('[send-train] Failed to compose NFT image:', err);
      return NextResponse.json({ error: 'Failed to compose NFT image' }, { status: 500 });
    }

    // 5. Upload the image to Pinata
    let imageCid;
    try {
      imageCid = await uploadImageToPinata(imageBuffer, `ChooChooTrain #${tokenId}.png`);
    } catch (err) {
      console.error('[send-train] Failed to upload image to Pinata:', err);
      return NextResponse.json({ error: 'Failed to upload image to Pinata' }, { status: 500 });
    }

    // 6. Upload the final metadata to Pinata
    let metadataCid, tokenURI;
    try {
      metadataCid = await uploadMetadataToPinata(tokenId, imageCid, attributes);
      tokenURI = `ipfs://${metadataCid}`;
    } catch (err) {
      console.error('[send-train] Failed to upload metadata to Pinata:', err);
      return NextResponse.json({ error: 'Failed to upload metadata to Pinata' }, { status: 500 });
    }

    // 7. Store the IPFS hashes in Redis for the generated NFT
    try {
      await redis.set(`choochoo:nft:${tokenId}:image_hash`, imageCid);
      await redis.set(`choochoo:nft:${tokenId}:metadata_hash`, metadataCid);
      console.log(`[send-train] Stored IPFS hashes in Redis for token ${tokenId}`);
    } catch (err) {
      console.error('[send-train] Failed to store IPFS hashes in Redis:', err);
      // Don't fail the request for Redis storage issues, just log the error
    }

    // 8. Execute the on-chain transaction
    let txHash;
    try {
      txHash = await contractService.executeNextStop(winnerAddress, tokenURI);
    } catch (err) {
      console.error('[send-train] Failed to execute on-chain transaction:', err);
      return NextResponse.json(
        { error: 'Failed to execute on-chain transaction' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      winner: winnerAddress,
      tokenURI,
      txHash,
      tokenId,
    });
  } catch (error) {
    console.error(
      '[send-train] Uncaught error:',
      error instanceof Error ? error.stack || error.message : error
    );
    return NextResponse.json({ error: 'Failed to trigger next stop.' }, { status: 500 });
  }
}
