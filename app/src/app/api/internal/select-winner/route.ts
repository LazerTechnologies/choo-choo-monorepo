import { NextResponse } from 'next/server';
import { isAddress } from 'viem';
import type { NeynarCastReactionsResponse } from '@/types/neynar';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

interface SelectWinnerRequest {
  castHash: string;
}

interface SelectWinnerResponse {
  success: boolean;
  winner: {
    address: string;
    username: string;
    fid: number;
    displayName: string;
    pfpUrl: string;
  };
  totalEligibleReactors: number;
  error?: string;
}

/**
 * Fetches reactions to a given cast from Neynar, along with each reactor's primary wallet address.
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

    if (uniqueUsers.has(fid)) continue;

    const verifiedAddresses = user.verified_addresses;
    const primaryWallet =
      verifiedAddresses?.primary?.eth_address || verifiedAddresses?.eth_addresses?.[0];

    if (!primaryWallet || !isAddress(primaryWallet)) continue;

    uniqueUsers.set(fid, {
      fid,
      username: user.username || '',
      displayName: user.display_name || '',
      pfpUrl: user.pfp_url || '',
      primaryWallet,
    });
  }

  return Array.from(uniqueUsers.values());
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
 * POST /api/internal/select-winner
 * Internal endpoint for selecting a winner from Farcaster cast reactions
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('x-internal-secret');
    if (!INTERNAL_SECRET || authHeader !== INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let body: SelectWinnerRequest;
    try {
      body = await request.json();
    } catch (err) {
      console.error('[internal/select-winner] Error parsing request body:', err);
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { castHash } = body;
    if (!castHash || typeof castHash !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid castHash' },
        { status: 400 }
      );
    }

    console.log(`[internal/select-winner] Selecting winner for cast: ${castHash}`);

    // Fetch reactions and select winner
    const reactors = await fetchReactions(castHash);

    if (reactors.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No eligible reactors found' },
        { status: 400 }
      );
    }

    const winner = selectRandomWinner(reactors);

    const response: SelectWinnerResponse = {
      success: true,
      winner: {
        address: winner.primaryWallet,
        username: winner.username,
        fid: winner.fid,
        displayName: winner.displayName,
        pfpUrl: winner.pfpUrl,
      },
      totalEligibleReactors: reactors.length,
    };

    console.log(
      `[internal/select-winner] Selected winner: ${winner.username} (${winner.primaryWallet})`
    );
    return NextResponse.json(response);
  } catch (error) {
    console.error('[internal/select-winner] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to select winner',
      },
      { status: 500 }
    );
  }
}
