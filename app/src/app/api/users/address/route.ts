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
    console.error('[users/address] Neynar API key is not configured');
    return NextResponse.json({ error: 'Neynar API key is not configured.' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const fidParam = searchParams.get('fid');

  console.log('[users/address] Request received for FID:', fidParam);

  if (!fidParam) {
    console.error('[users/address] No FID parameter provided');
    return NextResponse.json({ error: 'FID parameter is required' }, { status: 400 });
  }

  const fid = Number.parseInt(fidParam.trim());
  if (isNaN(fid) || fid <= 0) {
    console.error('[users/address] Invalid FID parameter:', fidParam);
    return NextResponse.json({ error: 'Invalid FID parameter' }, { status: 400 });
  }

  try {
    // Use Neynar Bulk API to get user data
    console.log('[users/address] Calling Neynar API for FID:', fid);
    const bulkRes = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
      headers: {
        accept: 'application/json',
        'x-api-key': NEYNAR_API_KEY,
      },
    });

    console.log('[users/address] Neynar API response status:', bulkRes.status);

    if (!bulkRes.ok) {
      if (bulkRes.status === 404) {
        console.log('[users/address] User not found in Neynar API');
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      throw new Error(`Neynar Bulk API error: ${bulkRes.statusText}`);
    }

    const bulkData: NeynarBulkUsersResponse = await bulkRes.json();
    const users = bulkData?.users || [];

    console.log('[users/address] Neynar API returned users count:', users.length);

    if (users.length === 0) {
      console.log('[users/address] No users found in Neynar response');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = users[0];
    const verifiedAddresses = user.verified_addresses;

    console.log(
      '[users/address] User verified addresses:',
      JSON.stringify(verifiedAddresses, null, 2),
    );

    if (!verifiedAddresses) {
      console.log('[users/address] User has no verified_addresses object');
      return NextResponse.json(
        { error: 'User has no verified Ethereum addresses' },
        { status: 404 },
      );
    }

    // Use primary ETH address if available, otherwise first ETH address
    const address = verifiedAddresses.primary?.eth_address || verifiedAddresses.eth_addresses?.[0];

    console.log('[users/address] Found address:', address);

    // Validate Ethereum address exists and is valid
    if (!address || !isAddress(address)) {
      console.log('[users/address] No valid Ethereum address found');
      console.log('[users/address] Primary eth_address:', verifiedAddresses.primary?.eth_address);
      console.log('[users/address] ETH addresses array:', verifiedAddresses.eth_addresses);
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

    console.log('[users/address] Returning successful response:', response);
    return NextResponse.json(response);
  } catch (error) {
    console.error('[users/address] Failed to fetch user address:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user address. Please try again.' },
      { status: 500 },
    );
  }
}
