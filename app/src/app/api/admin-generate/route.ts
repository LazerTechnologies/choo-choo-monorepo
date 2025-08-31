import { NextResponse } from 'next/server';
import { redis } from '@/lib/kv';
import {
  composeImage,
  uploadImageToPinata,
  uploadMetadataToPinata,
  collectionName,
} from 'generator';
import { getContractService } from '@/lib/services/contract';
import { requireAdmin } from '@/lib/auth/require-admin';
import type { PinataUploadResult, TokenURI } from '@/types/nft';

export async function POST(request: Request) {
  try {
    // Admin auth
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    console.log(`[admin-generate] Admin ${auth.adminFid} generating test NFT`);

    // Get the next token ID from contract
    let testTokenId;
    try {
      const contractService = getContractService();
      testTokenId = await contractService.getNextOnChainTicketId();
    } catch (err) {
      console.error('[admin-generate] Failed to get next token ID from contract, using fallback:', err);
      testTokenId = 1; // Fallback to token 1
    }

    console.log('[admin-generate] Generating NFT image using generator package...');

    // 1. Generate the unique NFT image and attributes using the generator
    let imageBuffer, attributes;
    try {
      const result = await composeImage();
      imageBuffer = result.imageBuffer;
      attributes = result.attributes;
      console.log('[admin-generate] Successfully generated image with attributes:', attributes);
    } catch (err) {
      console.error('[admin-generate] Failed to compose NFT image:', err);
      throw new Error(
        `Failed to compose NFT image: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }

    // 2. Upload the image to Pinata using generator functions
    let imageHash;
    try {
      imageHash = await uploadImageToPinata(
        imageBuffer,
        `${collectionName}-Admin-${testTokenId}.png`
      );
      console.log('[admin-generate] Successfully uploaded image to Pinata:', imageHash);
    } catch (err) {
      console.error('[admin-generate] Failed to upload image to Pinata:', err);
      throw new Error(
        `Failed to upload image to Pinata: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }

    // 3. Upload the metadata to Pinata using generator functions
    let metadataHash;
    try {
      metadataHash = await uploadMetadataToPinata(testTokenId, imageHash, attributes);
      console.log('[admin-generate] Successfully uploaded metadata to Pinata:', metadataHash);
    } catch (err) {
      console.error('[admin-generate] Failed to upload metadata to Pinata:', err);
      throw new Error(
        `Failed to upload metadata to Pinata: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }

    // 4. Create URLs and token URI
    const pinataGateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud';
    const imageUrl = `${pinataGateway}/ipfs/${imageHash}`;
    const metadataUrl = `${pinataGateway}/ipfs/${metadataHash}`;
    const tokenURI = `ipfs://${metadataHash}` as TokenURI;

    // 5. Create the complete metadata object (for display purposes)
    const completeMetadata = {
      name: `${collectionName} #${testTokenId}`,
      description: `Admin generated NFT from ${collectionName}`,
      image: `ipfs://${imageHash}`,
      attributes,
    };

    // 6. Store the IPFS hashes and URLs in Redis
    await redis.set('admin-generate-image-hash', imageHash);
    await redis.set('admin-generate-image-url', imageUrl);
    await redis.set('admin-generate-metadata-hash', metadataHash);
    await redis.set('admin-generate-metadata-url', metadataUrl);
    await redis.set('admin-generate-token-uri', tokenURI);

    const result: PinataUploadResult = {
      imageHash,
      imageUrl,
      metadataHash,
      metadataUrl,
      tokenURI,
      metadata: completeMetadata,
    };

    console.log(`[admin-generate] Admin ${auth.adminFid} completed NFT generation successfully`);

    return NextResponse.json({
      success: true,
      ...result,
      message: 'Generated NFT image and metadata uploaded to Pinata using generator package',
    });
  } catch (error) {
    console.error('[admin-generate] Error in admin NFT generation:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate NFT',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
