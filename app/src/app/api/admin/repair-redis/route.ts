import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { repairRedisTokenSync } from '@/scripts/repair-redis-token-sync';

/**
 * POST /api/admin/repair-redis
 *
 * Admin endpoint to run the Redis token sync repair script
 * Repairs inconsistencies between on-chain token data and Redis cache
 */
export async function POST(request: Request) {
  try {
    // Admin authentication
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    console.log(`[admin-repair-redis] 🛡️ Admin repair request from FID: ${auth.adminFid}`);

    // Parse request body for dry run option
    let isDryRun = false;
    try {
      const body = await request.json();
      isDryRun = body.dryRun === true;
    } catch {
      // Default to dry run if no body or parsing fails
      isDryRun = true;
    }

    console.log(`[admin-repair-redis] Running repair script ${isDryRun ? '(DRY RUN)' : '(LIVE)'}`);

    // Run the repair script
    const report = await repairRedisTokenSync(isDryRun);

    // Return the repair report
    return NextResponse.json({
      success: true,
      dryRun: isDryRun,
      report: {
        onChainTotalTickets: report.onChainTotalTickets,
        redisCurrentTokenId: report.redisCurrentTokenId,
        tokensChecked: report.tokensChecked,
        tokensRepaired: report.tokensRepaired,
        tokensWithMissingData: report.tokensWithMissingData,
        tokensWithIncorrectData: report.tokensWithIncorrectData,
        trackerRepaired: report.trackerRepaired,
        errors: report.errors,
      },
    });
  } catch (error) {
    console.error('[admin-repair-redis] Repair failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Repair failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
