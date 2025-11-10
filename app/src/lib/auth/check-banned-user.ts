import { NextResponse } from 'next/server';
import { BANNED_USERS } from '@/lib/constants';
import { authLog } from '@/lib/event-log';
import { extractFidFromBody, extractFidFromRequest } from './extract-fid';

interface CheckBannedUserResult {
  isBanned: boolean;
  fid: number | null;
  response?: NextResponse;
}

/**
 * Checks if a user is banned based on their FID
 * Extracts FID from the request and checks against BANNED_USERS
 *
 * @param request - The HTTP request object
 * @param includeBody - Whether to attempt body parsing (default: false for middleware)
 * @returns Object indicating if user is banned, their FID, and optional error response
 */
export async function checkBannedUser(
  request: Request,
  includeBody = false,
): Promise<CheckBannedUserResult> {
  // If no banned users configured, allow all
  if (BANNED_USERS.length === 0) {
    return { isBanned: false, fid: null };
  }

  try {
    const fid = await extractFidFromRequest(request, includeBody);

    // If we can't extract FID, we can't check if they're banned
    // In this case, we allow the request to proceed (fail open)
    // You may want to change this behavior based on your security requirements
    if (!fid) {
      return { isBanned: false, fid: null };
    }

    // Check if FID is in banned list
    if (BANNED_USERS.includes(fid)) {
      authLog.info('banned-user.blocked', {
        fid,
        msg: 'Banned user blocked from accessing route',
      });
      return {
        isBanned: true,
        fid,
        response: NextResponse.json(
          {
            error: 'Access denied',
            code: 'USER_BANNED',
            message: 'This account has been restricted from using this application',
          },
          { status: 403 },
        ),
      };
    }

    authLog.debug('banned-user.allowed', {
      fid,
      msg: 'User not banned, access allowed',
    });
    return { isBanned: false, fid };
  } catch (error) {
    authLog.error('banned-user.failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      msg: 'Error checking banned user status',
    });
    // On error, fail open (allow request) to avoid blocking legitimate users
    // You may want to change this to fail closed based on your security requirements
    return { isBanned: false, fid: null };
  }
}

/**
 * Checks if a specific FID is banned
 * Useful for route handlers that have already extracted the FID
 *
 * @param fid - The FID to check
 * @returns Object indicating if user is banned and optional error response
 */
export function checkBannedFid(fid: number | null): CheckBannedUserResult {
  // If no banned users configured, allow all
  if (BANNED_USERS.length === 0) {
    return { isBanned: false, fid: null };
  }

  // If no FID provided, can't check
  if (!fid || !Number.isFinite(fid)) {
    return { isBanned: false, fid: null };
  }

  // Check if FID is in banned list
  if (BANNED_USERS.includes(fid)) {
    return {
      isBanned: true,
      fid,
      response: NextResponse.json(
        {
          error: 'Access denied',
          code: 'USER_BANNED',
          message: 'This account has been restricted from using this application',
        },
        { status: 403 },
      ),
    };
  }

  return { isBanned: false, fid };
}

/**
 * Checks if a user is banned based on a request body
 * Useful for route handlers that have already parsed the request body
 *
 * @param body - The parsed request body
 * @returns Object indicating if user is banned, their FID, and optional error response
 */
export function checkBannedUserFromBody(body: unknown): CheckBannedUserResult {
  const fid = extractFidFromBody(body);
  return checkBannedFid(fid);
}
