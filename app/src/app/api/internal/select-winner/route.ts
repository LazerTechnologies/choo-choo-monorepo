import { NextResponse } from 'next/server';
import { isAddress } from 'viem';

interface NeynarConversationResponse {
  conversation: {
    cast: {
      direct_replies: Array<{
        author: {
          fid: number;
          username: string;
          display_name: string;
          pfp_url: string;
          verified_addresses: {
            eth_addresses: string[];
            primary: { eth_address: string | null };
          };
        };
      }>;
    };
  };
  next?: {
    cursor: string;
  };
}

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
 * Fetches replies to a given cast from Neynar, along with each reply author's primary wallet address.
 * Uses the conversation API which includes full user data in a single call.
 */
async function fetchReplies(castHash: string): Promise<
  Array<{
    primaryWallet: string;
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
  }>
> {
  if (!NEYNAR_API_KEY) throw new Error('Missing NEYNAR_API_KEY');

  // Fetch all replies to the cast with pagination
  let allReplies: Array<{
    author: {
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
    const url = new URL(`https://api.neynar.com/v2/farcaster/cast/conversation/`);
    url.searchParams.set('identifier', castHash);
    url.searchParams.set('type', 'hash');
    url.searchParams.set('reply_depth', '1');
    url.searchParams.set('limit', '50');
    url.searchParams.set('include_chronological_parent_casts', 'false');
    url.searchParams.set('fold', 'true'); // only high quality replies
    if (cursor) url.searchParams.set('cursor', cursor);

    const conversationRes = await fetch(url.toString(), {
      headers: { accept: 'application/json', 'x-api-key': NEYNAR_API_KEY },
    });

    if (!conversationRes.ok) {
      throw new Error(
        `Failed to fetch conversation from Neynar: ${conversationRes.status} ${conversationRes.statusText}`
      );
    }

    const conversationData: NeynarConversationResponse = await conversationRes.json();
    const replies = conversationData?.conversation?.cast?.direct_replies ?? [];
    allReplies = allReplies.concat(replies);
    cursor = conversationData?.next?.cursor || undefined;
  } while (cursor);

  // Collect unique users who replied (deduplicate by FID)
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

  for (const reply of allReplies) {
    const user = reply.author;
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
 * Randomly selects a winner from an array of eligible repliers.
 */
function selectRandomWinner<T>(repliers: T[]): T {
  if (repliers.length === 0) {
    throw new Error('Cannot select winner from empty array');
  }
  const randomIndex = Math.floor(Math.random() * repliers.length);
  return repliers[randomIndex];
}

/**
 * POST /api/internal/select-winner
 * Internal endpoint for selecting a winner from Farcaster cast replies
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

    // Fetch replies and select winner
    const repliers = await fetchReplies(castHash);

    if (repliers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No eligible repliers found' },
        { status: 400 }
      );
    }

    const winner = selectRandomWinner(repliers);

    const response: SelectWinnerResponse = {
      success: true,
      winner: {
        address: winner.primaryWallet,
        username: winner.username,
        fid: winner.fid,
        displayName: winner.displayName,
        pfpUrl: winner.pfpUrl,
      },
      totalEligibleReactors: repliers.length,
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
