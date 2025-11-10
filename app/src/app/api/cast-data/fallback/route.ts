/** biome-ignore-all lint/suspicious/noExplicitAny: see ts-ignore below */
import { NextResponse } from 'next/server';
import { APP_URL } from '@/lib/constants';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const originalHash = searchParams.get('originalHash');
  const strategy = searchParams.get('strategy'); // 'choochoo' or 'recent'

  if (!NEYNAR_API_KEY) {
    return NextResponse.json({ error: 'Neynar API key not configured' }, { status: 500 });
  }

  try {
    // Get current holder to know whose casts to search
    const holderResponse = await fetch(`${APP_URL}/api/current-holder`);
    const holderData = await holderResponse.json();

    if (!holderData.hasCurrentHolder) {
      return NextResponse.json({ error: 'No current holder found' }, { status: 404 });
    }

    const currentHolderFid = holderData.currentHolder.fid;
    console.log(
      `[cast-data/fallback] Searching for ${strategy} cast for FID ${currentHolderFid}, original hash: ${originalHash}`,
    );

    if (strategy === 'choochoo') {
      // Strategy 1: Search for ChooChoo-related casts
      const searchQueries = ['@choochoo', 'ChooChoo', 'Choo Choo', 'Choo-Choo', 'choo'];

      // Try each search query
      for (const query of searchQueries) {
        try {
          const searchResponse = await fetch(
            `https://api.neynar.com/v2/farcaster/cast/search?q=${encodeURIComponent(query)}&author_fid=${currentHolderFid}&limit=10`,
            {
              headers: { 'x-api-key': NEYNAR_API_KEY },
            },
          );

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const casts = searchData.result?.casts || [];

            if (casts.length > 0) {
              console.log(`[cast-data/fallback] Found ${casts.length} casts for query "${query}"`);
              return NextResponse.json({
                cast: casts[0], // Most recent matching cast
                fallbackUsed: true,
                strategy: 'choochoo',
                query: query,
              });
            }
          }
        } catch (queryError) {
          console.log(`[cast-data/fallback] Query "${query}" failed:`, queryError);
        }
      }

      // Also check for casts with APP_URL as embed
      try {
        const userCastsResponse = await fetch(
          `https://api.neynar.com/v2/farcaster/cast/search?author_fid=${currentHolderFid}&limit=20`,
          {
            headers: { 'x-api-key': NEYNAR_API_KEY },
          },
        );

        if (userCastsResponse.ok) {
          const userCastsData = await userCastsResponse.json();
          const casts = userCastsData.result?.casts || [];

          // Look for casts with APP_URL in embeds
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const castWithAppUrl = casts.find((cast: any) =>
            cast.embeds?.some(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (embed: any) =>
                embed.url && (embed.url.includes(APP_URL) || embed.url.includes('choochoo.pro')),
            ),
          );

          if (castWithAppUrl) {
            console.log(`[cast-data/fallback] Found cast with APP_URL embed`);
            return NextResponse.json({
              cast: castWithAppUrl,
              fallbackUsed: true,
              strategy: 'choochoo',
              query: 'app_url_embed',
            });
          }
        }
      } catch (embedError) {
        console.log('[cast-data/fallback] APP_URL embed search failed:', embedError);
      }

      return NextResponse.json({ error: 'No ChooChoo-related casts found' }, { status: 404 });
    }

    if (strategy === 'recent') {
      // Strategy 2: Get most recent cast from user
      try {
        const recentResponse = await fetch(
          `https://api.neynar.com/v2/farcaster/cast/search?author_fid=${currentHolderFid}&limit=1`,
          {
            headers: { 'x-api-key': NEYNAR_API_KEY },
          },
        );

        if (recentResponse.ok) {
          const recentData = await recentResponse.json();
          const casts = recentData.result?.casts || [];

          if (casts.length > 0) {
            console.log(`[cast-data/fallback] Found most recent cast`);
            return NextResponse.json({
              cast: casts[0],
              fallbackUsed: true,
              strategy: 'recent',
            });
          }
        }
      } catch (recentError) {
        console.error('[cast-data/fallback] Recent cast search failed:', recentError);
      }

      return NextResponse.json({ error: 'No recent casts found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Invalid strategy' }, { status: 400 });
  } catch (error) {
    console.error('[cast-data/fallback] Fallback search failed:', error);
    return NextResponse.json({ error: 'Fallback search failed' }, { status: 500 });
  }
}
