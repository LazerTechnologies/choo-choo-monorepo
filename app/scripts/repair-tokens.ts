/**
 * Token Repair Script
 *
 * Repairs tokens 667-672 by:
 * 1. Generating new NFT images using the generator
 * 2. Uploading images and metadata to Pinata
 * 3. Calling setTicketData on-chain to update contract metadata
 * 4. Outputs Redis commands to a file for manual verification and execution
 *
 * Usage:
 *   pnpm dlx tsx app/scripts/repair-tokens.ts
 */
/// <reference types="node" />
import 'dotenv/config';

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import {
  collectionName,
  composeImage,
  uploadImageToPinata,
  uploadMetadataToPinata,
} from 'generator';
import type { Address } from 'viem';
import { createChooChooMetadata } from '../src/lib/nft-metadata-utils';
import { ContractService } from '../src/lib/services/contract';
import type { NFTMetadata, TokenData } from '../src/types/nft';

// Define REDIS_KEYS locally to avoid importing redis-token-utils (which initializes Redis)
const REDIS_KEYS = {
  token: (tokenId: number) => `token${tokenId}`,
} as const;

// Get script directory for output file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables (project root first, then script directory)
loadEnv();
loadEnv({ path: join(__dirname, '.env'), override: false });

// ========== CONFIGURATION ==========
const CONFIG = {
  RPC_URL: process.env.RPC_URL ?? 'https://mainnet.base.org',
  CONTRACT_ADDRESS: '0xBF5Fa62C9851DF0F2d0d03d4e974cE1b1E2CB88d' as Address,
  USE_MAINNET: true,

  PRIVATE_KEY: process.env.PRIVATE_KEY as `0x${string}`,

  // Repair targets
  TARGET_TOKEN_IDS: [673],
  BACKFILL_DATA_FILE: 'backfill-data.json',
};

// ========== TYPES ==========
type BackfillNeynarUser = {
  fid: number;
  username: string;
  display_name: string;
  pfp_url?: string;
  [key: string]: unknown;
};

type BackfillToken = {
  tokenId: number;
  onChain: {
    tokenURI: string | null;
    image: string | null;
    imageHash: string | null;
    metadataHash: string | null;
    mintedTo: Address | null;
    transactionHash: `0x${string}` | null;
    blockNumber: number | null;
    mintedAtMs: number | null;
    mintedAtIso: string | null;
  };
  redis: {
    exists: boolean;
    data: TokenData | null;
  };
  pinata: {
    metadataUrl: string | null;
    metadataStatus?: string;
    imageUrl: string | null;
    imageStatus?: string;
    metadata: {
      name: string;
      description: string;
      image: string;
      attributes?: Array<{ trait_type: string; value: string | number }>;
      [key: string]: unknown;
    } | null;
  };
  neynar: {
    address: Address | null;
    user?: BackfillNeynarUser;
    error?: string;
  };
  issues: string[];
};

type BackfillDataFile = {
  generatedAt: string;
  range: {
    start: number;
    end: number;
  };
  tokens: BackfillToken[];
};

type GeneratedNFT = {
  success: boolean;
  imageHash: string;
  metadataHash: string;
  tokenURI: string;
  metadata: NFTMetadata;
  error?: string;
};

type RepairResult = {
  tokenId: number;
  success: boolean;
  steps: {
    generateNFT: boolean;
    setTicketData: boolean;
    prepareRedisData: boolean;
  };
  data?: {
    holderAddress: string;
    holderUsername: string;
    holderFid: number;
    holderDisplayName: string;
    holderPfpUrl?: string;
    imageHash: string;
    metadataHash: string;
    tokenURI: string;
    transactionHash: string;
    timestamp: string;
    blockNumber?: number;
    attributes: Array<{ trait_type: string; value: string | number }>;
  };
  redisCommand?: string;
  error?: string;
};

// ========== HELPER FUNCTIONS ==========
function validateConfig(): void {
  const missing: string[] = [];
  if (!CONFIG.RPC_URL) missing.push('RPC_URL');
  if (!CONFIG.CONTRACT_ADDRESS) missing.push('CONTRACT_ADDRESS');
  if (!CONFIG.PRIVATE_KEY) missing.push('PRIVATE_KEY');
  if (!process.env.PINATA_JWT) missing.push('PINATA_JWT');

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}

function loadBackfillData(): BackfillDataFile {
  const backfillPath = join(__dirname, CONFIG.BACKFILL_DATA_FILE);
  const raw = readFileSync(backfillPath, 'utf-8');
  const data = JSON.parse(raw) as BackfillDataFile;
  return data;
}

async function generateAndUploadNFT(
  tokenId: number,
  passengerUsername: string,
): Promise<GeneratedNFT> {
  try {
    console.log(
      `[repair] Generating NFT assets locally for token ${tokenId} (passenger: ${passengerUsername})...`,
    );

    const { imageBuffer, attributes } = await composeImage();

    const sanitizedFilename = `${collectionName}-${tokenId}-img.png`;
    const imageHash = await uploadImageToPinata(imageBuffer, sanitizedFilename);

    const metadataHash = await uploadMetadataToPinata(
      tokenId,
      imageHash,
      attributes,
      passengerUsername,
    );

    const metadata = createChooChooMetadata(tokenId, imageHash, attributes, passengerUsername);

    return {
      success: true,
      imageHash,
      metadataHash,
      tokenURI: `ipfs://${metadataHash}`,
      metadata,
    };
  } catch (error) {
    console.error('[repair] Failed to generate NFT locally:', error);
    return {
      success: false,
      imageHash: '',
      metadataHash: '',
      tokenURI: '',
      metadata: {
        name: '',
        description: '',
        image: '',
        attributes: [],
      },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function setTicketDataOnChain(
  contractService: ContractService,
  tokenId: number,
  tokenURI: string,
  imageHash: string,
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const imageIPFS = `ipfs://${imageHash}`;

    console.log(`[repair] Setting ticket data on-chain for token ${tokenId}...`);
    const txHash = await contractService.setTicketData(tokenId, tokenURI, imageIPFS);

    console.log(`[repair] ✅ Ticket data set on-chain: ${txHash}`);
    return { success: true, txHash };
  } catch (error) {
    console.error(`[repair] Failed to set ticket data on-chain:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function generateRedisCommand(tokenData: TokenData): string {
  const redisKey = REDIS_KEYS.token(tokenData.tokenId);
  const jsonValue = JSON.stringify(tokenData, null, 2);
  return [`cat <<'EOF' | redis-cli -x SET ${redisKey} NX`, jsonValue, 'EOF'].join('\n');
}

// ========== MAIN REPAIR FUNCTION ==========
async function repairToken(
  contractService: ContractService,
  token: BackfillToken,
): Promise<RepairResult> {
  console.log(`\n========== Repairing Token #${token.tokenId} ==========`);

  const result: RepairResult = {
    tokenId: token.tokenId,
    success: false,
    steps: {
      generateNFT: false,
      setTicketData: false,
      prepareRedisData: false,
    },
  };

  try {
    const holderAddress = token.onChain.mintedTo;
    const transactionHash = token.onChain.transactionHash;
    const neynarUser = token.neynar.user;

    if (!holderAddress) {
      result.error = 'Missing holder address in backfill data';
      return result;
    }
    if (!transactionHash) {
      result.error = 'Missing transaction hash in backfill data';
      return result;
    }
    if (!neynarUser?.username) {
      result.error = 'Missing Neynar user data in backfill JSON';
      return result;
    }
    if (!neynarUser.fid) {
      result.error = 'Neynar user is missing fid';
      return result;
    }

    console.log(
      `[repair] Holder address: ${holderAddress} (FID: ${neynarUser.fid}, user: ${neynarUser.username})`,
    );
    console.log(`[repair] Transaction: ${transactionHash}`);
    if (token.onChain.mintedAtIso) {
      console.log(`[repair] Minted at: ${token.onChain.mintedAtIso}`);
    }

    // Step 1: Generate NFT (image + metadata)
    console.log(`[repair] Step 1: Generating NFT...`);
    const passengerUsername = neynarUser.username;
    const nftData = await generateAndUploadNFT(token.tokenId, passengerUsername);

    if (!nftData.success || !nftData.imageHash || !nftData.metadataHash) {
      result.error = `Failed to generate NFT: ${nftData.error}`;
      return result;
    }

    result.steps.generateNFT = true;
    console.log(`[repair] ✅ Generated NFT:`);
    console.log(`[repair]    Image: ipfs://${nftData.imageHash}`);
    console.log(`[repair]    Metadata: ${nftData.tokenURI}`);

    const attributes = nftData.metadata.attributes ?? [];

    // Step 2: Set ticket data on-chain
    console.log(`[repair] Step 2: Setting ticket data on-chain...`);
    const setDataResult = await setTicketDataOnChain(
      contractService,
      token.tokenId,
      nftData.tokenURI,
      nftData.imageHash,
    );

    if (!setDataResult.success) {
      result.error = `Failed to set ticket data on-chain: ${setDataResult.error}`;
      return result;
    }

    result.steps.setTicketData = true;

    // Step 3: Prepare Redis data (generate command for manual execution)
    console.log(`[repair] Step 3: Preparing Redis data...`);
    const timestamp =
      token.onChain.mintedAtIso ??
      (token.onChain.mintedAtMs
        ? new Date(token.onChain.mintedAtMs).toISOString()
        : new Date().toISOString());
    const blockNumber = token.onChain.blockNumber ?? undefined;

    const tokenData: TokenData = {
      tokenId: token.tokenId,
      imageHash: nftData.imageHash,
      metadataHash: nftData.metadataHash,
      tokenURI: nftData.tokenURI as `ipfs://${string}`,
      holderAddress: holderAddress.toLowerCase(),
      holderUsername: passengerUsername,
      holderFid: neynarUser.fid,
      holderDisplayName: neynarUser.display_name ?? passengerUsername,
      holderPfpUrl: neynarUser.pfp_url ?? undefined,
      transactionHash,
      timestamp,
      blockNumber,
      attributes,
      sourceType: 'repair-script',
    };

    const redisCommand = generateRedisCommand(tokenData);
    result.steps.prepareRedisData = true;
    console.log(`[repair] ✅ Redis command generated`);

    // Success!
    result.success = true;
    result.data = {
      holderAddress: holderAddress.toLowerCase(),
      holderUsername: passengerUsername,
      holderFid: neynarUser.fid,
      holderDisplayName: neynarUser.display_name ?? passengerUsername,
      holderPfpUrl: neynarUser.pfp_url ?? undefined,
      imageHash: nftData.imageHash,
      metadataHash: nftData.metadataHash,
      tokenURI: nftData.tokenURI,
      transactionHash,
      timestamp,
      blockNumber,
      attributes,
    };
    result.redisCommand = redisCommand;

    console.log(`[repair] ✅ Token #${token.tokenId} repaired successfully!`);
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.error(`[repair] ❌ Failed to repair token ${token.tokenId}:`, error);
    return result;
  }
}

// ========== MAIN SCRIPT ==========
async function runRepair() {
  console.log('========================================');
  console.log('Token Repair Script');
  console.log('========================================\n');

  // Validate configuration
  try {
    validateConfig();
  } catch (error) {
    console.error('❌ Configuration error:', error);
    process.exitCode = 1;
    return;
  }

  // Log configuration
  console.log(`Network: ${CONFIG.USE_MAINNET ? 'Base Mainnet' : 'Base Sepolia'}`);
  const backfillData = loadBackfillData();
  const tokensById = new Map<number, BackfillToken>(
    backfillData.tokens.map((token) => [token.tokenId, token]),
  );
  const tokensToRepair = CONFIG.TARGET_TOKEN_IDS.map((tokenId) => {
    const token = tokensById.get(tokenId);
    if (!token) {
      throw new Error(
        `Token #${tokenId} not found in ${CONFIG.BACKFILL_DATA_FILE}. Re-run the backfill script.`,
      );
    }
    return token;
  });
  console.log(`Tokens to repair: ${tokensToRepair.map((token) => token.tokenId).join(', ')}\n`);

  // Initialize contract service with private key
  const contractService = new ContractService({
    address: CONFIG.CONTRACT_ADDRESS,
    rpcUrl: CONFIG.RPC_URL,
    adminPrivateKey: CONFIG.PRIVATE_KEY,
    useMainnet: CONFIG.USE_MAINNET,
  });

  const results: RepairResult[] = [];

  // Repair each token
  for (let index = 0; index < tokensToRepair.length; index++) {
    const token = tokensToRepair[index];

    if (token.issues.length > 0) {
      console.log(`[repair] Known issues for token #${token.tokenId}: ${token.issues.join('; ')}`);
    }

    const result = await repairToken(contractService, token);
    results.push(result);

    // Add delay between tokens to avoid rate limits
    if (index < tokensToRepair.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next token...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Print summary
  console.log('\n========================================');
  console.log('Repair Summary');
  console.log('========================================\n');

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`Total tokens: ${results.length}`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}\n`);

  if (failed > 0) {
    console.log('Failed tokens:');
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  Token #${r.tokenId}: ${r.error}`);
      });
  }

  // Write detailed report to file
  const reportPath = join(__dirname, 'repair-report.json');
  writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n📄 Detailed report written to: ${reportPath}`);

  // Write Redis commands to file for manual execution
  const redisCommandsPath = join(__dirname, 'redis-commands.sh');
  const successfulResults = results.filter((r) => r.success && r.redisCommand);

  if (successfulResults.length > 0) {
    const commandsContent = [
      '#!/bin/bash',
      '# Redis commands for token repair',
      `# Generated: ${new Date().toISOString()}`,
      '# Run this script to add the repaired tokens to Redis',
      '',
      "# Note: These commands use NX flag (only set if key doesn't exist)",
      '# This prevents overwriting existing data',
      '',
      ...successfulResults.map((r) => r.redisCommand).filter((cmd): cmd is string => !!cmd),
      '',
      "echo 'Redis commands executed successfully!'",
    ].join('\n');

    writeFileSync(redisCommandsPath, commandsContent, 'utf-8');
    console.log(`\n📝 Redis commands written to: ${redisCommandsPath}`);
    console.log(`   Review the file and run it manually to update Redis.`);
  } else {
    console.log(`\n⚠️  No successful repairs to write Redis commands for.`);
  }

  // Exit with error code if any repairs failed
  if (failed > 0) {
    process.exitCode = 1;
  }
}

runRepair().catch((error) => {
  console.error('[repair] Script failed:', error);
  process.exitCode = 1;
});
