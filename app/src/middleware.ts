import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { checkBannedUser } from '@/lib/auth/check-banned-user';
import { authLog } from '@/lib/event-log';

/**
 * Next.js middleware to block banned users from the yoink route
 *
 * This middleware:
 * - Only intercepts requests to /api/yoink
 * - Extracts FID from query params, headers, or request body
 * - Checks against BANNED_USERS environment variable
 * - Returns 403 if user is banned
 *
 * Configuration:
 * - Set BANNED_USERS environment variable as comma-separated FIDs
 * - Example: BANNED_USERS=123,456,789
 */
export async function middleware(request: NextRequest) {
  // Only check the yoink route
  if (request.nextUrl.pathname !== '/api/yoink') {
    return NextResponse.next();
  }

  // Check if user is banned
  // Note: FID is typically in the request body for yoink, which middleware can't reliably access
  // The route handler also performs this check as the definitive check
  // This middleware check serves as a first pass for FIDs in headers/query params
  const bannedCheck = await checkBannedUser(request, false);

  if (bannedCheck.isBanned) {
    authLog.info('banned-user.blocked', {
      fid: bannedCheck.fid,
      route: '/api/yoink',
      msg: 'Banned user blocked by middleware from yoink route',
    });
    return bannedCheck.response || NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // User is not banned, allow request to proceed
  return NextResponse.next();
}

/**
 * Configure which routes this middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
