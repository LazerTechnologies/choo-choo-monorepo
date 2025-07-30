/**
 * NFT metadata structure (ERC721/1155 standard)
 */
export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  [key: string]: unknown;
}

/**
 * Pinata API response structure for file uploads
 */
export interface PinataFileResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
  isDuplicate?: boolean;
}

/**
 * Pinata API response structure for JSON uploads
 */
export interface PinataJSONResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
  isDuplicate?: boolean;
}

/**
 * Complete Pinata upload result with both image and metadata
 */
export interface PinataUploadResult {
  imageHash: string;
  imageUrl: string;
  metadataHash: string;
  metadataUrl: string;
  tokenURI: string;
  metadata: NFTMetadata;
}

/**
 * IPFS asset reference
 */
export interface IPFSAsset {
  hash: string;
  url: string;
  uri: string; // ipfs:// format
}

/**
 * Complete NFT package with all IPFS references
 */
export interface NFTPackage {
  tokenId?: number;
  image: IPFSAsset;
  metadata: IPFSAsset;
  nftMetadata: NFTMetadata;
}
