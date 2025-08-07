import { NextResponse } from 'next/server';
import { getContractService } from '@/lib/services/contract';
import { redis } from '@/lib/kv';
import { CHOOCHOO_CAST_TEMPLATES } from '@/lib/constants';

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
    console.log('[send-train] 🫡 Public random winner selection request');

    // 1. Get current cast hash from Redis
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

    // 2. Select winner from Farcaster reactions using the current cast hash
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

    // 4. Get current holder (who will receive the NFT as their journey ticket)
    let currentHolderData = null;
    try {
      const currentHolderResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/current-holder`
      );
      if (currentHolderResponse.ok) {
        const data = await currentHolderResponse.json();
        if (data.hasCurrentHolder) {
          currentHolderData = {
            username: data.currentHolder.username,
            fid: data.currentHolder.fid,
            displayName: data.currentHolder.displayName,
            pfpUrl: data.currentHolder.pfpUrl,
          };
          console.log(
            `[send-train] Current holder: ${currentHolderData.username} (FID: ${currentHolderData.fid}) will receive NFT`
          );
        }
      }
    } catch (err) {
      console.warn('[send-train] Failed to get current holder (non-critical):', err);
    }

    // 5. Get next token ID
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

    // 5. Mint token on contract
    let mintResponse;
    try {
      mintResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/internal/mint-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': INTERNAL_SECRET || '',
        },
        body: JSON.stringify({
          newHolderAddress: winnerData.winner.address,
          tokenURI: nftData.tokenURI,
          tokenId,
          newHolderData: winnerData.winner,
          previousHolderData: currentHolderData, // Previous holder gets the NFT ticket
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

    // 6. Clear the flags since the train has moved
    try {
      await Promise.all([
        redis.del('current-cast-hash'),
        redis.del('hasCurrentUserCasted'),
        redis.del('useRandomWinner'),
        redis.del('winnerSelectionStart'),
        redis.del('isPublicSendEnabled'),
      ]);
      console.log(
        '[send-train] Cleared current cast hash, user casted flag, and winner selection flags after successful train movement'
      );
    } catch (err) {
      console.error('[send-train] Failed to clear flags (non-critical):', err);
      // Don't fail the request for this
    }

    // 7. Send announcement casts from ChooChoo account
    try {
      // 8a. Send welcome cast to new holder
      const welcomeCastText = CHOOCHOO_CAST_TEMPLATES.WELCOME_PASSENGER(winnerData.winner.username);

      const welcomeCastResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/internal/send-cast`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET || '',
          },
          body: JSON.stringify({
            text: welcomeCastText,
            // channel_id: 'base', // @note: if we want to add a channel to the cast
          }),
        }
      );

      if (welcomeCastResponse.ok) {
        const castData = await welcomeCastResponse.json();
        console.log(`[send-train] Successfully sent welcome cast: ${castData.cast?.hash}`);
      } else {
        const errorData = await welcomeCastResponse.json();
        console.warn('[send-train] Failed to send welcome cast (non-critical):', errorData.error);
      }

      // 8b. Send ticket issued cast for previous holder (if they exist)
      if (currentHolderData?.username) {
        const ticketCastText = CHOOCHOO_CAST_TEMPLATES.TICKET_ISSUED(
          currentHolderData.username,
          mintData.actualTokenId
        );

        const imageUrl = `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${nftData.imageHash}`;

        const ticketCastResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/internal/send-cast`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-secret': INTERNAL_SECRET || '',
            },
            body: JSON.stringify({
              text: ticketCastText,
              embeds: [{ url: imageUrl }],
            }),
          }
        );

        if (ticketCastResponse.ok) {
          const ticketCastData = await ticketCastResponse.json();
          console.log(`[send-train] Successfully sent ticket cast: ${ticketCastData.cast?.hash}`);
        } else {
          const ticketErrorData = await ticketCastResponse.json();
          console.warn(
            '[send-train] Failed to send ticket cast (non-critical):',
            ticketErrorData.error
          );
        }
      }
    } catch (err) {
      console.warn('[send-train] Failed to send announcement casts (non-critical):', err);
      // Don't fail the request for cast sending issues
    }

    // 8. Return combined result
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
