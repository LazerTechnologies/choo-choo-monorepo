// @todo: can remove thid file when we go to production
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAddress, type Address } from 'viem';
import { getContractService } from '@/lib/services/contract';
import { storeTokenData, storeLastMovedTimestamp } from '@/lib/redis-token-utils';
import { createTestMetadata } from '@/lib/nft-metadata-utils';
import type { TokenData, TokenURI } from '@/types/nft';

// Validation schemas
const addressSchema = z.string().refine(isAddress, {
  message: 'Invalid Ethereum address',
});

const executeBodySchema = z.object({
  recipient: addressSchema,
  tokenURI: z.string().min(1, 'Token URI is required'),
});

/**
 * POST /api/admin/nextstop
 * Test endpoint for admin to manually execute nextStop function
 * WARNING: This is for testing purposes only - remove in production
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = executeBodySchema.safeParse(body);

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

    const { recipient, tokenURI } = parsed.data as { recipient: Address; tokenURI: string };

    // Add IPFS prefix if not present
    const fullTokenURI = (
      tokenURI.startsWith('ipfs://') ? tokenURI : `ipfs://${tokenURI}`
    ) as TokenURI;

    const contractService = getContractService();

    // Get next token ID from contract
    const tokenId = await contractService.getNextOnChainTicketId();

    // Execute the transaction
    const txHash = await contractService.executeNextStop(recipient, fullTokenURI);

    // The actual token ID is the one we got from the contract before minting
    const actualTokenId = tokenId;

    try {
      const updatedTotalTickets = await contractService.getTotalTickets();
      console.log(
        `[test-admin-nextstop] Minted token ID: ${actualTokenId} (total tickets now: ${updatedTotalTickets})`
      );

      if (updatedTotalTickets !== tokenId) {
        console.warn(
          `[test-admin-nextstop] Warning: Total tickets (${updatedTotalTickets}) doesn't match expected token ID (${tokenId})`
        );
      }
    } catch (err) {
      console.error(
        '[test-admin-nextstop] Failed to get updated total tickets (non-critical):',
        err
      );
    }

    // Store last moved timestamp
    try {
      await storeLastMovedTimestamp(actualTokenId, txHash);
      console.log(`[test-admin-nextstop] Stored last moved timestamp for token ${actualTokenId}`);
    } catch (err) {
      console.error('[test-admin-nextstop] Failed to store last moved timestamp:', err);
    }

    // Store comprehensive token data in Redis with real data (except Farcaster data)
    try {
      // Extract real IPFS hashes from the provided tokenURI
      const metadataHash = fullTokenURI.replace('ipfs://', '');

      // For admin test, we need to get the image hash from the metadata
      // In production, this would come from the generation process
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
          '[test-admin-nextstop] Failed to fetch metadata for image hash, using fallback:',
          err
        );
        imageHash = metadataHash;
      }

      // Generate mock Farcaster data (only part that's mocked)
      const mockUsernames = ['alice.test', 'bob.crypto', 'charlie.eth', 'diana.base', 'eve.web3'];
      const mockDisplayNames = [
        'Alice Tester',
        'Bob Crypto',
        'Charlie Ethereum',
        'Diana Base',
        'Eve Web3',
      ];
      const mockIndex = Math.floor(Math.random() * mockUsernames.length);
      const selectedUsername = mockUsernames[mockIndex];

      // Create proper metadata with Passenger trait using real tokenId
      const metadata = createTestMetadata(actualTokenId, imageHash, selectedUsername);

      const tokenData: TokenData = {
        // Token identification (REAL)
        tokenId: actualTokenId,

        // IPFS data (REAL)
        imageHash,
        metadataHash,
        tokenURI: fullTokenURI,

        // Holder information (REAL recipient address, MOCK Farcaster data)
        holderAddress: recipient,
        holderUsername: selectedUsername, // MOCK
        holderFid: 1000 + mockIndex, // MOCK
        holderDisplayName: mockDisplayNames[mockIndex], // MOCK
        holderPfpUrl: `https://example.com/pfp/${mockIndex}.png`, // MOCK

        // Transaction data (REAL)
        transactionHash: txHash,
        timestamp: new Date().toISOString(),

        // Generation metadata (REAL from metadata or mock for test)
        attributes: generatedAttributes.length > 0 ? generatedAttributes : metadata.attributes,

        // Source information (REAL)
        sourceType: 'admin-test',
      };

      await storeTokenData(tokenData);
      console.log(
        `[test-admin-nextstop] Stored comprehensive token data in Redis for token ${actualTokenId}`
      );
    } catch (err) {
      console.error(
        '[test-admin-nextstop] Failed to store comprehensive token data in Redis:',
        err
      );
      // Don't fail the request for Redis storage issues, just log the error
    }

    return NextResponse.json({
      success: true,
      txHash,
      recipient,
      tokenURI: fullTokenURI,
      tokenId: actualTokenId,
      contractInfo: {
        nextTokenId: actualTokenId,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Admin nextStop test error:', error);

    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
