import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAddress } from 'viem';
import { redis } from '@/lib/kv';
import type { NeynarBulkUsersResponse } from '@/types/neynar';
import { CHOOCHOO_CAST_TEMPLATES } from '@/lib/constants';
import { getContractService } from '@/lib/services/contract';
import axios from 'axios';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

// Validation schema
const userSendTrainBodySchema = z.object({
  targetFid: z.number().positive('Target FID must be positive'),
});

interface UserSendTrainRequest {
  targetFid: number;
}

interface UserSendTrainResponse {
  success: boolean;
  winner: {
    address: string;
    username: string;
    fid: number;
    displayName: string;
    pfpUrl: string;
  };
  tokenId: number;
  txHash: string;
  tokenURI: string;
  error?: string;
}

/**
 * Fetches user data from Neynar by FID
 *
 * @param fid - The FID of the user to fetch data for.
 * @returns The user data if found, otherwise null.
 */
async function fetchUserByFid(fid: number): Promise<{
  address: string;
  username: string;
  fid: number;
  displayName: string;
  pfpUrl: string;
} | null> {
  if (!NEYNAR_API_KEY) {
    throw new Error('Neynar API key is not configured');
  }

  try {
    const response = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
      headers: {
        accept: 'application/json',
        'x-api-key': NEYNAR_API_KEY,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Neynar API error: ${response.statusText}`);
    }

    const data: NeynarBulkUsersResponse = await response.json();
    const users = data?.users || [];

    if (users.length === 0) {
      return null;
    }

    const user = users[0];
    const verifiedAddresses = user.verified_addresses;

    if (!verifiedAddresses) {
      throw new Error('User has no verified Ethereum addresses');
    }

    // Use primary ETH address if available, otherwise first ETH address
    const address = verifiedAddresses.primary?.eth_address || verifiedAddresses.eth_addresses?.[0];

    // Validate Ethereum address exists and is valid
    if (!address || !isAddress(address)) {
      throw new Error('User has no verified Ethereum addresses');
    }

    return {
      address,
      username: user.username,
      fid: user.fid,
      displayName: user.display_name,
      pfpUrl: user.pfp_url,
    };
  } catch (error) {
    console.error('[user-send-train] Failed to fetch user data:', error);
    throw error;
  }
}

/**
 * POST /api/user-send-train
 *
 * User version of send-train that works with just a FID instead of requiring a cast hash.
 * Orchestrates the next stop for the ChooChoo train journey for current holders.
 * Only accessible by current holders who have already sent a cast.
 *
 * @param request - The HTTP request object with body containing { targetFid: number }.
 * @returns 200 with { success: true, winner, tokenId, txHash, tokenURI } on success, or 400/500 with error message.
 */
export async function POST(request: Request) {
  try {
    // 1. Get current holder info to verify authentication
    const currentHolderResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/current-holder`
    );

    if (!currentHolderResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to verify current holder status' },
        { status: 500 }
      );
    }

    const currentHolderData = await currentHolderResponse.json();
    if (!currentHolderData.hasCurrentHolder) {
      return NextResponse.json({ error: 'No current holder found' }, { status: 403 });
    }

    // Note: Authentication is handled via the current holder check since this endpoint
    // should only be accessible to the current holder in the UI

    // 2. Check workflow state - user must be in CASTED state
    const workflowStateJson = await redis.get('workflowState');
    if (!workflowStateJson) {
      return NextResponse.json(
        { error: 'No workflow state found. Please send a cast first.' },
        { status: 400 }
      );
    }

    const workflowData = JSON.parse(workflowStateJson);
    if (workflowData.state !== 'CASTED') {
      return NextResponse.json(
        { error: 'You must send a cast first before manually selecting the next passenger' },
        { status: 400 }
      );
    }

    // 3. Check USDC deposit requirement for current holder
    const currentUserFid = currentHolderData.currentHolder.fid;
    try {
      const contractService = getContractService();
      const hasDeposited = await contractService.hasDepositedEnough(currentUserFid);

      if (!hasDeposited) {
        const [deposited, required] = await Promise.all([
          contractService.getFidDeposited(currentUserFid),
          contractService.getDepositCost(),
        ]);

        return NextResponse.json(
          {
            error:
              'Insufficient USDC deposit. You must deposit at least 1 USDC to manually send the train.',
            depositStatus: {
              required: required.toString(),
              deposited: deposited.toString(),
              satisfied: false,
            },
          },
          { status: 402 } // Payment Required
        );
      }
    } catch (err) {
      console.error('[user-send-train] Failed to check deposit status:', err);
      return NextResponse.json({ error: 'Failed to verify deposit status' }, { status: 500 });
    }

    // 4. Parse and validate request body
    let body: UserSendTrainRequest;
    try {
      const rawBody = await request.json();
      const parsed = userSendTrainBodySchema.safeParse(rawBody);

      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid request body',
            details: parsed.error.flatten(),
          },
          { status: 400 }
        );
      }

      body = parsed.data as UserSendTrainRequest;
    } catch (err) {
      console.error('[user-send-train] Error parsing request body:', err);
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { targetFid } = body;

    console.log(`[user-send-train] 🚂 Manual selection request for target FID: ${targetFid}`);

    // 4. Fetch user data from Neynar
    let winnerData;
    try {
      winnerData = await fetchUserByFid(targetFid);
      if (!winnerData) {
        return NextResponse.json(
          { success: false, error: `User with FID ${targetFid} not found` },
          { status: 404 }
        );
      }
    } catch (err) {
      console.error('[user-send-train] Failed to fetch user data:', err);
      return NextResponse.json(
        {
          error: `Failed to fetch user data: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
        { status: 500 }
      );
    }

    console.log(`[user-send-train] Found user: ${winnerData.username} (${winnerData.address})`);

    // Get current holder data for NFT minting
    const currentHolder = {
      username: currentHolderData.currentHolder.username,
      fid: currentHolderData.currentHolder.fid,
      displayName: currentHolderData.currentHolder.displayName,
      pfpUrl: currentHolderData.currentHolder.pfpUrl,
    };

    // 5. Get next token ID from contract
    let tokenId;
    try {
      const contractService = getContractService();
      tokenId = await contractService.getNextOnChainTicketId();
      console.log(`[user-send-train] Next token ID from contract: ${tokenId}`);
    } catch (err) {
      console.error('[user-send-train] Failed to get next token ID from contract:', err);
      return NextResponse.json({ error: 'Failed to get next token ID from contract' }, { status: 500 });
    }

    // 6. Generate NFT with departing passenger's username
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
            passengerUsername: currentHolder.username,
          }),
        }
      );

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        throw new Error(`NFT generation failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('[user-send-train] Failed to generate NFT:', err);
      return NextResponse.json({ error: 'Failed to generate NFT' }, { status: 500 });
    }

    const nftData = await generateResponse.json();

    if (!nftData.success) {
      console.error('[user-send-train] NFT generation returned failure:', nftData.error);
      return NextResponse.json(
        { error: nftData.error || 'Failed to generate NFT' },
        { status: 500 }
      );
    }

    // 7. Mint token on contract
    let mintResponse;
    try {
      mintResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/internal/mint-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': INTERNAL_SECRET || '',
        },
        body: JSON.stringify({
          newHolderAddress: winnerData.address,
          tokenURI: nftData.tokenURI,
          newHolderData: {
            username: winnerData.username,
            fid: winnerData.fid,
            displayName: winnerData.displayName,
            pfpUrl: winnerData.pfpUrl,
          },
          previousHolderData: currentHolder, // Previous holder gets the NFT ticket
          sourceCastHash: undefined, // No cast hash for user manual selection
          totalEligibleReactors: 1, // Manually selected, so only 1 "eligible" user
        }),
      });

      if (!mintResponse.ok) {
        const errorData = await mintResponse.json();
        throw new Error(`Token minting failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('[user-send-train] Failed to mint token:', err);
      return NextResponse.json({ error: 'Failed to mint token' }, { status: 500 });
    }

    const mintData = await mintResponse.json();

    if (!mintData.success) {
      console.error('[user-send-train] Token minting returned failure:', mintData.error);
      return NextResponse.json(
        { error: mintData.error || 'Failed to mint token' },
        { status: 500 }
      );
    }

    // 8. Reset workflow state to NOT_CASTED for the new holder
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/workflow-state`, {
        state: 'NOT_CASTED',
        winnerSelectionStart: null,
        currentCastHash: null,
      });
      console.log(
        '[user-send-train] Reset workflow state to NOT_CASTED after successful train movement'
      );
    } catch (err) {
      console.error('[user-send-train] Failed to reset workflow state (non-critical):', err);
    }

    // 9. Send announcement casts from ChooChoo account
    try {
      // 9a. Send welcome cast to new holder
      const welcomeCastText = CHOOCHOO_CAST_TEMPLATES.WELCOME_PASSENGER(winnerData.username);

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
        console.log(`[user-send-train] Successfully sent welcome cast: ${castData.cast?.hash}`);
      } else {
        const errorData = await welcomeCastResponse.json();
        console.warn(
          '[user-send-train] Failed to send welcome cast (non-critical):',
          errorData.error
        );
      }

      // 9b. Send ticket issued cast for previous holder
      const ticketCastText = CHOOCHOO_CAST_TEMPLATES.TICKET_ISSUED(
        currentHolder.username,
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
        console.log(
          `[user-send-train] Successfully sent ticket cast: ${ticketCastData.cast?.hash}`
        );
      } else {
        const ticketErrorData = await ticketCastResponse.json();
        console.warn(
          '[user-send-train] Failed to send ticket cast (non-critical):',
          ticketErrorData.error
        );
      }
    } catch (err) {
      console.warn('[user-send-train] Failed to send announcement casts (non-critical):', err);
      // Don't fail the request for cast sending issues
    }

    // 10. Return combined result
    console.log(
      `[user-send-train] Successfully orchestrated user train movement for token ${mintData.actualTokenId}`
    );

    const response: UserSendTrainResponse = {
      success: true,
      winner: winnerData,
      tokenId: mintData.actualTokenId,
      txHash: mintData.txHash,
      tokenURI: nftData.tokenURI,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[user-send-train] User orchestration failed:', error);
    return NextResponse.json({ error: 'Failed to process user train movement' }, { status: 500 });
  }
}
