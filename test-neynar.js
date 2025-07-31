#!/usr/bin/env node

// Load environment variables from .env files
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed, try to load manually
  const fs = require('fs');
  const path = require('path');

  try {
    const envFile = fs.readFileSync('.env', 'utf8');
    envFile.split('\n').forEach((line) => {
      const [key, ...valueParts] = line.split('=');
      if (key && !key.startsWith('#') && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (value && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  } catch (e) {
    // No .env file or can't read it
  }
}

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

if (!NEYNAR_API_KEY) {
  console.error('❌ NEYNAR_API_KEY environment variable is required');
  console.error("   Make sure it's set in your .env file or environment");
  process.exit(1);
}

async function testNeynarAPI() {
  const testFid = process.argv[2] || '3'; // Default to FID 3 (dan) if no argument provided

  console.log(`🔍 Testing Neynar API with FID: ${testFid}`);
  console.log('='.repeat(50));

  try {
    // Test 1: Single user fetch
    console.log('\n📋 Test 1: Single User Fetch');
    console.log(`GET https://api.neynar.com/v2/farcaster/user?fid=${testFid}`);

    const userResponse = await fetch(
      `https://api.neynar.com/v2/farcaster/user?fid=${testFid}`,
      {
        headers: {
          accept: 'application/json',
          'x-api-key': NEYNAR_API_KEY,
        },
      }
    );

    if (!userResponse.ok) {
      throw new Error(
        `HTTP ${userResponse.status}: ${userResponse.statusText}`
      );
    }

    const userData = await userResponse.json();
    console.log('\n✅ Full Response:');
    console.log(JSON.stringify(userData, null, 2));

    // Extract key wallet info
    const user = userData?.result?.user;
    if (user) {
      console.log('\n🔑 Wallet Information:');
      console.log(`- Username: ${user.username}`);
      console.log(`- Display Name: ${user.display_name}`);
      console.log(`- FID: ${user.fid}`);
      console.log(`- Custody Address: ${user.custody_address}`);
      console.log(
        `- Verifications: ${JSON.stringify(user.verifications || [])}`
      );
      console.log(
        `- Verified Addresses: ${JSON.stringify(user.verified_addresses || {})}`
      );

      // Show what our API would return
      const verifications = user?.verifications ?? [];
      const primaryWallet = verifications[0] || user?.custody_address;
      const addressType = verifications[0] ? 'verification' : 'custody';

      console.log('\n🎯 Our API would return:');
      console.log(
        JSON.stringify(
          {
            fid: user.fid,
            address: primaryWallet,
            type: addressType,
          },
          null,
          2
        )
      );
    }

    // Test 2: Bulk user fetch (for comparison)
    console.log('\n📋 Test 2: Bulk User Fetch');
    console.log(
      `GET https://api.neynar.com/v2/farcaster/user/bulk?fids=${testFid}`
    );

    const bulkResponse = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${testFid}`,
      {
        headers: {
          accept: 'application/json',
          'x-api-key': NEYNAR_API_KEY,
        },
      }
    );

    if (bulkResponse.ok) {
      const bulkData = await bulkResponse.json();
      console.log('\n✅ Bulk Response:');
      console.log(JSON.stringify(bulkData, null, 2));
    } else {
      console.log(`❌ Bulk request failed: ${bulkResponse.status}`);
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Test with multiple FIDs if provided
async function testMultipleFids() {
  const fids = process.argv.slice(2);
  if (fids.length === 0) {
    fids.push('3'); // Default to dan's FID
  }

  for (const fid of fids) {
    await testNeynarAPI(fid);
    if (fids.length > 1) {
      console.log('\n' + '='.repeat(80) + '\n');
    }
  }
}

// Run the test
testMultipleFids().catch(console.error);
