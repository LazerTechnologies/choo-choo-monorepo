#!/usr/bin/env node

/**
 * Script to manually fix Redis token data for testing
 * Run with: node scripts/fix-redis-token-data.js
 */

const Redis = require('ioredis');

// You'll need to update these values with your actual data
const TOKEN_1_DATA = {
  tokenId: 1,
  imageHash: 'YOUR_IMAGE_HASH_FROM_PINATA', // Get this from Pinata
  metadataHash: 'YOUR_METADATA_HASH_FROM_PINATA', // Get this from Pinata
  tokenURI: 'ipfs://YOUR_METADATA_HASH_FROM_PINATA',
  holderAddress: 'YOUR_ETH_ADDRESS', // Your wallet address
  holderUsername: 'jonbray.eth', // Your username
  holderFid: YOUR_FID, // Your FID number
  holderDisplayName: 'YOUR_DISPLAY_NAME', // Your display name
  holderPfpUrl: 'YOUR_PFP_URL', // Your profile picture URL
  transactionHash: 'YOUR_TX_HASH', // The transaction hash from the mint
  timestamp: '2025-01-01T04:13:00.000Z', // Approximate time of the mint
  attributes: [
    { trait_type: 'Passenger', value: 'jonbray.eth' },
    { trait_type: 'Ticket Number', value: 1 },
    { trait_type: 'Station', value: 'Base Station' },
    { trait_type: 'Journey Type', value: 'Manual Send' },
  ],
  sourceType: 'send-train',
  sourceCastHash: null,
  totalEligibleReactors: 1,
};

const CURRENT_TOKEN_TRACKER = {
  currentTokenId: 1,
  lastUpdated: new Date().toISOString(),
};

async function fixRedisData() {
  // Connect to Redis (adjust connection string as needed)
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  try {
    console.log('🔧 Fixing Redis token data...');

    // Store token 1 data
    await redis.set('token1', JSON.stringify(TOKEN_1_DATA));
    console.log('✅ Added token1 data');

    // Update current token ID tracker
    await redis.set('current-token-id', JSON.stringify(CURRENT_TOKEN_TRACKER));
    console.log('✅ Updated current-token-id tracker');

    // Verify the data was stored
    const storedToken = await redis.get('token1');
    const storedTracker = await redis.get('current-token-id');

    console.log('\n📊 Verification:');
    console.log('Token 1 data:', JSON.parse(storedToken));
    console.log('Current token tracker:', JSON.parse(storedTracker));

    console.log('\n🎉 Redis data fixed! The journey timeline should now show your ride.');
  } catch (error) {
    console.error('❌ Error fixing Redis data:', error);
  } finally {
    await redis.disconnect();
  }
}

// Run the script
fixRedisData();
