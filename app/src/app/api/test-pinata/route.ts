import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import PinataClient from '@pinata/sdk';
import { Readable } from 'stream';
import { redis } from '@/lib/kv';

// @todo: remove this as the `generator` package will handle this
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

    // Upload to Pinata
    const stream = Readable.from(imageBuffer);
    const response = await pinata.pinFileToIPFS(stream, {
      pinataMetadata: { name: 'nft-1.png test upload' },
    });

    if (!response?.IpfsHash) {
      throw new Error('Invalid response from Pinata API');
    }

    const ipfsHash = response.IpfsHash;
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

    // Store the IPFS hash in Redis
    await redis.set('test-pinata-hash', ipfsHash);
    await redis.set('test-pinata-url', ipfsUrl);

    return NextResponse.json({
      success: true,
      ipfsHash,
      ipfsUrl,
      message: 'Image uploaded to Pinata and stored in Redis',
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
