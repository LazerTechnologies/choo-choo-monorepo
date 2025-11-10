#!/usr/bin/env tsx

/**
 * Redis Token Sync Repair Script
 *
 * This script repairs inconsistencies between on-chain token data and Redis cache.
 * It should be run after the off-by-one fixes to ensure all existing data is consistent.
 *
 * Usage: npx tsx src/scripts/repair-redis-token-sync.ts [--dry-run]
 */

import { getContractService } from '../lib/services/contract';
import {
  getCurrentTokenId,
  getTokenData,
  storeTokenData,
  REDIS_KEYS,
} from '../lib/redis-token-utils';
import { redis } from '../lib/kv';
import type { TokenData, CurrentTokenTracker } from '../types/nft';

interface RepairReport {
  onChainTotalTickets: number;
  redisCurrentTokenId: number | null;
  tokensChecked: number;
  tokensRepaired: number;
  tokensWithMissingData: number[];
  tokensWithIncorrectData: number[];
  trackerRepaired: boolean;
  errors: string[];
}

async function repairRedisTokenSync(isDryRun = false): Promise<RepairReport> {
  const report: RepairReport = {
    onChainTotalTickets: 0,
    redisCurrentTokenId: null,
    tokensChecked: 0,
    tokensRepaired: 0,
    tokensWithMissingData: [],
    tokensWithIncorrectData: [],
    trackerRepaired: false,
    errors: [],
  };

  try {
    console.log(`🔧 Starting Redis token sync repair ${isDryRun ? '(DRY RUN)' : ''}...`);

    // 1. Get on-chain data
    const contractService = getContractService();
    const onChainTotalTickets = await contractService.getTotalTickets();
    report.onChainTotalTickets = onChainTotalTickets;

    console.log(`📊 On-chain total tickets: ${onChainTotalTickets}`);

    // 2. Get current Redis tracker
    const redisCurrentTokenId = await getCurrentTokenId();
    report.redisCurrentTokenId = redisCurrentTokenId;

    console.log(`📊 Redis current token ID: ${redisCurrentTokenId}`);

    // 3. Check if tracker needs repair
    if (redisCurrentTokenId !== onChainTotalTickets) {
      console.log(`⚠️  Redis tracker mismatch: ${redisCurrentTokenId} vs ${onChainTotalTickets}`);

      if (!isDryRun && onChainTotalTickets > 0) {
        const tracker: CurrentTokenTracker = {
          currentTokenId: onChainTotalTickets,
          lastUpdated: new Date().toISOString(),
        };
        await redis.set(REDIS_KEYS.currentTokenId, JSON.stringify(tracker));
        console.log(`✅ Repaired Redis tracker to: ${onChainTotalTickets}`);
        report.trackerRepaired = true;
      } else if (isDryRun) {
        console.log(`🔍 Would repair Redis tracker to: ${onChainTotalTickets}`);
        report.trackerRepaired = true;
      }
    }

    // 4. Check each token that should exist on-chain
    if (onChainTotalTickets > 0) {
      console.log(`🔍 Checking tokens 1 through ${onChainTotalTickets}...`);

      for (let tokenId = 1; tokenId <= onChainTotalTickets; tokenId++) {
        report.tokensChecked++;

        try {
          // Check if token data exists in Redis
          const redisTokenData = await getTokenData(tokenId);

          if (!redisTokenData) {
            console.log(`❌ Missing Redis data for token ${tokenId}`);
            report.tokensWithMissingData.push(tokenId);

            try {
              const tokenURI = await contractService.getTokenURI(tokenId);

              if (tokenURI) {
                // Extract metadata hash from token URI
                const metadataHash = tokenURI.replace('ipfs://', '');

                // Try to fetch metadata to get image hash and attributes
                let imageHash = 'unknown';
                let attributes: Array<{ trait_type: string; value: string | number }> = [];

                try {
                  const metadataUrl = `${process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud'}/ipfs/${metadataHash}`;
                  const metadataResponse = await fetch(metadataUrl);
                  if (metadataResponse.ok) {
                    const metadata = await metadataResponse.json();
                    imageHash = metadata.image?.replace('ipfs://', '') || metadataHash;
                    attributes = metadata.attributes || [];
                  }
                } catch (metadataError) {
                  console.warn(
                    `⚠️  Could not fetch metadata for token ${tokenId}, using fallback`,
                    metadataError,
                  );
                }

                const tokenData: TokenData = {
                  tokenId,
                  imageHash,
                  metadataHash,
                  tokenURI: tokenURI as `ipfs://${string}`,
                  holderAddress: 'unknown',
                  holderUsername: 'unknown',
                  holderFid: 0,
                  holderDisplayName: 'Unknown',
                  holderPfpUrl: '',
                  transactionHash: 'unknown',
                  timestamp: new Date().toISOString(),
                  attributes,
                  sourceType: 'repair-script',
                };

                if (!isDryRun) {
                  await storeTokenData(tokenData);
                  console.log(`✅ Created Redis data for token ${tokenId}`);
                  report.tokensRepaired++;
                } else {
                  console.log(`🔍 Would create Redis data for token ${tokenId}`);
                  report.tokensRepaired++;
                }
              }
            } catch (contractError) {
              const error = `Failed to get token URI for token ${tokenId}: ${contractError}`;
              console.error(`❌ ${error}`);
              report.errors.push(error);
            }
          } else {
            // Token data exists, check for inconsistencies
            if (redisTokenData.tokenId !== tokenId) {
              console.log(
                `⚠️  Token ${tokenId} has incorrect tokenId in Redis: ${redisTokenData.tokenId}`,
              );
              report.tokensWithIncorrectData.push(tokenId);

              if (!isDryRun) {
                // Fix the token ID
                const correctedData = { ...redisTokenData, tokenId };
                await storeTokenData(correctedData);
                console.log(`✅ Corrected tokenId for token ${tokenId}`);
                report.tokensRepaired++;
              } else {
                console.log(`🔍 Would correct tokenId for token ${tokenId}`);
                report.tokensRepaired++;
              }
            }
          }
        } catch (error) {
          const errorMsg = `Error checking token ${tokenId}: ${error}`;
          console.error(`❌ ${errorMsg}`);
          report.errors.push(errorMsg);
        }
      }
    }

    // 5. Check for extra tokens in Redis that shouldn't exist
    console.log(`🔍 Checking for extra tokens beyond ${onChainTotalTickets}...`);

    // Check a reasonable range beyond the expected tokens
    const maxCheckRange = Math.max(onChainTotalTickets + 10, 20);
    for (let tokenId = onChainTotalTickets + 1; tokenId <= maxCheckRange; tokenId++) {
      try {
        const redisTokenData = await getTokenData(tokenId);
        if (redisTokenData) {
          console.log(`⚠️  Found extra token data in Redis for token ${tokenId}`);

          if (!isDryRun) {
            await redis.del(REDIS_KEYS.token(tokenId));
            console.log(`✅ Removed extra Redis data for token ${tokenId}`);
            report.tokensRepaired++;
          } else {
            console.log(`🔍 Would remove extra Redis data for token ${tokenId}`);
            report.tokensRepaired++;
          }
        }
      } catch (error) {
        const errorMsg = `Error checking extra token ${tokenId}: ${error}`;
        console.error(`❌ ${errorMsg}`);
        report.errors.push(errorMsg);
      }
    }

    console.log(`\n📋 Repair Summary:`);
    console.log(`   On-chain total tickets: ${report.onChainTotalTickets}`);
    console.log(`   Redis current token ID: ${report.redisCurrentTokenId}`);
    console.log(`   Tokens checked: ${report.tokensChecked}`);
    console.log(`   Tokens repaired: ${report.tokensRepaired}`);
    console.log(`   Tokens with missing data: ${report.tokensWithMissingData.length}`);
    console.log(`   Tokens with incorrect data: ${report.tokensWithIncorrectData.length}`);
    console.log(`   Tracker repaired: ${report.trackerRepaired}`);
    console.log(`   Errors: ${report.errors.length}`);

    if (report.errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
      report.errors.forEach((error) => console.log(`   - ${error}`));
    }

    if (isDryRun) {
      console.log(`\n🔍 This was a dry run. Run without --dry-run to apply changes.`);
    } else {
      console.log(`\n✅ Repair completed successfully!`);
    }
  } catch (error) {
    const errorMsg = `Fatal error during repair: ${error}`;
    console.error(`💥 ${errorMsg}`);
    report.errors.push(errorMsg);
  }

  return report;
}

// Run the repair if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const isDryRun = process.argv.includes('--dry-run');
  repairRedisTokenSync(isDryRun)
    .then((report) => {
      process.exit(report.errors.length > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

export { repairRedisTokenSync };
