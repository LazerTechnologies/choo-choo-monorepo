import { NextResponse } from 'next/server';
import {
  composeImage,
  uploadImageToPinata,
  uploadMetadataToPinata,
  collectionName,
} from 'generator';
import { createChooChooMetadata } from '@/lib/nft-metadata-utils';
import type { NFTMetadata } from '@/types/nft';

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
        { status: 400 }
      );
    }
    if (!passengerUsername || typeof passengerUsername !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid passengerUsername' },
        { status: 400 }
      );
    }

    console.log(
      `[internal/generate-nft] Generating NFT for token ${tokenId}, passenger: ${passengerUsername}`
    );

    // 1. Generate the unique NFT image and attributes using the generator
    let imageBuffer, attributes;
    try {
      const result = await composeImage();
      imageBuffer = result.imageBuffer;
      attributes = result.attributes;
      console.log(
        '[internal/generate-nft] Successfully generated image with attributes:',
        attributes
      );
    } catch (err) {
      console.error('[internal/generate-nft] Failed to compose NFT image:', err);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to compose NFT image: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
        { status: 500 }
      );
    }

    // 2. Upload the image to Pinata via generator package
    let imageHash;
    try {
      imageHash = await uploadImageToPinata(imageBuffer, `${collectionName} #${tokenId}.png`);
      console.log('[internal/generate-nft] Successfully uploaded image to Pinata:', imageHash);
    } catch (err) {
      console.error('[internal/generate-nft] Failed to upload image to Pinata:', err);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to upload image to Pinata: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
        { status: 500 }
      );
    }

    // 3. Upload the metadata to Pinata via generator package
    let metadataHash;
    try {
      metadataHash = await uploadMetadataToPinata(
        tokenId,
        imageHash,
        attributes,
        passengerUsername
      );
      console.log(
        '[internal/generate-nft] Successfully uploaded metadata to Pinata:',
        metadataHash
      );
    } catch (err) {
      console.error('[internal/generate-nft] Failed to upload metadata to Pinata:', err);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to upload metadata to Pinata: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
        { status: 500 }
      );
    }

    // 4. Create URLs and token URI
    const tokenURI = `ipfs://${metadataHash}`;

    // 5. Create the standardized metadata object using the utility function
    const metadata = createChooChooMetadata(tokenId, imageHash, attributes, passengerUsername);

    const response: GenerateNFTResponse = {
      success: true,
      imageHash,
      metadataHash,
      tokenURI,
      metadata,
    };

    console.log(`[internal/generate-nft] Successfully generated NFT for token ${tokenId}`);
    return NextResponse.json(response);
  } catch (error) {
    console.error('[internal/generate-nft] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate NFT',
      },
      { status: 500 }
    );
  }
}
