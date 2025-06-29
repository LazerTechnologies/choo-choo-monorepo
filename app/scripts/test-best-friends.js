// test script to fetch best friends for a fid
import fetch from 'node-fetch';

const apiKey = process.env.NEYNAR_API_KEY;
const fid = 377557;
const limit = 3;

if (!apiKey) {
  console.error('Error: NEYNAR_API_KEY environment variable is not set.');
  process.exit(1);
}

async function getBestFriends(fid) {
  const url = `https://api.neynar.com/v2/farcaster/user/best_friends?fid=${fid}&limit=${limit}`;
  const response = await fetch(url, {
    headers: { 'x-api-key': apiKey },
  });

  if (!response.ok) {
    throw new Error(`Neynar API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

getBestFriends(fid).catch((err) => {
  console.error('Failed to fetch best friends:', err);
  process.exit(1);
});
