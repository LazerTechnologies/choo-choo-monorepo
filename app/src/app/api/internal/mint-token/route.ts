import { NextResponse } from 'next/server';
import { type Address, isAddress } from 'viem';
import { z } from 'zod';
import { apiLog } from '@/lib/event-log';
import { getTokenData, acquireLock, releaseLock } from '@/lib/redis-token-utils';
import { getContractService } from '@/lib/services/contract';
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
      },
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
    apiLog.error('mint-token.failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      msg: 'Failed to get user address',
    });
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
          { status: 400 },
        );
      }

      body = parsed.data as MintTokenRequest;
    } catch (err) {
      apiLog.error('mint-token.parse_failed', {
        error: err instanceof Error ? err.message : 'Unknown error',
        msg: 'Error parsing request body',
      });
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { newHolderAddress, tokenURI, previousHolderData } = body;

    // The NFT ticket is always minted to the previous holder (departing passenger)
    if (!previousHolderData) {
      apiLog.error('mint-token.validation_failed', {
        msg: 'No previous holder data provided - NFT tickets are only minted to departing passengers',
      });
      return NextResponse.json(
        {
          success: false,
          error:
            'Previous holder data is required - NFT tickets are only minted to departing passengers',
        },
        { status: 400 },
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
      apiLog.info('mint-token.request', {
        tokenId,
        msg: `Authoritative token ID from contract: ${tokenId}`,
      });

      // Check if this token already exists in Redis (idempotency protection)
      const existingToken = await getTokenData(tokenId);
      if (existingToken) {
        apiLog.info('mint-token.token_exists', {
          tokenId,
          msg: `Token ${tokenId} already exists, returning existing data`,
        });
        return NextResponse.json({
          success: true,
          txHash: existingToken.transactionHash,
          actualTokenId: existingToken.tokenId,
          tokenURI: existingToken.tokenURI,
        });
      }
    } catch (err) {
      apiLog.error('mint-token.failed', {
        error: err instanceof Error ? err.message : 'Unknown error',
        msg: 'Failed to get next token ID from contract',
      });
      return NextResponse.json(
        {
          success: false,
          error: `Failed to get next token ID from contract: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
        { status: 500 },
      );
    }

    apiLog.info('mint-token.request', {
      tokenId,
      nftRecipient: nftRecipient,
      nftRecipientUsername: nftRecipientData.username,
      newHolderAddress: newHolderAddress,
      msg: `Minting token ${tokenId} for ${nftRecipientData.username} (${nftRecipient})`,
    });

    const fullTokenURI = (
      tokenURI.startsWith('ipfs://') ? tokenURI : `ipfs://${tokenURI}`
    ) as TokenURI;

    let txHash;
    try {
      apiLog.info('mint-token.contract_executed', {
        tokenId,
        nftRecipient,
        newHolderAddress,
        msg: `Executing contract: NFT to ${nftRecipient}, ChooChoo to ${newHolderAddress}`,
      });
      txHash = await contractService.executeNextStop(newHolderAddress as Address, fullTokenURI);
      apiLog.info('mint-token.contract_executed', {
        tokenId,
        txHash,
        msg: `Transaction executed: ${txHash}`,
      });
    } catch (err) {
      apiLog.error('mint-token.failed', {
        tokenId,
        error: err instanceof Error ? err.message : 'Unknown error',
        msg: 'Failed to execute contract transaction',
      });
      return NextResponse.json(
        {
          success: false,
          error: `Failed to execute contract transaction: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
        { status: 500 },
      );
    }

    // The minted token ID is the tokenId we captured before the transaction
    // After minting, the contract's nextTicketId will be incremented by 1
    let actualTokenId = tokenId;

    try {
      // Briefly poll to allow on-chain state to reflect the new nextTicketId
      const retries = 3;
      for (let i = 0; i < retries; i++) {
        const postNextIdProbe = await contractService.getNextOnChainTicketId();
        if (postNextIdProbe > tokenId) {
          actualTokenId = postNextIdProbe - 1;
          break;
        }
        await new Promise((r) => setTimeout(r, 200 * (i + 1)));
      }

      const postNextId = await contractService.getNextOnChainTicketId();
      const updatedTotalTickets = await contractService.getTotalTickets();
      apiLog.info('mint-token.success', {
        tokenId: actualTokenId,
        totalTickets: updatedTotalTickets,
        msg: `Minted token ID: ${actualTokenId} (total tickets now: ${updatedTotalTickets})`,
      });

      // Verify with tolerance for eventual consistency
      if (postNextId <= actualTokenId) {
        apiLog.warn('mint-token.verification_skipped', {
          actualTokenId,
          postNextId,
          msg: `Contract nextTicketId verification: expected > ${actualTokenId}, got ${postNextId}`,
        });
      }
    } catch (err) {
      apiLog.warn('mint-token.verification_skipped', {
        error: err instanceof Error ? err.message : 'Unknown error',
        msg: 'Post-mint verification skipped (non-critical)',
      });
    }

    // Pure mint endpoint - all state management handled by orchestrator

    const response: MintTokenResponse = {
      success: true,
      txHash,
      actualTokenId,
    };

    apiLog.info('mint-token.success', {
      tokenId: actualTokenId,
      txHash,
      msg: `Successfully minted token ${actualTokenId}`,
    });
    return NextResponse.json(response);
  } catch (error) {
    apiLog.error('mint-token.failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      msg: 'Error',
    });
    return NextResponse.json(
      {
        success: false,
        error: '😞 Failed to mint token',
      },
      { status: 500 },
    );
  } finally {
    // Release mint lock if acquired
    if (mintedLockKey) {
      try {
        await releaseLock(mintedLockKey);
      } catch (err) {
        apiLog.warn('mint-token.failed', {
          error: err instanceof Error ? err.message : 'Unknown error',
          msg: 'Failed to release mint lock',
        });
      }
    }
  }
}
