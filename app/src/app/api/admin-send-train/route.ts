import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAddress } from 'viem';
import { getContractService } from '@/lib/services/contract';
import type { NeynarBulkUsersResponse } from '@/types/neynar';
import { CHOOCHOO_CAST_TEMPLATES, ADMIN_FIDS } from '@/lib/constants';
import { redis } from '@/lib/kv';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

// Validation schema
const adminSendTrainBodySchema = z.object({
  targetFid: z.number().positive('Target FID must be positive'),
  adminFid: z.number().positive('Admin FID must be positive'),
});

interface AdminSendTrainRequest {
  targetFid: number;
  adminFid: number;
}

interface AdminSendTrainResponse {
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
    console.error('[admin-send-train] Failed to fetch user data:', error);
    throw error;
  }
}

/**
 * POST /api/admin-send-train
 *
 * Admin version of send-train that works with just a FID instead of requiring a cast hash.
 * Orchestrates the next stop for the ChooChoo train journey for admin testing.
 * Only accessible by authenticated admin users.
 *
 * @param request - The HTTP request object with body containing { fid: number }.
 * @returns 200 with { success: true, winner, tokenId, txHash, tokenURI } on success, or 400/500 with error message.
 */
export async function POST(request: Request) {
  try {
    // 1. Parse and validate request body
    let body: AdminSendTrainRequest;
    try {
      const rawBody = await request.json();
      const parsed = adminSendTrainBodySchema.safeParse(rawBody);

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

      body = parsed.data as AdminSendTrainRequest;
    } catch (err) {
      console.error('[admin-send-train] Error parsing request body:', err);
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { targetFid, adminFid } = body;

    // 2. Admin check - only allow specific admin FIDs
    if (!ADMIN_FIDS.includes(adminFid)) {
      console.error(`[admin-send-train] 🔒 Forbidden: FID ${adminFid} is not an admin`);
      return NextResponse.json({ error: '🔒 Forbidden - Admin access required' }, { status: 403 });
    }

    console.log(
      `[admin-send-train] 🛡️ Admin request from FID: ${adminFid} for target FID: ${targetFid}`
    );

    // 3. Fetch user data from Neynar
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
      console.error('[admin-send-train] Failed to fetch user data:', err);
      return NextResponse.json(
        {
          error: `Failed to fetch user data: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
        { status: 500 }
      );
    }

    console.log(`[admin-send-train] Found user: ${winnerData.username} (${winnerData.address})`);

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
            `[admin-send-train] Current holder: ${currentHolderData.username} (FID: ${currentHolderData.fid}) will receive NFT`
          );
        }
      }
    } catch (err) {
      console.warn('[admin-send-train] Failed to get current holder (non-critical):', err);
    }

    // 5. Get next token ID
    let contractService, totalSupply, tokenId;
    try {
      contractService = getContractService();
      totalSupply = await contractService.getTotalSupply();
      tokenId = totalSupply + 1;
    } catch (err) {
      console.error('[admin-send-train] Failed to get contract state:', err);
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
            passengerUsername: winnerData.username,
          }),
        }
      );

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        throw new Error(`NFT generation failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('[admin-send-train] Failed to generate NFT:', err);
      return NextResponse.json({ error: 'Failed to generate NFT' }, { status: 500 });
    }

    const nftData = await generateResponse.json();

    if (!nftData.success) {
      console.error('[admin-send-train] NFT generation returned failure:', nftData.error);
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
          newHolderAddress: winnerData.address,
          tokenURI: nftData.tokenURI,
          tokenId,
          newHolderData: {
            username: winnerData.username,
            fid: winnerData.fid,
            displayName: winnerData.displayName,
            pfpUrl: winnerData.pfpUrl,
          },
          previousHolderData: currentHolderData, // Previous holder gets the NFT ticket
          sourceCastHash: undefined, // No cast hash for admin flow
          totalEligibleReactors: 1, // Admin selected, so only 1 "eligible" user
        }),
      });

      if (!mintResponse.ok) {
        const errorData = await mintResponse.json();
        throw new Error(`Token minting failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('[admin-send-train] Failed to mint token:', err);
      return NextResponse.json({ error: 'Failed to mint token' }, { status: 500 });
    }

    const mintData = await mintResponse.json();

    if (!mintData.success) {
      console.error('[admin-send-train] Token minting returned failure:', mintData.error);
      return NextResponse.json(
        { error: mintData.error || 'Failed to mint token' },
        { status: 500 }
      );
    }

    // 7. Send announcement casts from ChooChoo account
    try {
      // 7a. Send welcome cast to new holder
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
            parent: 'https://onchainsummer.xyz', // Post in the Base channel
          }),
        }
      );

      if (welcomeCastResponse.ok) {
        const castData = await welcomeCastResponse.json();
        console.log(`[admin-send-train] Successfully sent welcome cast: ${castData.cast?.hash}`);
      } else {
        const errorData = await welcomeCastResponse.json();
        console.warn(
          '[admin-send-train] Failed to send welcome cast (non-critical):',
          errorData.error
        );
      }

      // 7b. Send ticket issued cast for previous holder (if they exist)
      if (currentHolderData?.username) {
        const ticketCastText = CHOOCHOO_CAST_TEMPLATES.TICKET_ISSUED(
          currentHolderData.username,
          mintData.actualTokenId,
          nftData.imageHash
        );

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
              parent: 'https://onchainsummer.xyz', // Post in the Base channel
            }),
          }
        );

        if (ticketCastResponse.ok) {
          const ticketCastData = await ticketCastResponse.json();
          console.log(
            `[admin-send-train] Successfully sent ticket cast: ${ticketCastData.cast?.hash}`
          );
        } else {
          const ticketErrorData = await ticketCastResponse.json();
          console.warn(
            '[admin-send-train] Failed to send ticket cast (non-critical):',
            ticketErrorData.error
          );
        }
      }
    } catch (err) {
      console.warn('[admin-send-train] Failed to send announcement casts (non-critical):', err);
      // Don't fail the request for cast sending issues
    }

    // 8. Clear winner selection flags since the train has moved
    try {
      await Promise.all([
        redis.del('current-cast-hash'),
        redis.del('hasCurrentUserCasted'),
        redis.del('useRandomWinner'),
        redis.del('winnerSelectionStart'),
        redis.del('isPublicSendEnabled'),
      ]);
      console.log(
        '[admin-send-train] Cleared cast flags and winner selection flags after admin train movement'
      );
    } catch (err) {
      console.error('[admin-send-train] Failed to clear flags (non-critical):', err);
      // Don't fail the request for this
    }

    // 9. Return combined result
    console.log(
      `[admin-send-train] Successfully orchestrated admin train movement for token ${mintData.actualTokenId}`
    );

    const response: AdminSendTrainResponse = {
      success: true,
      winner: winnerData,
      tokenId: mintData.actualTokenId,
      txHash: mintData.txHash,
      tokenURI: nftData.tokenURI,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[admin-send-train] Admin orchestration failed:', error);
    return NextResponse.json({ error: 'Failed to process admin train movement' }, { status: 500 });
  }
}
