import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAddress, type Address } from 'viem';
import { getContractService } from '@/lib/services/contract';
import { storeTokenData, storeLastMovedTimestamp } from '@/lib/redis-token-utils';
import { createChooChooMetadata } from '@/lib/nft-metadata-utils';
import { redis } from '@/lib/kv';
import type { TokenData, CurrentHolderData, TokenURI } from '@/types/nft';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

interface WinnerData {
  username: string;
  fid: number;
  displayName: string;
  pfpUrl: string;
}

interface MintTokenRequest {
  recipient: string;
  tokenURI: string;
  tokenId: number;
  winnerData: WinnerData;
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
  recipient: addressSchema,
  tokenURI: z.string().min(1, 'Token URI is required'),
  tokenId: z.number().positive('Token ID must be positive'),
  winnerData: winnerDataSchema,
  sourceCastHash: z.string().optional(),
  totalEligibleReactors: z.number().optional(),
});

/**
 * POST /api/internal/mint-token
 * Internal endpoint for minting tokens and storing comprehensive data
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('x-internal-secret');
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

    const { recipient, tokenURI, tokenId, winnerData, sourceCastHash, totalEligibleReactors } =
      body;

    console.log(
      `[internal/mint-token] Minting token ${tokenId} for ${winnerData.username} (${recipient})`
    );

    const fullTokenURI = (
      tokenURI.startsWith('ipfs://') ? tokenURI : `ipfs://${tokenURI}`
    ) as TokenURI;

    const contractService = getContractService();

    let txHash;
    try {
      txHash = await contractService.executeNextStop(recipient as Address, fullTokenURI);
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

    let actualTokenId;
    try {
      const updatedTotalSupply = await contractService.getTotalSupply();
      actualTokenId = updatedTotalSupply;
      console.log(
        `[internal/mint-token] Actual minted token ID: ${actualTokenId} (was predicted as ${tokenId})`
      );
    } catch (err) {
      console.error(
        '[internal/mint-token] Failed to get updated total supply, using predicted token ID:',
        err
      );
      actualTokenId = tokenId; // Fallback to predicted ID
    }

    try {
      await storeLastMovedTimestamp(actualTokenId, txHash);
      console.log(`[internal/mint-token] Stored last moved timestamp for token ${actualTokenId}`);
    } catch (err) {
      console.error('[internal/mint-token] Failed to store last moved timestamp:', err);
      // Don't fail the request for this
    }

    // Store comprehensive token data in Redis (this will be called by orchestrator)
    try {
      const metadataHash = fullTokenURI.replace('ipfs://', '');

      let imageHash = '';
      let generatedAttributes: Array<{ trait_type: string; value: string | number }> = [];

      try {
        // Try to fetch the metadata to get the image hash and attributes
        const metadataUrl = `${process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud'}/ipfs/${metadataHash}`;
        const metadataResponse = await fetch(metadataUrl);
        if (metadataResponse.ok) {
          const metadata = await metadataResponse.json();
          imageHash = metadata.image?.replace('ipfs://', '') || metadataHash;
          generatedAttributes = metadata.attributes || [];
        } else {
          // Fallback: assume metadata hash is also the image hash
          imageHash = metadataHash;
        }
      } catch (err) {
        console.warn(
          '[internal/mint-token] Failed to fetch metadata for image hash, using fallback:',
          err
        );
        imageHash = metadataHash;
      }

      // Create proper metadata if we don't have attributes
      let finalAttributes = generatedAttributes;
      if (finalAttributes.length === 0) {
        const metadata = createChooChooMetadata(actualTokenId, imageHash, [], winnerData.username);
        finalAttributes = metadata.attributes!;
      }

      const tokenData: TokenData = {
        tokenId: actualTokenId,
        imageHash,
        metadataHash,
        tokenURI: fullTokenURI,
        holderAddress: recipient,
        holderUsername: winnerData.username,
        holderFid: winnerData.fid,
        holderDisplayName: winnerData.displayName,
        holderPfpUrl: winnerData.pfpUrl,
        transactionHash: txHash,
        timestamp: new Date().toISOString(),
        attributes: finalAttributes,
        sourceType: 'send-train',
        sourceCastHash,
        totalEligibleReactors,
      };

      await storeTokenData(tokenData);
      console.log(
        `[internal/mint-token] Stored comprehensive token data in Redis for token ${actualTokenId}`
      );
    } catch (err) {
      console.error(
        '[internal/mint-token] Failed to store comprehensive token data in Redis:',
        err
      );
    }

    // Store the current holder data in Redis for frontend access
    try {
      const currentHolderData: CurrentHolderData = {
        fid: winnerData.fid,
        username: winnerData.username,
        displayName: winnerData.displayName,
        pfpUrl: winnerData.pfpUrl,
        address: recipient,
        timestamp: new Date().toISOString(),
      };
      await redis.set('current-holder', JSON.stringify(currentHolderData));
      console.log(
        `[internal/mint-token] Updated current holder to: ${winnerData.username} (FID: ${winnerData.fid})`
      );
    } catch (err) {
      console.error('[internal/mint-token] Failed to store current holder in Redis:', err);
      // Don't fail the request for this
    }

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
  }
}
