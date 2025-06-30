import { NextResponse } from 'next/server';

interface NeynarCast {
  hash: string;
  author: { fid: number };
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
    // first we get all of the replies to that cast
    const repliesRes = await fetch(
      `${NEYNAR_API_BASE}/cast/replies?cast_hash=${castId}&limit=100`,
      {
        headers: { 'x-api-key': apiKey },
      }
    );
    if (!repliesRes.ok) {
      throw new Error(`Failed to fetch replies: ${repliesRes.statusText}`);
    }
    const repliesData = await repliesRes.json();
    const replies: NeynarCast[] = repliesData.result?.casts ?? [];
    if (replies.length === 0) {
      return NextResponse.json({ error: 'No replies found for this cast.' }, { status: 404 });
    }

    // then we need reaction counts for each reply
    const repliesWithReactions = await Promise.all(
      replies.map(async (reply) => {
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
      })
    );

    // get the one with the most reactions...
    const mostReactedReply = repliesWithReactions.reduce((max, curr) =>
      curr.reactionCount > max.reactionCount ? curr : max
    );

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
    if (!primaryWallet) {
      return NextResponse.json({ error: 'User wallet address not found.' }, { status: 404 });
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
