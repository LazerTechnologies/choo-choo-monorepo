import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAddress, type Address } from 'viem';
import { getContractService } from '@/lib/services/contract';
import { getTokenData, acquireLock, releaseLock } from '@/lib/redis-token-utils';
import type { TokenURI } from '@/types/nft';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

// Helper function to get user's primary wallet address
async function getRecipientAddress(userData: WinnerData): Promise<string> {
  if (!NEYNAR_API_KEY) {
    throw new Error('Neynar API key not configured');
  }

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${userData.fid}`,
      {
        headers: {
          accept: 'application/json',
          'x-api-key': NEYNAR_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Neynar API error: ${response.statusText}`);
    }

    const data = await response.json();
    const user = data?.users?.[0];

    if (!user?.verified_addresses) {
      throw new Error('User has no verified addresses');
    }

    const address =
      user.verified_addresses.primary?.eth_address || user.verified_addresses.eth_addresses?.[0];

    if (!address || !isAddress(address)) {
      throw new Error('User has no valid Ethereum address');
    }

    return address;
  } catch (error) {
    console.error('[mint-token] Failed to get user address:', error);
    throw error;
  }
}

interface WinnerData {
  username: string;
  fid: number;
  displayName: string;
  pfpUrl: string;
}

interface MintTokenRequest {
  newHolderAddress: string;
  tokenURI: string;
  newHolderData: WinnerData;
  previousHolderData: WinnerData; // The person who gets the NFT (departing passenger)
  sourceCastHash?: string;
  totalEligibleReactors?: number;
}

interface MintTokenResponse {
  success: boolean;
  txHash: string;
  actualTokenId: number;
  error?: string;
}

// Validation schemas
const addressSchema = z.string().refine(isAddress, {
  message: 'Invalid Ethereum address',
});

const winnerDataSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  fid: z.number().positive('FID must be positive'),
  displayName: z.string(),
  pfpUrl: z.string(),
});

const mintTokenBodySchema = z.object({
  newHolderAddress: addressSchema,
  tokenURI: z.string().min(1, 'Token URI is required'),
  newHolderData: winnerDataSchema,
  previousHolderData: winnerDataSchema, // Required - NFT tickets always go to departing passengers
  sourceCastHash: z.string().optional(),
  totalEligibleReactors: z.number().optional(),
});

/**
 * POST /api/internal/mint-token
 * Pure minting endpoint - only executes transaction and returns result
 * All Redis writes and state management handled by orchestrator
 */
export async function POST(request: Request) {
  let mintedLockKey = '';

  try {
    const authHeader = request.headers.get('x-internal-secret');
    // Accept x-no-redis-write for compatibility but ignore it - this endpoint never writes Redis
    if (!INTERNAL_SECRET || authHeader !== INTERNAL_SECRET) {
      return NextResponse.json({ error: '🔒 Unauthorized' }, { status: 401 });
    }

    let body: MintTokenRequest;
    try {
      const rawBody = await request.json();
      const parsed = mintTokenBodySchema.safeParse(rawBody);

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

      body = parsed.data as MintTokenRequest;
    } catch (err) {
      console.error('[internal/mint-token] Error parsing request body:', err);
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { newHolderAddress, tokenURI, previousHolderData } = body;

    // The NFT ticket is always minted to the previous holder (departing passenger)
    if (!previousHolderData) {
      console.error(
        '[internal/mint-token] No previous holder data provided - NFT tickets are only minted to departing passengers'
      );
      return NextResponse.json(
        {
          success: false,
          error:
            'Previous holder data is required - NFT tickets are only minted to departing passengers',
        },
        { status: 400 }
      );
    }

    const nftRecipient = await getRecipientAddress(previousHolderData);
    const nftRecipientData = previousHolderData;

    const contractService = getContractService();

    try {
      const preNextId = await contractService.getNextOnChainTicketId();
      mintedLockKey = `lock:mint:${preNextId}`;
      const locked = await acquireLock(mintedLockKey, 30_000);
      if (!locked) {
        return NextResponse.json({ success: false, error: 'Mint in progress' }, { status: 409 });
      }
    } catch {}

    // Get the authoritative token ID from the contract (source of truth)
    let tokenId: number;
    try {
      tokenId = await contractService.getNextOnChainTicketId();
      console.log(`[internal/mint-token] Authoritative token ID from contract: ${tokenId}`);

      // Check if this token already exists in Redis (idempotency protection)
      const existingToken = await getTokenData(tokenId);
      if (existingToken) {
        console.log(
          `[internal/mint-token] Token ${tokenId} already exists, returning existing data`
        );
        return NextResponse.json({
          success: true,
          txHash: existingToken.transactionHash,
          actualTokenId: existingToken.tokenId,
          tokenURI: existingToken.tokenURI,
        });
      }
    } catch (err) {
      console.error('[internal/mint-token] Failed to get next token ID from contract:', err);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to get next token ID from contract: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
        { status: 500 }
      );
    }

    console.log(
      `[internal/mint-token] Minting token ${tokenId} for ${nftRecipientData.username} (${nftRecipient})`
    );

    const fullTokenURI = (
      tokenURI.startsWith('ipfs://') ? tokenURI : `ipfs://${tokenURI}`
    ) as TokenURI;

    let txHash;
    try {
      console.log(
        `[internal/mint-token] Executing contract: NFT to ${nftRecipient}, ChooChoo to ${newHolderAddress}`
      );
      txHash = await contractService.executeNextStop(newHolderAddress as Address, fullTokenURI);
      console.log(`[internal/mint-token] Transaction executed: ${txHash}`);
    } catch (err) {
      console.error('[internal/mint-token] Failed to execute contract transaction:', err);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to execute contract transaction: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
        { status: 500 }
      );
    }

    let actualTokenId = tokenId;
    try {
      const postNextId = await contractService.getNextOnChainTicketId();
      actualTokenId = postNextId - 1;
      const updatedTotalTickets = await contractService.getTotalTickets();
      console.log(
        `[internal/mint-token] Minted token ID: ${actualTokenId} (total tickets now: ${updatedTotalTickets})`
      );
    } catch (err) {
      console.error(
        '[internal/mint-token] Failed to compute actual minted token ID (non-critical):',
        err
      );
    }

    // Pure mint endpoint - all state management handled by orchestrator

    const response: MintTokenResponse = {
      success: true,
      txHash,
      actualTokenId,
    };

    console.log(`[internal/mint-token] Successfully minted token ${actualTokenId}`);
    return NextResponse.json(response);
  } catch (error) {
    console.error('[internal/mint-token] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '😞 Failed to mint token',
      },
      { status: 500 }
    );
  } finally {
    // Release mint lock if acquired
    if (mintedLockKey) {
      try {
        await releaseLock(mintedLockKey);
      } catch (err) {
        console.warn('[internal/mint-token] Failed to release mint lock:', err);
      }
    }
  }
}
