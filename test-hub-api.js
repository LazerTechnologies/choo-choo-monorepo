#!/usr/bin/env node

// Load environment variables from .env files
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed, try to load manually
  const fs = require('fs');

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

async function testHubAPI(testFid) {
  console.log(`🔍 Testing Neynar Hub API with FID: ${testFid}`);
  console.log('='.repeat(50));

  try {
    // Test Hub API - Verifications
    console.log('\n📋 Hub API - Verifications');
    console.log(
      `GET https://hub-api.neynar.com/v1/verificationsByFid?fid=${testFid}`
    );

    const verificationsResponse = await fetch(
      `https://hub-api.neynar.com/v1/verificationsByFid?fid=${testFid}`,
      {
        headers: {
          'x-api-key': NEYNAR_API_KEY,
        },
      }
    );

    console.log(
      `📊 Status: ${verificationsResponse.status} ${verificationsResponse.statusText}`
    );

    if (!verificationsResponse.ok) {
      const errorText = await verificationsResponse.text();
      console.log(`❌ Error Response: ${errorText}`);
      return;
    }

    const verificationsData = await verificationsResponse.json();
    console.log('\n✅ Verifications Response:');
    console.log(JSON.stringify(verificationsData, null, 2));

    // Extract Ethereum addresses from verifications
    const verifications = verificationsData?.messages || [];
    console.log(`\n📝 Found ${verifications.length} verification messages`);

    const ethAddresses = verifications
      .filter((msg) => {
        console.log(`  - Message type: ${msg?.data?.type}`);
        console.log(
          `  - Protocol: ${msg?.data?.verificationAddAddressBody?.protocol}`
        );
        return (
          msg?.data?.type === 'MESSAGE_TYPE_VERIFICATION_ADD_ETH_ADDRESS' &&
          msg?.data?.verificationAddAddressBody?.protocol ===
            'PROTOCOL_ETHEREUM'
        );
      })
      .map((msg) => {
        const address = msg?.data?.verificationAddAddressBody?.address;
        console.log(`  - Address: ${address}`);
        return address;
      })
      .filter((addr) => addr);

    console.log('\n🔑 Extracted ETH Addresses:');
    console.log(ethAddresses);

    // Test fallback - Regular API for custody address
    console.log('\n📋 Fallback - Regular API for custody address');
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

    let custodyAddress = null;
    if (userResponse.ok) {
      const userData = await userResponse.json();
      const user = userData?.result?.user;
      if (user) {
        custodyAddress = user.custody_address;
        console.log(`✅ Custody Address: ${custodyAddress}`);
      }
    } else {
      console.log(`❌ User API failed: ${userResponse.status}`);
    }

    // Show what our API would return
    console.log('\n🎯 Our API would return:');
    if (ethAddresses.length > 0) {
      const result = {
        fid: parseInt(testFid),
        address: ethAddresses[0],
        type: 'verification',
      };
      console.log(JSON.stringify(result, null, 2));
    } else if (custodyAddress) {
      const result = {
        fid: parseInt(testFid),
        address: custodyAddress,
        type: 'custody',
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('{ "error": "User has no valid wallet address" }');
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
    fids.push('1'); // Default to FID 1 if no argument provided
  }

  for (const fid of fids) {
    await testHubAPI(fid);
    if (fids.length > 1) {
      console.log('\n' + '='.repeat(80) + '\n');
    }
  }
}

// Run the test
testMultipleFids().catch(console.error);
