// @todo: can remove thid file when we go to production
import { NextResponse } from 'next/server';
import { isAddress } from 'viem';
import type { NeynarCastReactionsResponse } from '@/types/neynar';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

/**
 * Fetches reactions to a given cast from Neynar, along with each reactor's primary wallet address.
 * This is the same function used in send-train but isolated for testing.
 * Uses the efficient reactions API which includes full user data in a single call.
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
  let pageCount = 0;

  do {
    pageCount++;
    const url = new URL(`https://api.neynar.com/v2/farcaster/reactions/cast/`);
    url.searchParams.set('hash', castHash);
    url.searchParams.set('types', 'all');
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);

    console.log(`[test-neynar] Fetching reactions page ${pageCount} for cast ${castHash}`);

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

    console.log(
      `[test-neynar] Page ${pageCount}: Found ${reactions.length} reactions, cursor: ${cursor ? 'exists' : 'none'}`
    );
  } while (cursor);

  console.log(
    `[test-neynar] Total reactions found: ${allReactions.length} across ${pageCount} pages`
  );

  // Collect unique users who reacted (deduplicate by FID)
  const uniqueUsers: Map<
    number,
    {
      fid: number;
      username: string;
      displayName: string;
      pfpUrl: string;
      primaryWallet: string;
      reactionTypes: { likes: number; recasts: number };
    }
  > = new Map();

  for (const reaction of allReactions) {
    const user = reaction.user;
    const fid = user?.fid;
    if (!fid) continue;

    // Get primary wallet address
    const verifiedAddresses = user.verified_addresses;
    const primaryWallet =
      verifiedAddresses?.primary?.eth_address || verifiedAddresses?.eth_addresses?.[0];

    if (!primaryWallet || !isAddress(primaryWallet)) continue;

    // Initialize or update user data (for testing, we track reaction types)
    if (!uniqueUsers.has(fid)) {
      uniqueUsers.set(fid, {
        fid,
        username: user.username || '',
        displayName: user.display_name || '',
        pfpUrl: user.pfp_url || '',
        primaryWallet,
        reactionTypes: { likes: 0, recasts: 0 },
      });
    }

    // Track reaction types for testing insights
    const userData = uniqueUsers.get(fid)!;
    if (reaction.reaction_type === 'like') {
      userData.reactionTypes.likes++;
    } else if (reaction.reaction_type === 'recast') {
      userData.reactionTypes.recasts++;
    }
  }

  console.log(`[test-neynar] Unique users with verified addresses: ${uniqueUsers.size}`);

  // Convert to array (without reaction types for consistency with send-train)
  return Array.from(uniqueUsers.values()).map((user) => ({
    primaryWallet: user.primaryWallet,
    fid: user.fid,
    username: user.username,
    displayName: user.displayName,
    pfpUrl: user.pfpUrl,
  }));
}

/**
 * Randomly selects a winner from an array of eligible reactors.
 */
function selectRandomWinner<T>(reactors: T[]): T {
  if (reactors.length === 0) {
    throw new Error('Cannot select winner from empty array');
  }
  const randomIndex = Math.floor(Math.random() * reactors.length);
  return reactors[randomIndex];
}

/**
 * POST /api/test-neynar-replies
 *
 * Test endpoint for Neynar API integration.
 * Expects JSON body: { castHash: string }
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (err) {
      console.error('[test-neynar] Error parsing request body:', err);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { castHash } = body;
    if (!castHash || typeof castHash !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid castHash' }, { status: 400 });
    }

    console.log(`[test-neynar] Testing Neynar API with cast hash: ${castHash}`);

    // Test the fetchReactions function
    const startTime = Date.now();
    const results = await fetchReactions(castHash);
    const duration = Date.now() - startTime;

    // Calculate statistics
    const totalReactors = results.length;
    const randomWinner = totalReactors > 0 ? selectRandomWinner(results) : null;

    return NextResponse.json({
      success: true,
      castHash,
      duration: `${duration}ms`,
      statistics: {
        totalEligibleReactors: totalReactors,
        selectionMethod: 'random',
      },
      randomWinner: randomWinner
        ? {
            fid: randomWinner.fid,
            username: randomWinner.username,
            displayName: randomWinner.displayName,
            pfpUrl: randomWinner.pfpUrl,
            primaryWallet: randomWinner.primaryWallet,
          }
        : null,
      sampleReactors: results.slice(0, 5).map((r) => ({
        fid: r.fid,
        username: r.username,
        displayName: r.displayName,
        primaryWallet: `${r.primaryWallet.slice(0, 6)}...${r.primaryWallet.slice(-4)}`,
      })),
      allResults: results, // Full results for debugging
    });
  } catch (error) {
    console.error('[test-neynar] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to test Neynar API',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test-neynar-replies?castHash=<hash>
 *
 * Alternative interface using query parameters
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const castHash = url.searchParams.get('castHash');

  if (!castHash) {
    return NextResponse.json({ error: 'Missing castHash query parameter' }, { status: 400 });
  }

  // Reuse POST logic
  return POST(
    new Request(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ castHash }),
    })
  );
}
