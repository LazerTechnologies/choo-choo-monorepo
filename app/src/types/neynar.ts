/**
 * Neynar Bulk API user response types
 */

export interface NeynarUser {
  object: string;
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  custody_address: string;
  profile: {
    bio: {
      text: string;
    };
  };
  follower_count: number;
  following_count: number;
  verifications: string[];
  verified_addresses: {
    eth_addresses: string[];
    sol_addresses: string[];
    primary: {
      eth_address: string;
      sol_address: string;
    };
  };
  verified_accounts: Array<{
    platform: string;
    username: string;
  }>;
  power_badge: boolean;
  experimental: {
    neynar_user_score: number;
    deprecation_notice: string;
  };
  score: number;
}

export interface NeynarBulkUsersResponse {
  users: NeynarUser[];
  next: {
    cursor: string | null;
  };
}

/**
 * User address API response
 * Only returns verified Ethereum addresses, not custody addresses or Solana
 */
export interface UserAddressResponse {
  fid: number;
  address: string;
  type: 'verification';
  protocol: 'ethereum';
}
