import type { NFTMetadata } from '@/types/nft';

/**
 * Standard NFT attribute structure
 */
export interface NFTAttribute {
  trait_type: string;
  value: string | number;
}

/**
 * Collection configuration
 */
export const COLLECTION_CONFIG = {
  name: 'ChooChoo',
  description:
    'ChooChoo on Base - A train trying to visit every wallet on Base! The community decides each stop on the journey.',
} as const;

/**
 * Creates standardized NFT metadata for ChooChoo tokens
 *
 * @param tokenId - The token ID for this NFT
 * @param imageIPFSHash - The IPFS hash of the image (without ipfs:// prefix)
 * @param generatedAttributes - Attributes from the image generation process
 * @param passengerUsername - Farcaster username of the original holder (for Passenger trait)
 * @param additionalAttributes - Any additional custom attributes
 * @returns Complete NFT metadata object
 */
export function createChooChooMetadata(
  tokenId: number,
  imageIPFSHash: string,
  generatedAttributes: NFTAttribute[] = [],
  passengerUsername?: string,
  additionalAttributes: NFTAttribute[] = [],
): NFTMetadata {
  const attributes: NFTAttribute[] = [
    // Generated visual attributes come first
    ...generatedAttributes,

    // Add Passenger trait if username is provided
    ...(passengerUsername ? [{ trait_type: 'Passenger', value: passengerUsername }] : []),

    // Add any additional custom attributes
    ...additionalAttributes,
  ];

  return {
    name: `${COLLECTION_CONFIG.name} #${tokenId}`,
    description: COLLECTION_CONFIG.description,
    image: `ipfs://${imageIPFSHash}`,
    attributes,
  };
}

/**
 * Creates metadata for admin test tokens with mock data
 */
export function createTestMetadata(
  tokenId: number,
  imageIPFSHash: string,
  passengerUsername?: string,
): NFTMetadata {
  const testAttributes: NFTAttribute[] = [
    { trait_type: 'Source', value: 'Admin Test' },
    { trait_type: 'Background', value: 'Test Environment' },
    { trait_type: 'Rarity', value: 'Test' },
  ];

  return createChooChooMetadata(tokenId, imageIPFSHash, testAttributes, passengerUsername);
}

/**
 * Validates that metadata conforms to standard structure
 */
export function validateMetadata(metadata: NFTMetadata): boolean {
  return !!(
    metadata.name &&
    metadata.description &&
    metadata.image &&
    metadata.image.startsWith('ipfs://') &&
    Array.isArray(metadata.attributes)
  );
}

/**
 * Finds a specific attribute value by trait_type
 */
export function getAttributeValue(
  metadata: NFTMetadata,
  traitType: string,
): string | number | undefined {
  const attribute = metadata.attributes?.find((attr) => attr.trait_type === traitType);
  return attribute?.value;
}

/**
 * Checks if metadata has a Passenger trait
 */
export function hasPassengerTrait(metadata: NFTMetadata): boolean {
  return !!getAttributeValue(metadata, 'Passenger');
}
