import { NextRequest } from 'next/server';
import { CURRENT_HOLDER_CHANNEL, redisSub } from '@/lib/kv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sub = redisSub.duplicate();
      
      sub.on('error', (err) => {
        console.warn('[Redis Stream] Subscription error:', err.message);
      });

      sub.on('connect', () => {
        console.log('[Redis Stream] Subscription connected');
      });

      sub.on('ready', () => {
        console.log('[Redis Stream] Subscription ready');
      });

      await sub.subscribe(CURRENT_HOLDER_CHANNEL);

      // Initial handshake + heartbeat
      controller.enqueue(encoder.encode(':ok\n\n'));
      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(':hb\n\n')), 15000);

      sub.on('message', (_channel, message) => {
        controller.enqueue(encoder.encode(`data: ${message}\n\n`));
      });

      const close = () => {
        clearInterval(heartbeat);
        sub
          .unsubscribe(CURRENT_HOLDER_CHANNEL)
          .catch(() => {})
          .finally(() => sub.quit().catch(() => {}));
        try {
          controller.close();
        } catch {}
      };

      req.signal?.addEventListener('abort', close);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    },
  });
}
