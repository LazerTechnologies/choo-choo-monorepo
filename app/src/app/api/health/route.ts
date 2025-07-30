import { NextResponse } from 'next/server';
import { redis } from '@/lib/kv';

export async function GET() {
  const response = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      app: 'running',
      redis: 'unknown',
    },
  };

  // Test Redis connection (don't fail health check if Redis is down)
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      await redis.ping();
      response.services.redis = 'connected';
    } else {
      response.services.redis = 'not_configured';
    }
  } catch (error) {
    // Redis is down but app is still healthy
    response.services.redis = 'disconnected';
    console.warn(
      'Redis health check failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }

  // Always return 200 for health check unless the app itself is broken
  return NextResponse.json(response, { status: 200 });
}
