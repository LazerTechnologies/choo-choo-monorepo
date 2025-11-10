import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { apiLog } from '@/lib/event-log';
import { redis } from '@/lib/kv';
import { REDIS_KEYS } from '@/lib/redis-token-utils';

/**
 * POST /api/admin/repair-corrupted-tokens
 *
 * Admin endpoint to detect and repair corrupted token data in Redis.
 * Corrupted data usually has malformed JSON that can't be parsed.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const tokenIds: number[] = body?.tokenIds || [];
    const action: 'detect' | 'delete' = body?.action || 'detect';

    if (tokenIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'tokenIds array is required' },
        { status: 400 },
      );
    }

    const results: Array<{
      tokenId: number;
      status: 'valid' | 'corrupted' | 'missing' | 'deleted';
      rawData?: string;
      error?: string;
    }> = [];

    for (const tokenId of tokenIds) {
      const key = REDIS_KEYS.token(tokenId);

      try {
        const data = await redis.get(key);

        if (!data) {
          results.push({
            tokenId,
            status: 'missing',
          });
          continue;
        }

        // Try to parse the JSON
        try {
          JSON.parse(data);
          results.push({
            tokenId,
            status: 'valid',
          });
        } catch (parseError) {
          // JSON is corrupted
          if (action === 'delete') {
            await redis.del(key);
            results.push({
              tokenId,
              status: 'deleted',
              rawData: data.substring(0, 100), // First 100 chars for debugging
              error: parseError instanceof Error ? parseError.message : 'Failed to parse JSON',
            });
          } else {
            results.push({
              tokenId,
              status: 'corrupted',
              rawData: data.substring(0, 100), // First 100 chars for debugging
              error: parseError instanceof Error ? parseError.message : 'Failed to parse JSON',
            });
          }
        }
      } catch (error) {
        results.push({
          tokenId,
          status: 'corrupted',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const summary = {
      total: results.length,
      valid: results.filter((r) => r.status === 'valid').length,
      corrupted: results.filter((r) => r.status === 'corrupted').length,
      missing: results.filter((r) => r.status === 'missing').length,
      deleted: results.filter((r) => r.status === 'deleted').length,
    };

    apiLog.info('admin-repair-corrupted-tokens.success', {
      action,
      summary,
      msg:
        action === 'delete'
          ? `Deleted ${summary.deleted} corrupted token entries`
          : `Found ${summary.corrupted} corrupted token entries`,
    });

    return NextResponse.json({
      success: true,
      action,
      summary,
      results,
      message:
        action === 'delete'
          ? `Deleted ${summary.deleted} corrupted token entries`
          : `Found ${summary.corrupted} corrupted token entries`,
    });
  } catch (error) {
    apiLog.error('admin-repair-corrupted-tokens.failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      msg: 'Error repairing corrupted tokens',
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
