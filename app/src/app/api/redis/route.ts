import { type NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/kv';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const key = searchParams.get('key');
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 });

  if (action === 'read') {
    const value = await redis.get(key);
    return NextResponse.json({ value });
  }
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const { action, key, value } = await req.json();
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 });

  if (action === 'write') {
    await redis.set(key, value ?? 'test-value');
    return NextResponse.json({ value: value ?? 'test-value' });
  }
  if (action === 'delete') {
    await redis.del(key);
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
