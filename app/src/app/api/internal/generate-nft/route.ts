import { NextResponse } from 'next/server';
import {
  composeImage,
  uploadImageToPinata,
  uploadMetadataToPinata,
  collectionName,
} from 'generator';
import { createChooChooMetadata } from '@/lib/nft-metadata-utils';
import type { NFTMetadata } from '@/types/nft';
import { getOrSetPendingGeneration } from '@/lib/redis-token-utils';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

interface GenerateNFTRequest {
  tokenId: number;
  passengerUsername: string;
}

interface GenerateNFTResponse {
  success: boolean;
  imageHash: string;
  metadataHash: string;
  tokenURI: string;
  metadata: NFTMetadata;
  error?: string;
}

/**
 * POST /api/internal/generate-nft
 * Internal endpoint for generating NFT images and uploading to IPFS
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('x-internal-secret');
    if (!INTERNAL_SECRET || authHeader !== INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: GenerateNFTRequest;
    try {
      body = await request.json();
    } catch (err) {
      console.error('[internal/generate-nft] Error parsing request body:', err);
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { tokenId, passengerUsername } = body;
    if (!tokenId || typeof tokenId !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid tokenId' },
        { status: 400 },
      );
    }
    if (!passengerUsername || typeof passengerUsername !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid passengerUsername' },
        { status: 400 },
      );
    }

    console.log(
      `[internal/generate-nft] Resolving NFT for token ${tokenId}, passenger: ${passengerUsername}`,
    );

    // Use pending cache to dedupe generation per tokenId
    const pending = await getOrSetPendingGeneration(tokenId, async () => {
      // 1. Generate unique NFT image
      let imageBuffer, attributes;
      try {
        const result = await composeImage();
        imageBuffer = result.imageBuffer;
        attributes = result.attributes;
        console.log('[internal/generate-nft] Generated image with attributes:', attributes);
      } catch (err) {
        console.error('[internal/generate-nft] Failed to compose NFT image:', err);
        throw new Error(
          `Failed to compose NFT image: ${err instanceof Error ? err.message : 'Unknown error'}`,
        );
      }

      // 2. Upload image to Pinata
      let imageHash: string;
      try {
        const sanitizedFilename = `${collectionName}-${tokenId}-img.png`;
        imageHash = await uploadImageToPinata(imageBuffer, sanitizedFilename);
        console.log('[internal/generate-nft] Uploaded image to Pinata:', imageHash);
      } catch (err) {
        console.error('[internal/generate-nft] Failed to upload image to Pinata:', err);
        throw new Error(
          `Failed to upload image to Pinata: ${err instanceof Error ? err.message : 'Unknown error'}`,
        );
      }

      // 3. Upload metadata to Pinata
      let metadataHash: string;
      try {
        metadataHash = await uploadMetadataToPinata(
          tokenId,
          imageHash,
          attributes,
          passengerUsername,
        );
        console.log('[internal/generate-nft] Uploaded metadata to Pinata:', metadataHash);
      } catch (err) {
        console.error('[internal/generate-nft] Failed to upload metadata to Pinata:', err);
        throw new Error(
          `Failed to upload metadata to Pinata: ${err instanceof Error ? err.message : 'Unknown error'}`,
        );
      }

      return {
        imageHash,
        metadataHash,
        tokenURI: `ipfs://${metadataHash}`,
        attributes,
        passengerUsername,
      };
    });

    const metadata = createChooChooMetadata(
      tokenId,
      pending.imageHash,
      pending.attributes,
      passengerUsername,
    );

    const response: GenerateNFTResponse = {
      success: true,
      imageHash: pending.imageHash,
      metadataHash: pending.metadataHash,
      tokenURI: pending.tokenURI,
      metadata,
    };

    console.log(`[internal/generate-nft] Returning NFT payload for token ${tokenId}`);
    return NextResponse.json(response);
  } catch (error) {
    console.error('[internal/generate-nft] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate NFT',
      },
      { status: 500 },
    );
  }
}
