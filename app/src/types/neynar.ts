/**
 * Neynar Hub API verification message types
 */

export interface NeynarVerificationMessage {
  data: {
    type: string;
    fid: number;
    timestamp: number;
    network: string;
    verificationAddAddressBody: {
      address: string;
      claimSignature: string;
      blockHash: string;
      type: number;
      chainId: number;
      protocol: string;
    };
  };
  hash: string;
  hashScheme: string;
  signature: string;
  signatureScheme: string;
  signer: string;
}

export interface NeynarVerificationResponse {
  messages: NeynarVerificationMessage[];
  nextPageToken: string;
}

/**
 * Extracted verification address with metadata
 */
export interface VerificationAddress {
  address: string;
  protocol: 'PROTOCOL_ETHEREUM' | 'PROTOCOL_SOLANA';
  timestamp: number;
  fid: number;
}

/**
 * User address API response
 */
export interface UserAddressResponse {
  fid: number;
  address: string;
  type: 'verification';
}
