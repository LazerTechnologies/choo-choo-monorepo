import { NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { apiLog } from '@/lib/event-log';
import type { NeynarBulkUsersResponse, UserAddressResponse } from '@/types/neynar';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

/**
 * API Route: /api/users/address
 *
 * Fetches a Farcaster user's primary verified Ethereum address.
 * Uses the Neynar Bulk API to get verified Ethereum wallet addresses only.
 *
 * Query Parameters:
 *   - fid (string, required): The Farcaster ID (FID) to fetch the address for.
 *
 * Responses:
 *   - 200: { fid: number, address: string, type: 'verification', protocol: 'ethereum' }
 *   - 400: { error: string } - Missing or invalid FID
 *   - 404: { error: string } - User not found or no verified Ethereum addresses
 *   - 500: { error: string } - API error
 */
export async function GET(request: Request) {
  if (!NEYNAR_API_KEY) {
    apiLog.error('users-address.missing_config', {
      msg: 'Neynar API key is not configured',
    });
    return NextResponse.json({ error: 'Neynar API key is not configured.' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const fidParam = searchParams.get('fid');

  apiLog.info('users-address.request', {
    fid: fidParam,
  });

  if (!fidParam) {
    apiLog.warn('users-address.missing_fid', {
      msg: 'No FID parameter provided',
    });
    return NextResponse.json({ error: 'FID parameter is required' }, { status: 400 });
  }

  const fid = Number.parseInt(fidParam.trim(), 10);
  if (Number.isNaN(fid) || fid <= 0) {
    apiLog.warn('users-address.invalid_fid', {
      fid: fidParam,
      msg: 'Invalid FID parameter',
    });
    return NextResponse.json({ error: 'Invalid FID parameter' }, { status: 400 });
  }

  try {
    // Use Neynar Bulk API to get user data
    apiLog.info('users-address.neynar_call', {
      fid,
    });
    const bulkRes = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
      headers: {
        accept: 'application/json',
        'x-api-key': NEYNAR_API_KEY,
      },
    });

    apiLog.info('users-address.neynar_response', {
      fid,
      status: bulkRes.status,
    });

    if (!bulkRes.ok) {
      if (bulkRes.status === 404) {
        apiLog.warn('users-address.not_found', {
          fid,
          msg: 'User not found in Neynar API',
        });
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      throw new Error(`Neynar Bulk API error: ${bulkRes.statusText}`);
    }

    const bulkData: NeynarBulkUsersResponse = await bulkRes.json();
    const users = bulkData?.users || [];

    apiLog.debug('users-address.neynar_response', {
      fid,
      usersCount: users.length,
    });

    if (users.length === 0) {
      apiLog.warn('users-address.not_found', {
        fid,
        msg: 'No users found in Neynar response',
      });
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = users[0];
    const verifiedAddresses = user.verified_addresses;

    apiLog.debug('users-address.neynar_response', {
      fid,
      hasVerifiedAddresses: !!verifiedAddresses,
      primaryEthAddress: verifiedAddresses?.primary?.eth_address,
      ethAddressesCount: verifiedAddresses?.eth_addresses?.length ?? 0,
    });

    if (!verifiedAddresses) {
      apiLog.warn('users-address.no_address', {
        fid,
        msg: 'User has no verified_addresses object',
      });
      return NextResponse.json(
        { error: 'User has no verified Ethereum addresses' },
        { status: 404 },
      );
    }

    // Use primary ETH address if available, otherwise first ETH address
    const address = verifiedAddresses.primary?.eth_address || verifiedAddresses.eth_addresses?.[0];

    // Validate Ethereum address exists and is valid
    if (!address || !isAddress(address)) {
      apiLog.warn('users-address.no_address', {
        fid,
        primaryEthAddress: verifiedAddresses.primary?.eth_address,
        ethAddresses: verifiedAddresses.eth_addresses,
        msg: 'No valid Ethereum address found',
      });
      return NextResponse.json(
        { error: 'User has no verified Ethereum addresses' },
        { status: 404 },
      );
    }

    const response: UserAddressResponse = {
      fid,
      address,
      type: 'verification',
      protocol: 'ethereum',
    };

    apiLog.info('users-address.success', {
      fid,
      address,
    });
    return NextResponse.json(response);
  } catch (error) {
    apiLog.error('users-address.failed', {
      fid,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Failed to fetch user address. Please try again.' },
      { status: 500 },
    );
  }
}
