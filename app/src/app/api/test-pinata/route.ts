import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import PinataClient from '@pinata/sdk';
import { Readable } from 'stream';
import { redis } from '@/lib/kv';
import type {
  NFTMetadata,
  PinataFileResponse,
  PinataJSONResponse,
  PinataUploadResult,
} from '@/types/nft';

// @todo: remove this as the `generator` package will handle this
// @todo: make sure the generator package uploads the metadata properly using patterns below
const pinataJWT = process.env.PINATA_JWT;
if (!pinataJWT) {
  throw new Error('PINATA_JWT environment variable is required');
}
const pinata = new PinataClient({ pinataJWTKey: pinataJWT });

export async function POST() {
  try {
    // Read the nft-1.png file from public/mock directory
    const imagePath = join(process.cwd(), 'public', 'mock', 'nft-1.png');
    const imageBuffer = await readFile(imagePath);

    // Read the nft-1.json metadata file
    const metadataPath = join(process.cwd(), 'public', 'mock', 'nft-1.json');
    const metadataContent = await readFile(metadataPath, 'utf-8');
    const metadata: NFTMetadata = JSON.parse(metadataContent);

    // Upload image to Pinata
    const imageStream = Readable.from(imageBuffer);
    const imageResponse: PinataFileResponse = await pinata.pinFileToIPFS(imageStream, {
      pinataMetadata: { name: 'test-nft-1.png' },
    });

    if (!imageResponse?.IpfsHash) {
      throw new Error('Invalid response from Pinata API for image upload');
    }

    const imageHash = imageResponse.IpfsHash;
    const imageUrl = `https://gateway.pinata.cloud/ipfs/${imageHash}`;

    // Update metadata to point to the uploaded image
    const updatedMetadata: NFTMetadata = {
      ...metadata,
      image: `ipfs://${imageHash}`,
    };

    // Upload metadata to Pinata
    const metadataResponse: PinataJSONResponse = await pinata.pinJSONToIPFS(updatedMetadata, {
      pinataMetadata: { name: 'test-nft-1-metadata.json' },
    });

    if (!metadataResponse?.IpfsHash) {
      throw new Error('Invalid response from Pinata API for metadata upload');
    }

    const metadataHash = metadataResponse.IpfsHash;
    const metadataUrl = `https://gateway.pinata.cloud/ipfs/${metadataHash}`;
    const tokenURI = `ipfs://${metadataHash}`;

    // Store the IPFS hashes and URLs in Redis
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
      metadata: updatedMetadata,
    };

    return NextResponse.json({
      success: true,
      ...result,
      message: 'Image and metadata uploaded to Pinata and stored in Redis',
    });
  } catch (error) {
    console.error('Error uploading to Pinata:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload to Pinata',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
