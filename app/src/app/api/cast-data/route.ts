import { NextRequest, NextResponse } from 'next/server';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

// TypeScript interfaces for the Neynar API response
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
  verifications: string[];
  verified_addresses: {
    eth_addresses: string[];
    sol_addresses: string[];
  };
  profile: {
    bio: {
      text: string;
    };
  };
}

interface NeynarChannel {
  id: string;
  name: string;
  object: string;
  image_url: string;
  url?: string;
  description?: string;
  viewer_context?: {
    following: boolean;
    role: string;
  };
}

interface NeynarEmbed {
  cast_id?: {
    fid: number;
    hash: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cast?: any;
  url?: string;
}

interface NeynarFrame {
  version: string;
  image: string;
  frames_url: string;
  buttons: Array<{
    title: string;
    index: number;
    action_type: string;
    target?: string;
    post_url?: string;
  }>;
  post_url: string;
  title: string;
  image_aspect_ratio: string;
  input?: {
    text: string;
  };
  state?: {
    serialized: string;
  };
}

interface NeynarReaction {
  fid: number;
  fname: string;
}

interface NeynarCast {
  object: string;
  hash: string;
  parent_hash?: string;
  parent_url?: string;
  root_parent_url?: string;
  parent_author?: {
    fid: number;
  };
  author: NeynarUser;
  app?: {
    object: string;
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
    custody_address: string;
  };
  text: string;
  timestamp: string;
  embeds: NeynarEmbed[];
  type?: string;
  frames: NeynarFrame[];
  reactions: {
    likes: NeynarReaction[];
    recasts: NeynarReaction[];
    likes_count: number;
    recasts_count: number;
  };
  replies: {
    count: number;
  };
  thread_hash?: string;
  mentioned_profiles: NeynarUser[];
  mentioned_profiles_ranges: Array<{
    start: number;
    end: number;
  }>;
  mentioned_channels: NeynarChannel[];
  mentioned_channels_ranges: Array<{
    start: number;
    end: number;
  }>;
  channel?: NeynarChannel;
  viewer_context?: {
    liked: boolean;
    recasted: boolean;
  };
  author_channel_context?: {
    following: boolean;
    role: string;
  };
}

interface NeynarCastResponse {
  cast: NeynarCast;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get('hash');

  if (!hash) {
    return NextResponse.json({ error: 'Hash parameter is required' }, { status: 400 });
  }

  if (!NEYNAR_API_KEY) {
    return NextResponse.json({ error: 'Neynar API key not configured' }, { status: 500 });
  }

  try {
    // Use the proper Neynar API URL format with identifier and type parameters
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/cast/?identifier=${hash}&type=hash`,
      {
        headers: {
          accept: 'application/json',
          'x-api-key': NEYNAR_API_KEY,
          'x-neynar-experimental': 'false',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Neynar API error (${response.status}):`, errorText);
      throw new Error(`Failed to fetch cast data from Neynar: ${response.status}`);
    }

    const data: NeynarCastResponse = await response.json();

    // Validate that we got a cast object
    if (!data.cast || !data.cast.hash) {
      throw new Error('Invalid cast data received from Neynar');
    }

    return NextResponse.json({ cast: data.cast });
  } catch (error) {
    console.error('Error fetching cast data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch cast data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
