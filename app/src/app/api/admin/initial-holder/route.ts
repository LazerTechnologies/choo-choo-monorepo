import { NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/require-admin';
import { APP_URL, CHOOCHOO_CAST_TEMPLATES } from '@/lib/constants';
import { redis } from '@/lib/kv';
import { DEFAULT_WORKFLOW_DATA } from '@/lib/workflow-types';
import type { NeynarBulkUsersResponse } from '@/types/neynar';
import type { CurrentHolderData } from '@/types/nft';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

// Validation schema
const setInitialHolderBodySchema = z.object({
  targetFid: z.number().positive('Target FID must be positive'),
});

interface SetInitialHolderRequest {
  targetFid: number;
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
 * POST /api/admin/initial-holder
 *
 * Sets the initial current holder in Redis for fresh mainnet deployment.
 * Only accessible by admin FIDs and only if no tokens have been minted yet.
 */
export async function POST(request: Request) {
  try {
    // Admin auth
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = setInitialHolderBodySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validationResult.error.issues,
        },
        { status: 400 },
      );
    }

    const { targetFid }: SetInitialHolderRequest = validationResult.data;

    console.log(
      `[admin-set-initial-holder] Admin ${auth.adminFid} attempting to set initial holder to FID ${targetFid}`,
    );

    // Check Redis to see if current holder exists
    try {
      const existingHolderData = await redis.get('current-holder');

      if (existingHolderData) {
        const existingHolder = JSON.parse(existingHolderData);
        console.log(
          `[admin-set-initial-holder] Current holder already exists: ${existingHolder.username} (FID: ${existingHolder.fid})`,
        );
        return NextResponse.json(
          {
            error:
              'Cannot set initial holder: A current holder already exists. This function is only for fresh deployments.',
          },
          { status: 400 },
        );
      }

      console.log('[admin-set-initial-holder] Redis check: No current holder found, proceeding');
    } catch (redisError) {
      console.error('[admin-set-initial-holder] Redis check failed:', redisError);
      return NextResponse.json(
        { error: 'Failed to check holder status. Please try again later.' },
        { status: 500 },
      );
    }

    // Fetch target user data from Neynar
    const targetUser = await fetchUserByFid(targetFid);
    if (!targetUser) {
      return NextResponse.json({ error: `User with FID ${targetFid} not found` }, { status: 404 });
    }

    console.log(
      `[admin-set-initial-holder] Target user found: ${targetUser.username} (${targetUser.address})`,
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

    // Store current holder and initial workflow state in Redis
    try {
      await redis.set('current-holder', JSON.stringify(currentHolderData));
      console.log('[admin-set-initial-holder] Successfully stored current holder data');

      // Set initial workflow state to NOT_CASTED for fresh deployment
      const workflowDataJson = JSON.stringify(DEFAULT_WORKFLOW_DATA);
      console.log('[admin-set-initial-holder] Setting workflow state:', workflowDataJson);

      await redis.set('workflowState', workflowDataJson);
      console.log('[admin-set-initial-holder] Successfully stored workflow state');

      // Verify the data was stored correctly
      const storedWorkflowState = await redis.get('workflowState');
      console.log(
        '[admin-set-initial-holder] Verified stored workflow state:',
        storedWorkflowState,
      );

      if (storedWorkflowState !== workflowDataJson) {
        console.error('[admin-set-initial-holder] Workflow state verification failed!');
        console.error('Expected:', workflowDataJson);
        console.error('Actual:', storedWorkflowState);
        throw new Error('Workflow state storage verification failed');
      }
    } catch (redisStoreError) {
      console.error('[admin-set-initial-holder] Failed to store data in Redis:', redisStoreError);
      return NextResponse.json(
        { error: 'Failed to store initial holder data. Please try again later.' },
        { status: 500 },
      );
    }

    try {
      const { redisPub, CURRENT_HOLDER_CHANNEL } = await import('@/lib/kv');
      await redisPub.publish(CURRENT_HOLDER_CHANNEL, JSON.stringify({ type: 'holder-updated' }));
    } catch {}

    console.log(
      `[admin-set-initial-holder] Successfully set initial current holder: ${targetUser.username} (FID: ${targetUser.fid})`,
    );
    console.log('[admin-set-initial-holder] Set initial workflow state to NOT_CASTED');

    // Metadata for token 0 is set manually, skipping automatic metadata update

    try {
      const journeyBeginsCastText = CHOOCHOO_CAST_TEMPLATES.JOURNEY_BEGINS(targetUser.username);
      await fetch(`${APP_URL}/api/internal/send-cast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': INTERNAL_SECRET || '',
        },
        body: JSON.stringify({
          text: journeyBeginsCastText,
          embeds: [{ url: APP_URL }],
        }),
      });
    } catch (err) {
      console.warn(
        '[admin-set-initial-holder] Failed to send journey begins cast (non-critical):',
        err,
      );
    }

    return NextResponse.json({
      success: true,
      holder: currentHolderData,
    } as SetInitialHolderResponse);
  } catch (error) {
    console.error('[admin-set-initial-holder] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
