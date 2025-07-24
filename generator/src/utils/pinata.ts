import PinataClient from '@pinata/sdk';
import { Readable } from 'stream';
import { collectionName, collectionDescription } from '../config';
import { NftAttribute } from './compose';

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
export const uploadImageToPinata = async (
  imageBuffer: Buffer,
  name: string
): Promise<string> => {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    throw new Error('imageBuffer must be a valid Buffer');
  }

  if (imageBuffer.length === 0) {
    throw new Error('imageBuffer cannot be empty');
  }

  const maxSizeInBytes = 50 * 1024 * 1024; // 50MB
  if (imageBuffer.length > maxSizeInBytes) {
    throw new Error(
      `Image file size (${imageBuffer.length} bytes) exceeds maximum allowed size of ${maxSizeInBytes} bytes`
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

  if (!pinata) {
    throw new Error('Pinata client is not properly initialized');
  }

  try {
    const stream = Readable.from(imageBuffer);
    const response = await pinata.pinFileToIPFS(stream, {
      pinataMetadata: { name },
    });

    if (!response || typeof response !== 'object') {
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

    //----- PINATA ERRORS -----//
    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('403')) {
        throw new Error(
          'Authentication failed with Pinata. Please check your PINATA_JWT token.'
        );
      }
      if (
        error.message.includes('413') ||
        error.message.includes('Payload too large')
      ) {
        throw new Error('Image file is too large for Pinata upload.');
      }
      if (error.message.includes('429')) {
        throw new Error(
          'Rate limit exceeded for Pinata API. Please try again later.'
        );
      }
      if (
        error.message.includes('500') ||
        error.message.includes('502') ||
        error.message.includes('503')
      ) {
        throw new Error(
          'Pinata service is temporarily unavailable. Please try again later.'
        );
      }
    }

    throw new Error(
      `Failed to upload image to Pinata: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
};

/**
 * Uploads the NFT metadata to Pinata.
 * @param tokenId - The ID of the token.
 * @param imageCid - The IPFS CID of the image for this token.
 * @param attributes - The attributes for this token.
 * @returns A promise that resolves to the IPFS hash (CID) of the uploaded metadata.
 */
export const uploadMetadataToPinata = async (
  tokenId: number,
  imageCid: string,
  attributes: NftAttribute[]
): Promise<string> => {
  try {
    const metadata = {
      name: `${collectionName} #${tokenId}`,
      description: collectionDescription,
      image: `ipfs://${imageCid}`,
      attributes,
    };

    const response = await pinata.pinJSONToIPFS(metadata, {
      pinataMetadata: {
        name: `${collectionName} Metadata #${tokenId}`, // @todo: make sure we're pulling tokenId from KV and not direct from contract to avoid race conditions, have a "nextTokenId" variable in KV
      },
    });
    return response.IpfsHash;
  } catch (error) {
    console.error('Error uploading metadata to Pinata:', error);
    throw new Error('Failed to upload metadata to Pinata.');
  }
};
