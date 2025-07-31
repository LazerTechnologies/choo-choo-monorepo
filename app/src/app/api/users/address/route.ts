import { NextResponse } from 'next/server';
import { isAddress } from 'viem';
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
    return NextResponse.json({ error: 'Neynar API key is not configured.' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const fidParam = searchParams.get('fid');

  if (!fidParam) {
    return NextResponse.json({ error: 'FID parameter is required' }, { status: 400 });
  }

  const fid = parseInt(fidParam.trim());
  if (isNaN(fid) || fid <= 0) {
    return NextResponse.json({ error: 'Invalid FID parameter' }, { status: 400 });
  }

  try {
    // Use Neynar Bulk API to get user data
    const bulkRes = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
      headers: {
        accept: 'application/json',
        'x-api-key': NEYNAR_API_KEY,
      },
    });

    if (!bulkRes.ok) {
      if (bulkRes.status === 404) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      throw new Error(`Neynar Bulk API error: ${bulkRes.statusText}`);
    }

    const bulkData: NeynarBulkUsersResponse = await bulkRes.json();
    const users = bulkData?.users || [];

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = users[0];
    const verifiedAddresses = user.verified_addresses;

    if (!verifiedAddresses) {
      return NextResponse.json(
        { error: 'User has no verified Ethereum addresses' },
        { status: 404 }
      );
    }

    // Use primary ETH address if available, otherwise first ETH address
    const address = verifiedAddresses.primary?.eth_address || verifiedAddresses.eth_addresses?.[0];

    // Validate Ethereum address exists and is valid
    if (!address || !isAddress(address)) {
      return NextResponse.json(
        { error: 'User has no verified Ethereum addresses' },
        { status: 404 }
      );
    }

    const response: UserAddressResponse = {
      fid,
      address,
      type: 'verification',
      protocol: 'ethereum',
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to fetch user address:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user address. Please try again.' },
      { status: 500 }
    );
  }
}
