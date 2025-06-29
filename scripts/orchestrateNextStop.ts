/**
 * Backend orchestration script for the ChooChooTrain NFT drop.
 *
 * - Fetches cast replies and reactions from Neynar
 * - Selects the winner
 * - Composes NFT metadata and image
 * - Uploads to Pinata
 * - Calls nextStop via internal API
 *
 * @todo: NFT image composition logic
 * @todo: error handling, retries, logging
 * @todo: integrate with a scheduler or cron
 */

import fetch from 'node-fetch';
import FormData from 'form-data';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!;
const INTERNAL_SECRET = process.env.INTERNAL_SECRET!;
const PINATA_MINT_URL =
  process.env.PINATA_MINT_URL || 'http://localhost:3000/api/pinata/mint';
const NEXT_STOP_URL =
  process.env.NEXT_STOP_URL || 'http://localhost:3000/api/next-stop';

async function orchestrateNextStop(castId: string) {
  try {
    // 1. Fetch replies to the cast
    const repliesRes = await fetch(
      `https://api.neynar.com/v2/farcaster/cast/replies?cast_hash=${castId}&limit=100`,
      {
        headers: { 'x-api-key': NEYNAR_API_KEY },
      }
    );
    const repliesData = await repliesRes.json();
    const replies = repliesData.result?.casts || [];
    if (replies.length === 0) throw new Error('No replies found');

    // 2. For each reply, fetch like count
    let winner = null;
    let maxReactions = -1;
    for (const reply of replies) {
      const reactionsRes = await fetch(
        `https://api.neynar.com/v2/farcaster/cast/reactions?cast_hash=${reply.hash}`,
        { headers: { 'x-api-key': NEYNAR_API_KEY } }
      );
      const reactionsData = await reactionsRes.json();
      const likes = reactionsData.result?.likes?.length || 0;
      const recasts = reactionsData.result?.recasts?.length || 0;
      const totalReactions = likes + recasts;
      if (totalReactions > maxReactions) {
        maxReactions = totalReactions;
        winner = reply;
      }
    }
    if (!winner) throw new Error('No winner found');
    const winnerFid = winner.author.fid;

    // 3. Get winner's wallet address from Neynar
    const userRes = await fetch(
      `https://api.neynar.com/v2/farcaster/user?fid=${winnerFid}`,
      {
        headers: { 'x-api-key': NEYNAR_API_KEY },
      }
    );
    const userData = await userRes.json();
    const winnerAddress = userData.result?.user?.custody_address;
    if (!winnerAddress) throw new Error('No winner address found');

    // 4. Compose NFT metadata and image
    // @todo: Implement actual image composition logic
    const imageBuffer = Buffer.from('TODO: generate image', 'utf-8');
    const formData = new FormData();
    formData.append('image', imageBuffer, {
      filename: 'ticket.png',
      contentType: 'image/png',
    });
    formData.append('name', 'ChooChooTrain Ticket');
    formData.append('description', 'A stamped ChooChooTrain ticket.');
    formData.append(
      'attributes',
      JSON.stringify([{ trait_type: 'WinnerFID', value: String(winnerFid) }])
    );

    // 5. Upload to Pinata
    const mintRes = await fetch(PINATA_MINT_URL, {
      method: 'POST',
      body: formData as any,
      // @todo: Add internal secret or session if needed
    });
    const mintData = await mintRes.json();
    if (!mintRes.ok) throw new Error(mintData.error || 'Pinata mint failed');
    const { tokenURI } = mintData;

    // 6. Call nextStop
    const nextStopRes = await fetch(NEXT_STOP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET,
      },
      body: JSON.stringify({ recipient: winnerAddress, tokenURI }),
    });
    const nextStopData = await nextStopRes.json();
    if (!nextStopRes.ok)
      throw new Error(nextStopData.error || 'nextStop failed');

    console.log('Next stop successful:', nextStopData);
  } catch (error) {
    // @todo: Add error logging/alerting
    console.error('Orchestration failed:', error);
  }
}

// @todo: Integrate with scheduler/cron and pass the correct castId
// Example usage:
// orchestrateNextStop('CAST_ID_HERE');
