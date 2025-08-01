import { NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { composeImage, uploadImageToPinata, uploadMetadataToPinata } from 'generator';
import { getContractService } from '@/lib/services/contract';
import { redis } from '@/lib/kv';
import type { NeynarCastReactionsResponse } from '@/types/neynar';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

/**
 * Fetches reactions to a given cast from Neynar, along with each reactor's primary wallet address.
 * Uses the efficient reactions API which includes full user data in a single call.
 *
 * @param castHash - The hash of the cast to fetch reactions for.
 * @returns An array of objects with complete user data for each eligible reactor.
 * @throws If the Neynar API key is missing or the API call fails.
 */
async function fetchReactions(castHash: string): Promise<
  Array<{
    primaryWallet: string;
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
  }>
> {
  if (!NEYNAR_API_KEY) throw new Error('Missing NEYNAR_API_KEY');

  // Fetch all reactions to the cast with pagination
  let allReactions: Array<{
    reaction_type: 'like' | 'recast';
    user: {
      fid: number;
      username: string;
      display_name: string;
      pfp_url: string;
      verified_addresses: {
        eth_addresses: string[];
        primary: { eth_address: string | null };
      };
    };
  }> = [];
  let cursor: string | undefined = undefined;

  do {
    const url = new URL(`https://api.neynar.com/v2/farcaster/reactions/cast/`);
    url.searchParams.set('hash', castHash);
    url.searchParams.set('types', 'all');
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);

    const reactionsRes = await fetch(url.toString(), {
      headers: { accept: 'application/json', 'x-api-key': NEYNAR_API_KEY },
    });

    if (!reactionsRes.ok) {
      throw new Error(
        `Failed to fetch reactions from Neynar: ${reactionsRes.status} ${reactionsRes.statusText}`
      );
    }

    const reactionsData: NeynarCastReactionsResponse = await reactionsRes.json();
    const reactions = reactionsData?.reactions ?? [];
    allReactions = allReactions.concat(reactions);
    cursor = reactionsData?.next?.cursor || undefined;
  } while (cursor);

  // Collect unique users who reacted (deduplicate by FID)
  const uniqueUsers: Map<
    number,
    {
      fid: number;
      username: string;
      displayName: string;
      pfpUrl: string;
      primaryWallet: string;
    }
  > = new Map();

  for (const reaction of allReactions) {
    const user = reaction.user;
    const fid = user?.fid;
    if (!fid) continue;

    // Skip if we already processed this user
    if (uniqueUsers.has(fid)) continue;

    // Get primary wallet address
    const verifiedAddresses = user.verified_addresses;
    const primaryWallet =
      verifiedAddresses?.primary?.eth_address || verifiedAddresses?.eth_addresses?.[0];

    if (!primaryWallet || !isAddress(primaryWallet)) continue;

    // Add user to our unique set
    uniqueUsers.set(fid, {
      fid,
      username: user.username || '',
      displayName: user.display_name || '',
      pfpUrl: user.pfp_url || '',
      primaryWallet,
    });
  }

  // Convert to array
  return Array.from(uniqueUsers.values());
}

/**
 * Randomly selects a winner from an array of eligible reactors.
 *
 * @param reactors - Array of eligible reactors
 * @returns A randomly selected reactor
 */
function selectRandomWinner<T>(reactors: T[]): T {
  if (reactors.length === 0) {
    throw new Error('Cannot select winner from empty array');
  }
  const randomIndex = Math.floor(Math.random() * reactors.length);
  return reactors[randomIndex];
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

    // 1. Fetch cast reactions from Neynar
    let reactors;
    try {
      reactors = await fetchReactions(castHash);
    } catch (err) {
      console.error('[send-train] Failed to fetch reactions:', err);
      return NextResponse.json({ error: 'Failed to fetch reactions from Neynar' }, { status: 500 });
    }
    if (!reactors.length) {
      console.error('[send-train] No eligible reactors found for castHash:', castHash);
      return NextResponse.json({ error: 'No eligible reactors found' }, { status: 400 });
    }

    // 2. Randomly select the winner
    let winner;
    try {
      winner = selectRandomWinner(reactors);
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
      winner: {
        address: winnerAddress,
        fid: winner.fid,
        username: winner.username,
        displayName: winner.displayName,
        pfpUrl: winner.pfpUrl,
      },
      tokenURI,
      txHash,
      tokenId,
      totalEligibleReactors: reactors.length,
    });
  } catch (error) {
    console.error(
      '[send-train] Uncaught error:',
      error instanceof Error ? error.stack || error.message : error
    );
    return NextResponse.json({ error: 'Failed to trigger next stop.' }, { status: 500 });
  }
}
