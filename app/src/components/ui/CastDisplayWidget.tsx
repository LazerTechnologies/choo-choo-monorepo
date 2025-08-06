'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/base/Card';
import { Typography } from '@/components/base/Typography';
import { CastCard } from '@neynar/react';
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
        const response = await axios.get(`/api/cast-data?hash=${castHash}`);
        setCastData(response.data.cast);
      } catch (err) {
        console.error('Error fetching cast data:', err);
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

  return (
    <Card
      className={`p-4 !bg-purple-500 !border-white ${className}`}
      style={{ backgroundColor: '#a855f7' }}
    >
      <div className="space-y-3">
        <Typography variant="h4" className="!text-white font-comic">
          Current Announcement Cast
        </Typography>

        <div
          className="border border-white rounded-lg overflow-hidden cursor-pointer hover:bg-purple-600 transition-colors"
          onClick={() => {
            const castUrl = `https://warpcast.com/${castData.author.username}/${castHash.slice(0, 10)}`;
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
                      `https://warpcast.com/~/channel/${castData.channel.id}`,
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
      </div>
    </Card>
  );
}
