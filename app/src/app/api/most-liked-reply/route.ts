import { NextResponse } from 'next/server';
import { isAddress } from 'viem';

interface NeynarCast {
  hash: string;
  author: { fid: number };
  timestamp: number;
}

interface NeynarReaction {
  fid: number;
}

interface NeynarUser {
  fid: number;
  custody_address: string;
  verifications?: string[];
  username?: string;
}

const NEYNAR_API_BASE = 'https://api.neynar.com/v2/farcaster';

/**
 * API Route: /api/most-liked-reply
 *
 * Given a cast ID, finds the reply with the most likes and returns the user and their primary wallet address.
 *
 * Query Parameters:
 *   - castId (string, required): The hash of the cast to analyze.
 *
 * Responses:
 *   - 200: { user: NeynarUser, walletAddress: string, reply: NeynarCast }
 *   - 400: { error: string }
 *   - 500: { error: string }
 */
export async function GET(request: Request) {
  const apiKey = process.env.NEYNAR_API_KEY;
  const { searchParams } = new URL(request.url);
  const castId = searchParams.get('castId');

  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'Make sure NEYNAR_API_KEY is set in your environment variables.',
      },
      { status: 500 }
    );
  }

  if (!castId) {
    return NextResponse.json({ error: 'castId parameter is required' }, { status: 400 });
  }

  try {
    // Fetch all replies with pagination
    let allReplies: NeynarCast[] = [];
    let cursor: string | undefined = undefined;
    do {
      const url = new URL(`${NEYNAR_API_BASE}/cast/replies`);
      url.searchParams.set('cast_hash', castId!);
      url.searchParams.set('limit', '100');
      if (cursor) url.searchParams.set('cursor', cursor);

      const repliesRes = await fetch(url.toString(), {
        headers: { 'x-api-key': apiKey },
      });
      if (!repliesRes.ok) {
        throw new Error(`Failed to fetch replies: ${repliesRes.statusText}`);
      }
      const repliesData = await repliesRes.json();
      const replies: NeynarCast[] = repliesData.result?.casts ?? [];
      allReplies = allReplies.concat(replies);
      cursor = repliesData.result?.next?.cursor || repliesData.result?.next;
    } while (cursor);

    if (allReplies.length === 0) {
      return NextResponse.json({ error: 'No replies found for this cast.' }, { status: 404 });
    }

    // then we need reaction counts for each reply
    // Throttle concurrent fetches to avoid rate limits
    async function asyncPool<T, R>(
      poolLimit: number,
      array: T[],
      iteratorFn: (item: T) => Promise<R>
    ): Promise<R[]> {
      const ret: R[] = [];
      const executing: Promise<void>[] = [];
      for (const item of array) {
        const p: Promise<void> = iteratorFn(item).then((res) => {
          ret.push(res);
        });
        executing.push(p);
        if (executing.length >= poolLimit) {
          await Promise.race(executing);
        }
      }
      await Promise.all(executing);
      return ret;
    }

    const repliesWithReactions = await asyncPool(5, allReplies, async (reply) => {
      const reactionsRes = await fetch(
        `${NEYNAR_API_BASE}/cast/reactions?cast_hash=${reply.hash}`,
        {
          headers: { 'x-api-key': apiKey },
        }
      );
      if (!reactionsRes.ok) {
        return { ...reply, reactionCount: 0 };
      }
      const reactionsData = await reactionsRes.json();
      const likes: NeynarReaction[] = reactionsData.result?.likes ?? [];
      const recasts: NeynarReaction[] = reactionsData.result?.recasts ?? [];
      const reactionCount = likes.length + recasts.length;
      return { ...reply, reactionCount };
    });

    // get the one with the most reactions...
    const mostReactedReply = repliesWithReactions.reduce((max, curr) => {
      if (curr.reactionCount > max.reactionCount) {
        return curr;
      } else if (curr.reactionCount === max.reactionCount) {
        // prefer earlier timestamp for tie-breaker
        // @todo make sure it's not created_at
        return new Date(curr.timestamp) < new Date(max.timestamp) ? curr : max;
      }
      return max;
    });

    if (!mostReactedReply || mostReactedReply.reactionCount === 0) {
      return NextResponse.json(
        { error: 'No reacted replies found for this cast.' },
        { status: 404 }
      );
    }

    // ...and the user who made it
    const authorFid = mostReactedReply.author.fid;
    const userRes = await fetch(`${NEYNAR_API_BASE}/user?fid=${authorFid}`, {
      headers: { 'x-api-key': apiKey },
    });
    if (!userRes.ok) {
      throw new Error(`Failed to fetch user: ${userRes.statusText}`);
    }
    const userData = await userRes.json();
    const user: NeynarUser = userData.result?.user;
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }
    // Use the first address in verifications as the primary wallet, fallback to custody_address
    const primaryWallet = (user.verifications && user.verifications[0]) || user.custody_address;
    if (!primaryWallet || !isAddress(primaryWallet)) {
      return NextResponse.json(
        { error: 'User wallet address not found or invalid.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user,
      walletAddress: primaryWallet,
      reply: mostReactedReply,
    });
  } catch (error) {
    console.error('Failed to process most-liked-reply:', error);
    return NextResponse.json(
      { error: 'Failed to process most-liked-reply. Please try again later.' },
      { status: 500 }
    );
  }
}
