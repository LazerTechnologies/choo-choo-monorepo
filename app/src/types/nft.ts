/**
 * Base types for more explicit typing
 */

/** IPFS URI in the format "ipfs://hash" */
export type IPFSUri = `ipfs://${string}`;

/** Token URI (typically an IPFS URI pointing to metadata) */
export type TokenURI = IPFSUri;

/** ISO 8601 timestamp string */
export type ISOTimestamp = string;

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
  Timestamp: ISOTimestamp;
  isDuplicate?: boolean;
}

/**
 * Pinata API response structure for JSON uploads
 */
export interface PinataJSONResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: ISOTimestamp;
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
  tokenURI: TokenURI;
  metadata: NFTMetadata;
}

/**
 * IPFS asset reference
 */
export interface IPFSAsset {
  hash: string;
  url: string;
  uri: IPFSUri;
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
  tokenURI: TokenURI;

  // Holder information
  holderAddress: string;
  holderUsername?: string;
  holderFid?: number;
  holderDisplayName?: string;
  holderPfpUrl?: string;

  // Transaction data
  transactionHash: string;
  timestamp: ISOTimestamp;
  blockNumber?: number;

  // Generation metadata
  attributes?: Array<{ trait_type: string; value: string | number }>;

  // Source information
  sourceType: 'send-train' | 'admin-test' | 'manual' | 'yoink' | 'repair-script';
  sourceCastHash?: string;
  totalEligibleReactors?: number;
}

/**
 * Current token ID tracker
 */
export interface CurrentTokenTracker {
  currentTokenId: number;
  lastUpdated: ISOTimestamp;
}

/**
 * Last moved timestamp tracker for train movement
 */
export interface LastMovedTimestamp {
  timestamp: ISOTimestamp;
  transactionHash: string;
}

/**
 * Current train holder data stored in Redis
 */
export interface CurrentHolderData {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  address: string;
  timestamp: ISOTimestamp;
}
