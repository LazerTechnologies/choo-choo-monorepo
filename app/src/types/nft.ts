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

/**
 * Comprehensive token data stored in Redis
 * Used for tracking all information about a minted token
 */
export interface TokenData {
  tokenId: number;

  // IPFS
  imageHash: string;
  metadataHash: string;
  tokenURI: string; // ipfs://metadata_hash

  // Holder information
  holderAddress: string;
  holderUsername?: string;
  holderFid?: number;
  holderDisplayName?: string;
  holderPfpUrl?: string;

  // Transaction data
  transactionHash: string;
  timestamp: string; // ISO string
  blockNumber?: number;

  // Generation metadata
  attributes?: Array<{ trait_type: string; value: string | number }>;

  // Source information
  sourceType: 'send-train' | 'admin-test' | 'manual';
  sourceCastHash?: string;
  totalEligibleReactors?: number;
}

/**
 * Current token ID tracker
 */
export interface CurrentTokenTracker {
  currentTokenId: number;
  lastUpdated: string; // ISO string
}

/**
 * Last moved timestamp tracker for train movement
 */
export interface LastMovedTimestamp {
  timestamp: string; // ISO string
  transactionHash: string;
}
