import PinataClient from '@pinata/sdk';
import { Readable } from 'stream';
import { collectionName, collectionDescription } from '../config';
import { NftAttribute } from './compose';

const pinata = new PinataClient({ pinataJWTKey: process.env.PINATA_JWT! });

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
  try {
    const stream = Readable.from(imageBuffer);
    const response = await pinata.pinFileToIPFS(stream, {
      pinataMetadata: { name },
    });
    return response.IpfsHash;
  } catch (error) {
    console.error('Error uploading image to Pinata:', error);
    throw new Error('Failed to upload image to Pinata.');
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
        name: `Onchain Train Metadata #${tokenId}`,
      },
    });
    return response.IpfsHash;
  } catch (error) {
    console.error('Error uploading metadata to Pinata:', error);
    throw new Error('Failed to upload metadata to Pinata.');
  }
};
