import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAddress } from 'viem';
import { redis } from '@/lib/kv';
import { getContractService } from '@/lib/services/contract';
import { ADMIN_FIDS } from '@/lib/constants';

import type { CurrentHolderData } from '@/types/nft';
import type { NeynarBulkUsersResponse } from '@/types/neynar';
import { CHOOCHOO_CAST_TEMPLATES, CHOOCHOO_TRAIN_METADATA_URI } from '@/lib/constants';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

// Admin FIDs (same as in useAdminAccess hook)

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

    // Check Redis to see if current holder exists
    try {
      const existingHolderData = await redis.get('current-holder');

      if (existingHolderData) {
        const existingHolder = JSON.parse(existingHolderData);
        console.log(
          `[admin-set-initial-holder] Current holder already exists: ${existingHolder.username} (FID: ${existingHolder.fid})`
        );
        return NextResponse.json(
          {
            error:
              'Cannot set initial holder: A current holder already exists. This function is only for fresh deployments.',
          },
          { status: 400 }
        );
      }

      console.log('[admin-set-initial-holder] Redis check: No current holder found, proceeding');
    } catch (redisError) {
      console.error('[admin-set-initial-holder] Redis check failed:', redisError);
      return NextResponse.json(
        { error: 'Failed to check holder status. Please try again later.' },
        { status: 500 }
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
    try {
      const { redisPub, CURRENT_HOLDER_CHANNEL } = await import('@/lib/kv');
      await redisPub.publish(CURRENT_HOLDER_CHANNEL, JSON.stringify({ type: 'holder-updated' }));
    } catch {}

    console.log(
      `[admin-set-initial-holder] Successfully set initial current holder: ${targetUser.username} (FID: ${targetUser.fid})`
    );

    // Set the main token URI for the train (tokenId 0) on the contract
    if (!CHOOCHOO_TRAIN_METADATA_URI) {
      console.error(
        '[admin-set-initial-holder] CHOOCHOO_TRAIN_METADATA_URI environment variable is required but not configured'
      );
      return NextResponse.json(
        {
          error:
            'CHOOCHOO_TRAIN_METADATA_URI environment variable is required. Please configure it and try again.',
        },
        { status: 500 }
      );
    }

    try {
      const contractService = getContractService();
      const setMainTokenURITx = await contractService.setMainTokenURI(CHOOCHOO_TRAIN_METADATA_URI);
      console.log(
        `[admin-set-initial-holder] Successfully set main token URI: ${setMainTokenURITx}`
      );
    } catch (err) {
      console.error('[admin-set-initial-holder] Failed to set main token URI:', err);
      return NextResponse.json(
        {
          error:
            'Failed to set main token URI on contract. Please check the contract service and try again.',
        },
        { status: 500 }
      );
    }

    // Send journey begins announcement cast from ChooChoo account
    try {
      const journeyBeginsCastText = CHOOCHOO_CAST_TEMPLATES.JOURNEY_BEGINS(targetUser.username);

      const castResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/internal/send-cast`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET || '',
          },
          body: JSON.stringify({
            text: journeyBeginsCastText,
            // channel_id: 'base', // @note: if we want to add a channel to the cast
          }),
        }
      );

      if (castResponse.ok) {
        const castData = await castResponse.json();
        console.log(
          `[admin-set-initial-holder] Successfully sent journey begins cast: ${castData.cast?.hash}`
        );
      } else {
        const castErrorData = await castResponse.json();
        console.warn(
          '[admin-set-initial-holder] Failed to send journey begins cast (non-critical):',
          castErrorData.error
        );
      }
    } catch (err) {
      console.warn(
        '[admin-set-initial-holder] Failed to send journey begins cast (non-critical):',
        err
      );
      // Don't fail the request for cast sending issues
    }

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
