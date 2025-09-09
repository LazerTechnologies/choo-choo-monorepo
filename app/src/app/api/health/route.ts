import { NextResponse } from 'next/server';
import { redis } from '@/lib/kv';
import { scheduler } from '@/lib/scheduler';

export async function GET() {
  const response = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      app: 'running',
      redis: 'unknown',
      scheduler: 'unknown',
    },
  };

  // Test Redis connection (don't fail health check if Redis is down)
  try {
    if (process.env.REDIS_PRIVATE_URL || process.env.REDIS_URL) {
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

  // initialize scheduler for yoink notifications
  try {
    scheduler.initialize();
    response.services.scheduler = 'running';
  } catch (error) {
    response.services.scheduler = 'failed';
    console.warn(
      'Scheduler initialization failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }

  // Always return 200 for health check unless the app itself is broken
  return NextResponse.json(response, { status: 200 });
}
