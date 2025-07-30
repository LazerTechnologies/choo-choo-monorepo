import { NextResponse } from 'next/server';
import { redis } from '@/lib/kv';
import {
  composeImage,
  uploadImageToPinata,
  uploadMetadataToPinata,
  collectionName,
} from 'generator';
import type { PinataUploadResult } from '@/types/nft';

export async function POST() {
  try {
    // Use a test token ID
    const testTokenId = 999;

    console.log('[test-pinata] Generating NFT image using generator package...');

    // 1. Generate the unique NFT image and attributes using the generator
    let imageBuffer, attributes;
    try {
      const result = await composeImage();
      imageBuffer = result.imageBuffer;
      attributes = result.attributes;
      console.log('[test-pinata] Successfully generated image with attributes:', attributes);
    } catch (err) {
      console.error('[test-pinata] Failed to compose NFT image:', err);
      throw new Error(
        `Failed to compose NFT image: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }

    // 2. Upload the image to Pinata using generator functions
    let imageHash;
    try {
      imageHash = await uploadImageToPinata(
        imageBuffer,
        `${collectionName}-Test-${testTokenId}.png`
      );
      console.log('[test-pinata] Successfully uploaded image to Pinata:', imageHash);
    } catch (err) {
      console.error('[test-pinata] Failed to upload image to Pinata:', err);
      throw new Error(
        `Failed to upload image to Pinata: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }

    // 3. Upload the metadata to Pinata using generator functions
    let metadataHash;
    try {
      metadataHash = await uploadMetadataToPinata(testTokenId, imageHash, attributes);
      console.log('[test-pinata] Successfully uploaded metadata to Pinata:', metadataHash);
    } catch (err) {
      console.error('[test-pinata] Failed to upload metadata to Pinata:', err);
      throw new Error(
        `Failed to upload metadata to Pinata: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }

    // 4. Create URLs and token URI
    const imageUrl = `https://gateway.pinata.cloud/ipfs/${imageHash}`;
    const metadataUrl = `https://gateway.pinata.cloud/ipfs/${metadataHash}`;
    const tokenURI = `ipfs://${metadataHash}`;

    // 5. Create the complete metadata object (for display purposes)
    const completeMetadata = {
      name: `${collectionName} #${testTokenId}`,
      description: `Generated test NFT from ${collectionName}`,
      image: `ipfs://${imageHash}`,
      attributes,
    };

    // 6. Store the IPFS hashes and URLs in Redis
    await redis.set('test-pinata-image-hash', imageHash);
    await redis.set('test-pinata-image-url', imageUrl);
    await redis.set('test-pinata-metadata-hash', metadataHash);
    await redis.set('test-pinata-metadata-url', metadataUrl);
    await redis.set('test-pinata-token-uri', tokenURI);

    const result: PinataUploadResult = {
      imageHash,
      imageUrl,
      metadataHash,
      metadataUrl,
      tokenURI,
      metadata: completeMetadata,
    };

    console.log('[test-pinata] Test completed successfully');

    return NextResponse.json({
      success: true,
      ...result,
      message: 'Generated NFT image and metadata uploaded to Pinata using generator package',
    });
  } catch (error) {
    console.error('[test-pinata] Error in Pinata test:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload to Pinata',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
