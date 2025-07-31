import { NextResponse } from 'next/server';
import { isAddress } from 'viem';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

/**
 * API Route: /api/users/address
 *
 * Fetches a Farcaster user's primary wallet address (first verification address).
 * Falls back to custody_address if no verifications exist.
 *
 * Query Parameters:
 *   - fid (string, required): The Farcaster ID (FID) to fetch the address for.
 *
 * Responses:
 *   - 200: { fid: number, address: string, type: 'verification' | 'custody' }
 *   - 400: { error: string } - Missing or invalid FID
 *   - 404: { error: string } - User not found or no valid address
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
    // Fetch user data from Neynar
    const userRes = await fetch(`https://api.neynar.com/v2/farcaster/user?fid=${fid}`, {
      headers: {
        accept: 'application/json',
        api_key: NEYNAR_API_KEY,
      },
    });

    if (!userRes.ok) {
      if (userRes.status === 404) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      throw new Error(`Neynar API error: ${userRes.statusText}`);
    }

    const userData = await userRes.json();
    const user = userData?.result?.user;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get primary wallet address (verifications[0] or custody_address)
    const verifications = user?.verifications ?? [];
    const primaryWallet = verifications[0] || user?.custody_address;

    if (!primaryWallet || !isAddress(primaryWallet)) {
      return NextResponse.json({ error: 'User has no valid wallet address' }, { status: 404 });
    }

    const addressType = verifications[0] ? 'verification' : 'custody';

    return NextResponse.json({
      fid,
      address: primaryWallet,
      type: addressType,
    });
  } catch (error) {
    console.error('Failed to fetch user address:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user address. Please try again.' },
      { status: 500 }
    );
  }
}
