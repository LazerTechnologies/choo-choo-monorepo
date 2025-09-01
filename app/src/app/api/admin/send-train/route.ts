import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAddress } from 'viem';
import type { NeynarBulkUsersResponse } from '@/types/neynar';
import { CHOOCHOO_CAST_TEMPLATES } from '@/lib/constants';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getContractService } from '@/lib/services/contract';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

// Validation schema
const adminSendTrainBodySchema = z.object({
  targetFid: z.number().positive('Target FID must be positive'),
});

interface AdminSendTrainRequest {
  targetFid: number;
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
 * POST /api/admin/send-train
 *
 * Admin version of send-train that works with just a FID instead of requiring a cast hash.
 * Orchestrates the next stop for the ChooChoo train journey for admin testing.
 * Only accessible by authenticated admin users.
 *
 * @param request - The HTTP request object with body containing { targetFid: number }.
 * @returns 200 with { success: true, winner, tokenId, txHash, tokenURI } on success, or 400/500 with error message.
 */
export async function POST(request: Request) {
  try {
    // 0. Admin auth
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

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

    const { targetFid } = body;

    console.log(
      `[admin-send-train] 🛡️ Admin request from FID: ${auth.adminFid} for target FID: ${targetFid}`
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

    // 5. Get next token ID from contract
    let tokenId;
    try {
      const contractService = getContractService();
      tokenId = await contractService.getNextOnChainTicketId();
      console.log(`[admin-send-train] Next token ID from contract: ${tokenId}`);
    } catch (err) {
      console.error('[admin-send-train] Failed to get next token ID from contract:', err);
      return NextResponse.json({ error: 'Failed to get next token ID from contract' }, { status: 500 });
    }

    // 5. Generate NFT with departing passenger's username
    let generateResponse;
    try {
      const passengerUsername = currentHolderData?.username || 'unknown';
      generateResponse = await fetch(
        `${process.env.NEXT_PUBLIC_URL}/api/internal/generate-nft`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET || '',
          },
          body: JSON.stringify({
            tokenId,
            passengerUsername,
          }),
        }
      );
    } catch (err) {
      console.error('[admin-send-train] Failed to call generate-nft:', err);
      return NextResponse.json({ error: 'Failed to generate NFT' }, { status: 500 });
    }

    if (!generateResponse.ok) {
      const text = await generateResponse.text();
      console.error('[admin-send-train] generate-nft failed:', text);
      return NextResponse.json({ error: 'Failed to generate NFT' }, { status: 500 });
    }

    const generateData = await generateResponse.json();
    const { tokenURI } = generateData;

    // 6. Mint NFT to winner
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
          tokenURI,
          newHolderData: {
            username: winnerData.username,
            fid: winnerData.fid,
            displayName: winnerData.displayName,
            pfpUrl: winnerData.pfpUrl,
          },
          previousHolderData: currentHolderData || {
            username: 'unknown',
            fid: 0,
            displayName: 'Unknown',
            pfpUrl: '',
          }, // Previous holder gets the NFT ticket
          sourceCastHash: undefined, // No cast hash for admin selection
          totalEligibleReactors: 1, // Admin selected, so only 1 "eligible" user
        }),
      });
    } catch (err) {
      console.error('[admin-send-train] Failed to call mint-token:', err);
      return NextResponse.json({ error: 'Failed to mint token' }, { status: 500 });
    }

    if (!mintResponse.ok) {
      const text = await mintResponse.text();
      console.error('[admin-send-train] mint-token failed:', text);
      return NextResponse.json({ error: 'Failed to mint token' }, { status: 500 });
    }

    const mintData = await mintResponse.json();

    // 7. Notify previous holder
    try {
      if (currentHolderData) {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/internal/send-cast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET || '',
          },
          body: JSON.stringify({
            text: CHOOCHOO_CAST_TEMPLATES.TICKET_ISSUED(currentHolderData.username, mintData.actualTokenId),
          }),
        });
      }
    } catch (err) {
      console.warn('[admin-send-train] Notification cast failed (non-blocking):', err);
    }

    // 8. Return success
    const response: AdminSendTrainResponse = {
      success: true,
      winner: winnerData,
      tokenId: mintData.actualTokenId,
      txHash: mintData.txHash,
      tokenURI,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[admin-send-train] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
