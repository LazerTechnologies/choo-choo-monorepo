import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAddress, type Address } from 'viem';
import { getContractService } from '@/lib/services/contract';
import { storeTokenData, storeLastMovedTimestamp } from '@/lib/redis-token-utils';
import { createTestMetadata } from '@/lib/nft-metadata-utils';
import type { TokenData } from '@/types/nft';

// Validation schemas
const addressSchema = z.string().refine(isAddress, {
  message: 'Invalid Ethereum address',
});

const executeBodySchema = z.object({
  recipient: addressSchema,
  tokenURI: z.string().min(1, 'Token URI is required'),
});

/**
 * POST /api/test-admin-nextstop
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
    const fullTokenURI = tokenURI.startsWith('ipfs://') ? tokenURI : `ipfs://${tokenURI}`;

    const contractService = getContractService();

    // Get current total supply to calculate token ID
    const totalSupply = await contractService.getTotalSupply();
    const tokenId = totalSupply + 1;

    // Execute the transaction
    const txHash = await contractService.executeNextStop(recipient, fullTokenURI);

    // Store last moved timestamp
    try {
      await storeLastMovedTimestamp(tokenId, txHash);
      console.log(`[test-admin-nextstop] Stored last moved timestamp for token ${tokenId}`);
    } catch (err) {
      console.error('[test-admin-nextstop] Failed to store last moved timestamp:', err);
    }

    // Store comprehensive token data in Redis with mocked Farcaster data
    try {
      // Generate mock data for testing
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

      // Create proper metadata with Passenger trait
      const imageHash = fullTokenURI.replace('ipfs://', '');
      const metadata = createTestMetadata(tokenId, imageHash, selectedUsername);

      const tokenData: TokenData = {
        // Token identification
        tokenId,

        // IPFS data (mock since we don't have real image generation in admin test)
        imageHash,
        metadataHash: fullTokenURI.replace('ipfs://', ''), // This would be different in real scenario
        tokenURI: fullTokenURI,

        // Holder information (real recipient, mock Farcaster data)
        holderAddress: recipient,
        holderUsername: selectedUsername,
        holderFid: 1000 + mockIndex,
        holderDisplayName: mockDisplayNames[mockIndex],
        holderPfpUrl: `https://example.com/pfp/${mockIndex}.png`,

        // Transaction data
        transactionHash: txHash,
        timestamp: new Date().toISOString(),

        // Generation metadata (use metadata from our utility)
        attributes: metadata.attributes,

        // Source information
        sourceType: 'admin-test',
      };

      await storeTokenData(tokenData);
      console.log(
        `[test-admin-nextstop] Stored comprehensive token data in Redis for token ${tokenId}`
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
      tokenId,
      contractInfo: {
        currentSupply: totalSupply,
        nextTokenId: tokenId,
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
