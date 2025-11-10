/**
 * Utility functions to extract FID (Farcaster ID) from various request sources
 */

/**
 * Extracts FID from a request URL's search parameters
 */
export function extractFidFromQuery(url: URL): number | null {
  const fidParam = url.searchParams.get('fid');
  if (!fidParam) return null;

  const fid = Number.parseInt(fidParam, 10);
  return Number.isFinite(fid) ? fid : null;
}

/**
 * Extracts FID from request headers
 * Checks common header names that might contain FID
 */
export function extractFidFromHeaders(headers: Headers): number | null {
  const fidHeader = headers.get('x-fid') || headers.get('fid');
  if (!fidHeader) return null;

  const fid = Number.parseInt(fidHeader, 10);
  return Number.isFinite(fid) ? fid : null;
}

/**
 * Extracts FID from a request body (for POST/PUT requests)
 * Supports various body structures used by Farcaster/Neynar
 */
export function extractFidFromBody(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null;

  const bodyObj = body as Record<string, unknown>;

  // Try various common FID locations in request bodies
  const miniAppContext = bodyObj.miniAppContext;
  const untrustedData = bodyObj.untrustedData;
  const user = bodyObj.user;

  const fid =
    (typeof miniAppContext === 'object' &&
      miniAppContext !== null &&
      'userFid' in miniAppContext &&
      (miniAppContext as { userFid?: unknown }).userFid) ||
    (typeof untrustedData === 'object' &&
      untrustedData !== null &&
      'fid' in untrustedData &&
      (untrustedData as { fid?: unknown }).fid) ||
    bodyObj.fid ||
    (typeof user === 'object' &&
      user !== null &&
      'fid' in user &&
      (user as { fid?: unknown }).fid) ||
    bodyObj.targetFid;

  if (typeof fid === 'number' && Number.isFinite(fid)) {
    return fid;
  }

  if (typeof fid === 'string') {
    const parsed = Number.parseInt(fid, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

/**
 * Attempts to extract FID from a request using available methods
 * For Next.js middleware, only query params and headers are available
 * For route handlers, body parsing can be done separately
 *
 * @param request - The HTTP request object
 * @param includeBody - Whether to attempt body parsing (default: false, as middleware can't access body)
 * @returns The first valid FID found, or null if none found
 */
export async function extractFidFromRequest(
  request: Request,
  includeBody = false,
): Promise<number | null> {
  // Try query parameters first (for GET requests)
  const url = new URL(request.url);
  const fidFromQuery = extractFidFromQuery(url);
  if (fidFromQuery) return fidFromQuery;

  // Try headers
  const fidFromHeaders = extractFidFromHeaders(request.headers);
  if (fidFromHeaders) return fidFromHeaders;

  // Try request body (only if explicitly requested, as middleware can't access body)
  if (includeBody) {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.toLowerCase().includes('application/json')) {
      try {
        // Clone the request to avoid consuming the body stream
        const clonedRequest = request.clone();
        const body = await clonedRequest.json();
        const fidFromBody = extractFidFromBody(body);
        if (fidFromBody) return fidFromBody;
      } catch {
        // Body parsing failed, continue
      }
    }
  }

  return null;
}
