import PinataClient from '@pinata/sdk';
import { Readable } from 'stream';
import { collectionName, collectionDescription } from '../config';
import type { NftAttribute } from './compose';

const pinataJWT = process.env.PINATA_JWT;
if (!pinataJWT) {
  throw new Error('PINATA_JWT environment variable is required');
}
const pinata = new PinataClient({ pinataJWTKey: pinataJWT });

/**
 * Uploads an image buffer to Pinata.
 * @param imageBuffer - The image buffer to upload.
 * @param name - A name for the file on Pinata.
 * @returns A promise that resolves to the IPFS hash (CID) of the uploaded image.
 */
export const uploadImageToPinata = async (imageBuffer: Buffer, name: string): Promise<string> => {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    throw new Error('imageBuffer must be a valid Buffer');
  }

  if (imageBuffer.length === 0) {
    throw new Error('imageBuffer cannot be empty');
  }

  const maxSizeInBytes = 50 * 1024 * 1024; // 50MB
  if (imageBuffer.length > maxSizeInBytes) {
    throw new Error(
      `Image file size (${imageBuffer.length} bytes) exceeds maximum allowed size of ${maxSizeInBytes} bytes`,
    );
  }

  if (!name || typeof name !== 'string') {
    throw new Error('name must be a non-empty string');
  }

  if (name.trim().length === 0) {
    throw new Error('name cannot be empty or contain only whitespace');
  }

  if (name.length > 255) {
    throw new Error('name must be 255 characters or less');
  }

  const validNamePattern = /^[\w\s.-]+$/;
  if (!validNamePattern.test(name)) {
    throw new Error(
      'name contains invalid characters. Only alphanumeric characters, spaces, dots, underscores, and hyphens are allowed',
    );
  }

  if (!pinata) {
    throw new Error('Pinata client is not properly initialized');
  }

  try {
    const stream = Readable.from(imageBuffer);
    const response = await pinata.pinFileToIPFS(stream, {
      pinataMetadata: { name },
    });

    if (!response || Array.isArray(response) || !('IpfsHash' in response)) {
      throw new Error('Invalid response from Pinata API');
    }

    if (!response.IpfsHash || typeof response.IpfsHash !== 'string') {
      throw new Error('Invalid IPFS hash received from Pinata');
    }

    if (response.IpfsHash.trim().length === 0) {
      throw new Error('Received empty IPFS hash from Pinata');
    }

    return response.IpfsHash;
  } catch (error) {
    console.error('Error uploading image to Pinata:', error);

    if (error instanceof Error) {
      const status =
        (error as { status?: number; response?: { status?: number } }).status ||
        (error as { status?: number; response?: { status?: number } }).response?.status;

      if (status === 401 || status === 403) {
        throw new Error('Authentication failed with Pinata. Please check your PINATA_JWT token.');
      }
      if (status === 413 || error.message.includes('Payload too large')) {
        throw new Error('Image file is too large for Pinata upload.');
      }
      if (status === 429) {
        throw new Error('Rate limit exceeded for Pinata API. Please try again later.');
      }
      if (status === 500 || status === 502 || status === 503) {
        throw new Error('Pinata service is temporarily unavailable. Please try again later.');
      }
    }

    const err = new Error(
      `Failed to upload image to Pinata: ${error instanceof Error ? error.message : 'Unknown error'}`,
    ) as Error & { cause: unknown };
    err.cause = error;
    throw err;
  }
};

/**
 * Uploads the NFT metadata to Pinata.
 * @param tokenId - The ID of the token.
 * @param imageCid - The IPFS CID of the image for this token.
 * @param attributes - The attributes for this token.
 * @param passengerUsername - Optional Farcaster username for Passenger trait.
 * @returns A promise that resolves to the IPFS hash (CID) of the uploaded metadata.
 */
export const uploadMetadataToPinata = async (
  tokenId: number,
  imageCid: string,
  attributes: NftAttribute[],
  passengerUsername?: string,
): Promise<string> => {
  try {
    // Create metadata with proper tokenId naming and Passenger trait
    const metadata = {
      name: `${collectionName} #${tokenId}`,
      description: collectionDescription,
      image: `ipfs://${imageCid}`,
      attributes: [
        ...attributes,
        // Add Passenger trait if username is provided
        ...(passengerUsername ? [{ trait_type: 'Passenger', value: passengerUsername }] : []),
      ],
    };

    const response = await pinata.pinJSONToIPFS(metadata, {
      pinataMetadata: {
        name: `${collectionName}-${tokenId}-metadata`,
      },
    });
    return response.IpfsHash;
  } catch (error) {
    console.error('Error uploading metadata to Pinata:', error);
    const err = new Error(
      `Failed to upload metadata to Pinata: ${error instanceof Error ? error.message : 'Unknown error'}`,
    ) as Error & { cause: unknown };
    err.cause = error;
    throw err;
  }
};
