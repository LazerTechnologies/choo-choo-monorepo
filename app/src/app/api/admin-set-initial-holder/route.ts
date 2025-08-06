import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAddress } from 'viem';
import { redis } from '@/lib/kv';
import { getContractService } from '@/lib/services/contract';
import type { CurrentHolderData } from '@/types/nft';
import type { NeynarBulkUsersResponse } from '@/types/neynar';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

// Admin FIDs (same as in useAdminAccess hook)
const ADMIN_FIDS = [377557, 2802, 243300];

// Validation schema
const setInitialHolderBodySchema = z.object({
  targetFid: z.number().positive('Target FID must be positive'),
  adminFid: z.number().positive('Admin FID must be positive'),
});

interface SetInitialHolderRequest {
  targetFid: number;
  adminFid: number;
}

interface SetInitialHolderResponse {
  success: boolean;
  holder?: {
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
    address: string;
    timestamp: string;
  };
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
    console.error('[admin-set-initial-holder] Failed to fetch user data:', error);
    throw error;
  }
}

/**
 * POST /api/admin-set-initial-holder
 *
 * Sets the initial current holder in Redis for fresh mainnet deployment.
 * Only accessible by admin FIDs and only if no tokens have been minted yet.
 */
export async function POST(request: Request) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = setInitialHolderBodySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { targetFid, adminFid }: SetInitialHolderRequest = validationResult.data;

    // Validate admin access
    if (!ADMIN_FIDS.includes(adminFid)) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    console.log(
      `[admin-set-initial-holder] Admin ${adminFid} attempting to set initial holder to FID ${targetFid}`
    );

    // Check contract total supply to prevent accidental usage after tokens are minted
    try {
      const contractService = getContractService();
      const totalSupply = await contractService.getTotalSupply();

      console.log(`[admin-set-initial-holder] Current contract total supply: ${totalSupply}`);

      // If total supply > 1, it means tokens other than tokenId 0 have been minted
      if (totalSupply > 1) {
        return NextResponse.json(
          {
            error: `Cannot set initial holder: ${totalSupply - 1} journey ticket(s) have already been minted. This function is only for fresh deployments.`,
          },
          { status: 400 }
        );
      }
    } catch (contractError) {
      console.error(
        '[admin-set-initial-holder] Failed to check contract total supply:',
        contractError
      );
      return NextResponse.json(
        { error: 'Failed to check contract state. Please try again.' },
        { status: 500 }
      );
    }

    // Check if there's already a current holder
    try {
      const existingHolderData = await redis.get('current-holder');
      if (existingHolderData) {
        const existingHolder = JSON.parse(existingHolderData);
        console.log(
          `[admin-set-initial-holder] Warning: Overwriting existing current holder: ${existingHolder.username} (FID: ${existingHolder.fid})`
        );
      }
    } catch (error) {
      console.error('[admin-set-initial-holder] Error checking existing current holder:', error);
      console.log(
        '[admin-set-initial-holder] No existing current holder found, proceeding with initial setup'
      );
    }

    // Fetch target user data from Neynar
    const targetUser = await fetchUserByFid(targetFid);
    if (!targetUser) {
      return NextResponse.json({ error: `User with FID ${targetFid} not found` }, { status: 404 });
    }

    console.log(
      `[admin-set-initial-holder] Target user found: ${targetUser.username} (${targetUser.address})`
    );

    // Create the current holder data structure
    const currentHolderData: CurrentHolderData = {
      fid: targetUser.fid,
      username: targetUser.username,
      displayName: targetUser.displayName,
      pfpUrl: targetUser.pfpUrl,
      address: targetUser.address,
      timestamp: new Date().toISOString(),
    };

    // Store in Redis using the same key as the rest of the system
    await redis.set('current-holder', JSON.stringify(currentHolderData));

    console.log(
      `[admin-set-initial-holder] Successfully set initial current holder: ${targetUser.username} (FID: ${targetUser.fid})`
    );

    const response: SetInitialHolderResponse = {
      success: true,
      holder: {
        fid: currentHolderData.fid,
        username: currentHolderData.username,
        displayName: currentHolderData.displayName,
        pfpUrl: currentHolderData.pfpUrl,
        address: currentHolderData.address,
        timestamp: currentHolderData.timestamp,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[admin-set-initial-holder] Error:', error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Failed to set initial holder' }, { status: 500 });
  }
}
