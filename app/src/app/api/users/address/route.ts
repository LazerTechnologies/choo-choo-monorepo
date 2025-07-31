import { NextResponse } from 'next/server';
import { isAddress } from 'viem';
import type { NeynarVerificationResponse, UserAddressResponse } from '@/types/neynar';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

/**
 * API Route: /api/users/address
 *
 * Fetches a Farcaster user's primary verified wallet address.
 * Uses the Neynar Hub API to get actual wallet verifications (not custody addresses).
 *
 * Query Parameters:
 *   - fid (string, required): The Farcaster ID (FID) to fetch the address for.
 *
 * Responses:
 *   - 200: { fid: number, address: string, type: 'verification' }
 *   - 400: { error: string } - Missing or invalid FID
 *   - 404: { error: string } - User not found or no verified addresses
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
    const verificationsRes = await fetch(
      `https://hub-api.neynar.com/v1/verificationsByFid?fid=${fid}`,
      {
        headers: {
          'x-api-key': NEYNAR_API_KEY,
        },
      }
    );

    if (!verificationsRes.ok) {
      if (verificationsRes.status === 404) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      throw new Error(`Neynar Hub API error: ${verificationsRes.statusText}`);
    }

    const verificationsData: NeynarVerificationResponse = await verificationsRes.json();
    const verifications = verificationsData?.messages || [];

    const ethAddresses = verifications
      .filter(
        (msg) =>
          msg?.data?.type === 'MESSAGE_TYPE_VERIFICATION_ADD_ETH_ADDRESS' &&
          msg?.data?.verificationAddAddressBody?.protocol === 'PROTOCOL_ETHEREUM'
      )
      .map((msg) => msg?.data?.verificationAddAddressBody?.address)
      .filter((addr) => addr && isAddress(addr));

    if (ethAddresses.length > 0) {
      const response: UserAddressResponse = {
        fid,
        address: ethAddresses[0],
        type: 'verification',
      };
      return NextResponse.json(response);
    }

    return NextResponse.json({ error: 'User has no verified wallet addresses' }, { status: 404 });
  } catch (error) {
    console.error('Failed to fetch user address:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user address. Please try again.' },
      { status: 500 }
    );
  }
}
