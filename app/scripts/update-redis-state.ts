#!/usr/bin/env tsx

/**
 * Interactive CLI script to update Redis state
 *
 * Usage: tsx scripts/update-redis-state.ts <REDIS_URL>
 *
 * Example: tsx scripts/update-redis-state.ts redis://localhost:6379
 */

import Redis from 'ioredis';
import * as readline from 'readline';

interface CurrentHolderData {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  address: string;
  timestamp: string;
}

interface CurrentTokenTracker {
  currentTokenId: number;
  lastUpdated: string;
}

interface LastMovedTimestamp {
  timestamp: string;
  transactionHash: string;
}

const REDIS_KEYS = {
  currentHolder: 'current-holder',
  currentTokenId: 'current-token-id',
  lastMovedTimestamp: 'last-moved-timestamp',
} as const;

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function question(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

/**
 * Parse Basescan timestamp format and convert to ISO 8601
 * Input format: "Nov-10-2025 03:20:17 AM +UTC"
 * Output format: "2025-11-10T03:20:17.000Z"
 */
function parseTimestamp(input: string): string {
  if (!input || input.trim() === '') {
    return new Date().toISOString();
  }

  // Try to parse Basescan format: "Nov-10-2025 03:20:17 AM +UTC"
  const basescanPattern =
    /^([A-Za-z]{3})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)\s+\+UTC$/;
  const match = input.trim().match(basescanPattern);

  if (match) {
    const [, monthStr, day, year, hour12, minute, second, ampm] = match;

    // Convert month name to number
    const monthNames: Record<string, number> = {
      Jan: 0,
      Feb: 1,
      Mar: 2,
      Apr: 3,
      May: 4,
      Jun: 5,
      Jul: 6,
      Aug: 7,
      Sep: 8,
      Oct: 9,
      Nov: 10,
      Dec: 11,
    };

    const month = monthNames[monthStr];
    if (month === undefined) {
      throw new Error(`Invalid month: ${monthStr}`);
    }

    // Convert 12-hour to 24-hour format
    let hour24 = Number.parseInt(hour12, 10);
    if (ampm === 'PM' && hour24 !== 12) {
      hour24 += 12;
    } else if (ampm === 'AM' && hour24 === 12) {
      hour24 = 0;
    }

    // Create date object and convert to ISO
    const date = new Date(
      Date.UTC(
        Number.parseInt(year, 10),
        month,
        Number.parseInt(day, 10),
        hour24,
        Number.parseInt(minute, 10),
        Number.parseInt(second, 10),
      ),
    );

    return date.toISOString();
  }

  // If it's already in ISO format or another valid format, try to parse it
  const parsed = new Date(input);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  // If we can't parse it, return current time
  console.warn(`⚠️  Could not parse timestamp "${input}", using current time`);
  return new Date().toISOString();
}

async function updateCurrentHolder(rl: readline.Interface, redis: Redis): Promise<void> {
  console.log('\n📝 Updating Current Holder');
  console.log('─────────────────────────────');

  const fid = await question(rl, 'Enter FID (number): ');
  const username = await question(rl, 'Enter username: ');
  const displayName = await question(rl, 'Enter display name (or press Enter to use username): ');
  const pfpUrl = await question(rl, 'Enter PFP URL (or press Enter for empty): ');
  const address = await question(rl, 'Enter address (0x...): ');
  const timestampInput = await question(
    rl,
    'Enter timestamp (ISO format or Basescan format like "Nov-10-2025 03:20:17 AM +UTC", or press Enter for current time): ',
  );

  const data: CurrentHolderData = {
    fid: Number.parseInt(fid, 10),
    username,
    displayName: displayName || username,
    pfpUrl: pfpUrl || '',
    address,
    timestamp: parseTimestamp(timestampInput),
  };

  await redis.set(REDIS_KEYS.currentHolder, JSON.stringify(data));
  console.log('✅ Current holder updated successfully!');
  console.log(JSON.stringify(data, null, 2));
}

async function updateCurrentTokenId(rl: readline.Interface, redis: Redis): Promise<void> {
  console.log('\n📝 Updating Current Token ID');
  console.log('─────────────────────────────');

  const tokenId = await question(rl, 'Enter current token ID (number): ');
  const lastUpdatedInput = await question(
    rl,
    'Enter last updated timestamp (ISO format or Basescan format like "Nov-10-2025 03:20:17 AM +UTC", or press Enter for current time): ',
  );

  const data: CurrentTokenTracker = {
    currentTokenId: Number.parseInt(tokenId, 10),
    lastUpdated: parseTimestamp(lastUpdatedInput),
  };

  await redis.set(REDIS_KEYS.currentTokenId, JSON.stringify(data));
  console.log('✅ Current token ID updated successfully!');
  console.log(JSON.stringify(data, null, 2));
}

async function updateLastMovedTimestamp(rl: readline.Interface, redis: Redis): Promise<void> {
  console.log('\n📝 Updating Last Moved Timestamp');
  console.log('─────────────────────────────');

  const timestampInput = await question(
    rl,
    'Enter timestamp (ISO format or Basescan format like "Nov-10-2025 03:20:17 AM +UTC", or press Enter for current time): ',
  );
  const transactionHash = await question(rl, 'Enter transaction hash (0x...): ');

  const data: LastMovedTimestamp = {
    timestamp: parseTimestamp(timestampInput),
    transactionHash,
  };

  await redis.set(REDIS_KEYS.lastMovedTimestamp, JSON.stringify(data));
  console.log('✅ Last moved timestamp updated successfully!');
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  const redisUrl = process.argv[2];

  if (!redisUrl) {
    console.error('❌ Error: REDIS_URL is required');
    console.error('Usage: tsx scripts/update-redis-state.ts <REDIS_URL>');
    console.error('Example: tsx scripts/update-redis-state.ts redis://localhost:6379');
    process.exit(1);
  }

  console.log('🔌 Connecting to Redis...');
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });

  try {
    await redis.ping();
    console.log('✅ Connected to Redis\n');
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    process.exit(1);
  }

  const rl = createReadlineInterface();

  try {
    while (true) {
      console.log('\n📋 Which value do you want to set?');
      console.log('─────────────────────────────────');
      console.log('1. current-holder');
      console.log('2. current-token-id');
      console.log('3. last-moved-timestamp');
      console.log('4. Exit');

      const choice = await question(rl, '\nEnter choice (1-4): ');

      const choiceNum = choice.trim();
      if (choiceNum === '1') {
        await updateCurrentHolder(rl, redis);
      } else if (choiceNum === '2') {
        await updateCurrentTokenId(rl, redis);
      } else if (choiceNum === '3') {
        await updateLastMovedTimestamp(rl, redis);
      } else if (choiceNum === '4') {
        console.log('\n👋 Goodbye!');
        rl.close();
        redis.disconnect();
        process.exit(0);
      } else {
        console.log('❌ Invalid choice. Please enter 1, 2, 3, or 4.');
        continue;
      }

      const again = await question(rl, '\nWould you like to do another? (y/n): ');
      if (again.trim().toLowerCase() !== 'y') {
        console.log('\n👋 Goodbye!');
        break;
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    rl.close();
    redis.disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
