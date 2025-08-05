import { NextResponse } from 'next/server';
import { getContractService } from '@/lib/services/contract';
import { getSession } from '@/auth';
import { redis } from '@/lib/kv';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

/**
 * POST /api/send-train
 *
 * Orchestrates the next stop for the ChooChoo train journey. Anyone can call this endpoint if criteria is met.
 * Uses internal microservice endpoints for each step.
 * Uses the current cast hash stored in Redis from the app-generated cast published by the current holder.
 *
 * @param request - The HTTP request object (no body required).
 * @returns 200 with { success: true, winner, tokenId, txHash, tokenURI, totalEligibleReactors } on success, or 400/500 with error message.
 */
export async function POST() {
  try {
    // 1. Authentication - only allow authenticated Farcaster users
    const session = await getSession();
    if (!session?.user?.fid) {
      console.error('[send-train] 🔒 Unauthorized: Must call from within Farcaster');
      return NextResponse.json(
        { error: '🔒 Unauthorized - Farcaster authentication required' },
        { status: 401 }
      );
    }

    console.log(`[send-train] 🫡 Authenticated request from FID: ${session.user.fid}`);

    // 2. Get current cast hash from Redis
    let castHash;
    try {
      castHash = await redis.get('current-cast-hash');
      if (!castHash) {
        console.error('[send-train] No current cast hash found in Redis');
        return NextResponse.json(
          {
            error: 'No active cast found. The current holder must publish a cast first.',
          },
          { status: 400 }
        );
      }
    } catch (err) {
      console.error('[send-train] Failed to get cast hash from Redis:', err);
      return NextResponse.json({ error: 'Failed to retrieve current cast' }, { status: 500 });
    }

    console.log(`[send-train] Starting orchestration for cast: ${castHash}`);

    // 3. Select winner from Farcaster reactions using the current cast hash
    let winnerResponse;
    try {
      winnerResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/internal/select-winner`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET || '',
          },
          body: JSON.stringify({ castHash }),
        }
      );

      if (!winnerResponse.ok) {
        const errorData = await winnerResponse.json();
        throw new Error(`Winner selection failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('[send-train] Failed to select winner:', err);
      return NextResponse.json({ error: 'Failed to select winner' }, { status: 500 });
    }

    const winnerData = await winnerResponse.json();

    if (!winnerData.success) {
      console.error('[send-train] Winner selection returned failure:', winnerData.error);
      return NextResponse.json(
        { error: winnerData.error || 'Failed to select winner' },
        { status: 400 }
      );
    }

    // 4. Get next token ID
    let contractService, totalSupply, tokenId;
    try {
      contractService = getContractService();
      totalSupply = await contractService.getTotalSupply();
      tokenId = totalSupply + 1;
    } catch (err) {
      console.error('[send-train] Failed to get contract state:', err);
      return NextResponse.json({ error: 'Failed to get contract state' }, { status: 500 });
    }

    // 5. Generate NFT with winner's username
    let generateResponse;
    try {
      generateResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/internal/generate-nft`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET || '',
          },
          body: JSON.stringify({
            tokenId,
            passengerUsername: winnerData.winner.username,
          }),
        }
      );

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        throw new Error(`NFT generation failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('[send-train] Failed to generate NFT:', err);
      return NextResponse.json({ error: 'Failed to generate NFT' }, { status: 500 });
    }

    const nftData = await generateResponse.json();

    if (!nftData.success) {
      console.error('[send-train] NFT generation returned failure:', nftData.error);
      return NextResponse.json(
        { error: nftData.error || 'Failed to generate NFT' },
        { status: 500 }
      );
    }

    // 6. Mint token on contract
    let mintResponse;
    try {
      mintResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/internal/mint-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': INTERNAL_SECRET || '',
        },
        body: JSON.stringify({
          recipient: winnerData.winner.address,
          tokenURI: nftData.tokenURI,
          tokenId,
          winnerData: winnerData.winner,
          sourceCastHash: castHash,
          totalEligibleReactors: winnerData.totalEligibleReactors,
        }),
      });

      if (!mintResponse.ok) {
        const errorData = await mintResponse.json();
        throw new Error(`Token minting failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('[send-train] Failed to mint token:', err);
      return NextResponse.json({ error: 'Failed to mint token' }, { status: 500 });
    }

    const mintData = await mintResponse.json();

    if (!mintData.success) {
      console.error('[send-train] Token minting returned failure:', mintData.error);
      return NextResponse.json(
        { error: mintData.error || 'Failed to mint token' },
        { status: 500 }
      );
    }

    // 7. Return combined result
    console.log(
      `[send-train] Successfully orchestrated train movement for token ${mintData.actualTokenId}`
    );

    return NextResponse.json({
      success: true,
      winner: winnerData.winner,
      tokenId: mintData.actualTokenId,
      txHash: mintData.txHash,
      tokenURI: nftData.tokenURI,
      totalEligibleReactors: winnerData.totalEligibleReactors,
    });
  } catch (error) {
    console.error('[send-train] Orchestration failed:', error);
    return NextResponse.json({ error: 'Failed to process train movement' }, { status: 500 });
  }
}
