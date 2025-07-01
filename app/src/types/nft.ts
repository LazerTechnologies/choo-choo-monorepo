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
