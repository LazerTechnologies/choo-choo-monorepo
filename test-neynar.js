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
  const testFid = process.argv[2] || '377557'; // Default to your FID if no argument provided

  console.log(`🔍 Testing Neynar Bulk API with FID: ${testFid}`);
  console.log('='.repeat(50));

  try {
    // Test: Bulk user fetch with single FID
    console.log('\n📋 Bulk User API with Single FID');
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

    console.log(`📊 Status: ${bulkResponse.status} ${bulkResponse.statusText}`);

    if (!bulkResponse.ok) {
      const errorText = await bulkResponse.text();
      console.log(`❌ Error Response: ${errorText}`);
      return;
    }

    const bulkData = await bulkResponse.json();
    console.log('\n✅ Full Bulk Response:');
    console.log(JSON.stringify(bulkData, null, 2));

    // Extract key wallet info from bulk response
    const users = bulkData?.users || [];
    if (users.length > 0) {
      const user = users[0]; // First (and only) user
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

      // Analyze verified addresses structure
      if (user.verified_addresses) {
        console.log('\n🎯 Verified Addresses Breakdown:');
        const { eth_addresses, sol_addresses, primary } =
          user.verified_addresses;
        console.log(`- ETH Addresses: ${JSON.stringify(eth_addresses || [])}`);
        console.log(`- SOL Addresses: ${JSON.stringify(sol_addresses || [])}`);
        console.log(`- Primary: ${JSON.stringify(primary || {})}`);

        // Show what our current API would return
        const firstEthAddress = eth_addresses?.[0];
        if (firstEthAddress) {
          console.log('\n🎯 Our current API would return:');
          console.log(
            JSON.stringify(
              {
                fid: user.fid,
                address: firstEthAddress,
                type: 'verification',
              },
              null,
              2
            )
          );
        } else {
          console.log(
            '\n❌ Our current API would return 404 (no ETH addresses)'
          );
          if (sol_addresses?.[0]) {
            console.log(`   But user has SOL address: ${sol_addresses[0]}`);
          }
        }
      }

      // Compare with verifications array (legacy format)
      const legacyVerifications = user?.verifications ?? [];
      if (legacyVerifications.length > 0) {
        console.log('\n📜 Legacy Verifications Array:');
        console.log(`- First verification: ${legacyVerifications[0]}`);
        console.log(
          `- All verifications: ${JSON.stringify(legacyVerifications)}`
        );
      }
    } else {
      console.log('\n❌ No users found in response');
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
    fids.push('377557'); // Default to your FID
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
