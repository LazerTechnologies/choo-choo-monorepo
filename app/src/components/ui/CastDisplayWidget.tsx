'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/base/Card';
import { Typography } from '@/components/base/Typography';
import { Button } from '@/components/base/Button';
import { CastCard } from '@neynar/react';
import { sdk } from '@farcaster/miniapp-sdk';
import axios from 'axios';

interface CastDisplayWidgetProps {
  castHash: string;
  className?: string;
}

// Use the same interfaces as the API for consistency
interface NeynarUser {
  object: string;
  fid: number;
  username: string;
  display_name: string;
  custody_address: string;
  pfp_url: string;
  power_badge: boolean;
  follower_count: number;
  following_count: number;
}

interface NeynarChannel {
  id: string;
  name: string;
  object: string;
  image_url: string;
  url?: string;
  description?: string;
}

interface NeynarEmbed {
  cast_id?: {
    fid: number;
    hash: string;
  };
  cast?: {
    object: string;
    hash: string;
    author: NeynarUser;
    text: string;
    timestamp: string;
  };
  url?: string;
}

interface NeynarReaction {
  fid: number;
  fname: string;
}

interface CastData {
  object: string;
  hash: string;
  author: NeynarUser;
  text: string;
  timestamp: string;
  embeds: NeynarEmbed[];
  reactions: {
    likes: NeynarReaction[];
    recasts: NeynarReaction[];
    likes_count: number;
    recasts_count: number;
  };
  replies: {
    count: number;
  };
  channel?: NeynarChannel;
}

export function CastDisplayWidget({ castHash, className = '' }: CastDisplayWidgetProps) {
  const [castData, setCastData] = useState<CastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!castHash) {
      setLoading(false);
      return;
    }

    const fetchCastData = async () => {
      try {
        setLoading(true);

        // Step 1: Try original cast hash
        try {
          const response = await axios.get(`/api/cast-data?hash=${castHash}`);
          setCastData(response.data.cast);
          return; // Success, exit early
        } catch (originalError) {
          console.log(
            '[CastDisplayWidget] Original cast failed, trying fallbacks...',
            originalError,
          );
        }

        // Step 2: Try fallback search for ChooChoo-related casts
        try {
          const fallbackResponse = await axios.get(
            `/api/cast-data/fallback?originalHash=${castHash}&strategy=choochoo`,
          );
          setCastData(fallbackResponse.data.cast);
          console.log(
            '[CastDisplayWidget] Using ChooChoo fallback cast:',
            fallbackResponse.data.cast.hash,
          );
          return; // Success, exit early
        } catch (choochooError) {
          console.log(
            '[CastDisplayWidget] ChooChoo fallback failed, trying most recent...',
            choochooError,
          );
        }

        // Step 3: Try most recent cast as last resort
        try {
          const lastResortResponse = await axios.get(
            `/api/cast-data/fallback?originalHash=${castHash}&strategy=recent`,
          );
          setCastData(lastResortResponse.data.cast);
          console.log(
            '[CastDisplayWidget] Using most recent cast fallback:',
            lastResortResponse.data.cast.hash,
          );
          return; // Success, exit early
        } catch (recentError) {
          console.error('[CastDisplayWidget] All fallback strategies failed:', recentError);
          setError('No casts available to display');
        }
      } catch (err) {
        console.error('[CastDisplayWidget] Unexpected error in fetchCastData:', err);
        setError('Failed to load cast');
      } finally {
        setLoading(false);
      }
    };

    fetchCastData();
  }, [castHash]);

  if (loading) {
    return (
      <Card
        className={`p-4 !bg-purple-500 !border-white ${className}`}
        style={{ backgroundColor: '#a855f7' }}
      >
        <div className="animate-pulse">
          <div className="h-4 bg-purple-300 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-purple-300 rounded w-1/2"></div>
        </div>
      </Card>
    );
  }

  if (error || !castData) {
    return (
      <Card
        className={`p-4 !bg-purple-500 !border-white ${className}`}
        style={{ backgroundColor: '#a855f7' }}
      >
        <Typography variant="body" className="!text-white">
          {error || 'Cast not found'}
        </Typography>
      </Card>
    );
  }

  // Transform the cast data to match CastCard props
  const transformedEmbeds = castData.embeds.map((embed) => ({
    url: embed.url || '',
  }));

  const handleRecastAndShare = async () => {
    try {
      const castUrl = `https://farcaster.xyz/${castData.author.username}/${castHash.slice(0, 10)}`;
      await sdk.actions.composeCast({
        text: `Got @choochoo FOMO? Reply to @${castData.author.username}'s cast and let the world know 🚂`,
        embeds: [castUrl],
      });
    } catch (error) {
      console.error('[CastDisplayWidget] Failed to compose "recast and share" cast:', error);
    }
  };

  return (
    <Card
      className={`p-4 !bg-purple-500 !border-white ${className}`}
      style={{ backgroundColor: '#a855f7' }}
    >
      <div
        className="border border-white rounded-lg overflow-hidden cursor-pointer hover:bg-purple-600 transition-colors"
        onClick={() => {
          const castUrl = `https://farcaster.xyz/${castData.author.username}/${castHash.slice(0, 10)}`;
          window.open(castUrl, '_blank');
        }}
        title="Click to view on Farcaster"
      >
        <CastCard
          hash={castHash}
          avatarImgUrl={castData.author.pfp_url}
          appAvatarImgUrl=""
          channel={
            castData.channel
              ? {
                  id: castData.channel.id,
                  name: castData.channel.name,
                  url:
                    castData.channel.url ||
                    `https://farcaster.xyz/~/channel/${castData.channel.id}`,
                }
              : undefined
          }
          displayName={castData.author.display_name}
          embeds={transformedEmbeds}
          frames={[]}
          hasPowerBadge={castData.author.power_badge}
          isOwnProfile={false}
          allowReactions={false}
          reactions={{
            likes: castData.reactions.likes || [],
            likes_count: castData.reactions.likes_count,
            recasts: castData.reactions.recasts || [],
            recasts_count: castData.reactions.recasts_count,
          }}
          renderEmbeds={true}
          renderFrames={false}
          replies={castData.replies.count}
          text={castData.text}
          timestamp={castData.timestamp}
          username={castData.author.username}
          viewerFid={0}
        />
      </div>

      {/* Recast and Share Button */}
      <div className="mt-4 flex justify-center">
        <Button
          onClick={handleRecastAndShare}
          className="!text-white hover:!text-white !bg-purple-500 !border-2 !border-white px-6 py-2"
          style={{ backgroundColor: '#a855f7' }}
        >
          <Typography variant="small" className="!text-white">
            Recast and Share
          </Typography>
        </Button>
      </div>
    </Card>
  );
}
