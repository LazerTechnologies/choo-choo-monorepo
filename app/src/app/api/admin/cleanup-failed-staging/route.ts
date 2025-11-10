import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { stagingLog } from '@/lib/event-log';
import { redis } from '@/lib/kv';
import { listStagingEntries } from '@/lib/staging-manager';

/**
 * DELETE /api/admin/cleanup-failed-staging
 *
 * Admin endpoint to immediately clean up all failed staging entries.
 * Use this to quickly clear failed staging entries instead of waiting for TTL.
 */
export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const entries = await listStagingEntries();
    const failedEntries = entries.filter((entry) => entry.status === 'failed');

    let deletedCount = 0;
    const errors: Array<{ tokenId: number; error: string }> = [];

    for (const entry of failedEntries) {
      try {
        const key = `staging:${entry.tokenId}`;
        await redis.del(key);
        deletedCount++;
        stagingLog.info('lifecycle.abandoned', {
          tokenId: entry.tokenId,
          msg: 'Failed staging entry deleted by admin cleanup',
          adminFid: auth.adminFid,
        });
      } catch (error) {
        errors.push({
          tokenId: entry.tokenId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        stagingLog.error('lifecycle.abandoned', {
          tokenId: entry.tokenId,
          error,
          msg: 'Failed to delete failed staging entry',
        });
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      totalFailed: failedEntries.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Deleted ${deletedCount} failed staging entries`,
    });
  } catch (error) {
    stagingLog.error('lifecycle.abandoned', {
      error,
      msg: 'Failed to cleanup failed staging entries',
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
