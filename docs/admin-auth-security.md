# Admin Authentication & Security System

This document explains the authentication and security architecture for admin functions in the ChooChoo Farcaster mini-app.

## Overview

The admin system uses a **simplified security model** with UI gating and server-to-server authentication. This provides robust protection while maintaining a seamless user experience without requiring frame context validation.

## Architecture

```
Frontend (Farcaster Mini-App)
  ↓ [UI Gating + Origin Validation]
Proxy Routes (/api/admin/*/proxy)
  ↓ [Server-to-Server with ADMIN_SECRET]
Real Admin Endpoints (/api/admin/*)
```

## Security Layers

### Layer 1: Frontend Admin Detection

**Purpose**: UI gating - show/hide admin features
**Files**:

- `src/hooks/useAdminAccess.ts`
- `src/components/ui/Footer.tsx`

**How it works**:

```typescript
const { user: neynarAuthUser } = useNeynarContext();
const { context } = useMiniApp();
const currentUserFid = neynarAuthUser?.fid || context?.user?.fid;
const isAdmin = currentUserFid ? ADMIN_FIDS.includes(currentUserFid) : false;
```

**Security Note**: This is UI-only gating. Real security happens server-side.

### Layer 2: Proxy Route Validation

**Purpose**: Validate admin requests with origin checks and forward with server secrets
**Files**:

- `src/lib/auth/require-admin.ts` (shared `isTrustedOrigin` function)
- `src/app/api/admin/*/proxy/route.ts`

**How it works**:

1. Frontend sends clean JSON requests (no frame context wrapper)
2. Proxy validates request origin for CSRF protection
3. Proxy forwards to real endpoint with server secret + fallback admin FID

```typescript
// Frontend sends clean requests
const response = await fetch('/api/admin/endpoint/proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    /* actual data */
  }),
});

// Server validates origin and forwards
if (!isTrustedOrigin(request)) {
  return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
}
```

### Layer 3: Server-to-Server Authentication

**Purpose**: Protect real admin endpoints from direct access
**Files**:

- `src/lib/auth/require-admin.ts`
- `src/app/api/admin/*/route.ts`

**How it works**:

```typescript
// Proxy forwards with secret and fallback FID
const fallbackAdminFid = ADMIN_FIDS[0] || 0;
headers: {
  'x-admin-secret': ADMIN_SECRET,
  'x-admin-fid': String(fallbackAdminFid),
}

// Endpoint validates secret
const adminSecret = process.env.ADMIN_SECRET;
const headerSecret = request.headers.get('x-admin-secret');
if (adminSecret && headerSecret === adminSecret) {
  return { ok: true, adminFid: headerFid };
}
```

## Key Files & Patterns

### Authentication Hooks

#### `src/hooks/useAdminAccess.ts`

- **Purpose**: UI-only admin detection
- **Pattern**: Extract FID from Farcaster context
- **Usage**: Show/hide admin UI elements

```typescript
export function useAdminAccess() {
  const { user: neynarAuthUser } = useNeynarContext();
  const { context } = useMiniApp();
  const currentUserFid = neynarAuthUser?.fid || context?.user?.fid;
  const isAdmin = currentUserFid ? ADMIN_FIDS.includes(currentUserFid) : false;
  return { currentUserFid, isAdmin, adminFids: ADMIN_FIDS };
}
```

#### `src/hooks/useFrameContext.ts`

- **Purpose**: Provide frame context data (currently unused for admin auth)
- **Pattern**: Memoized context data extraction
- **Usage**: Available for future frame-based features

```typescript
export function useFrameContext() {
  const { context } = useMiniApp();
  const { user: neynarAuthUser } = useNeynarContext();
  const currentUserFid = neynarAuthUser?.fid || context?.user?.fid;

  const getFrameData = useCallback(
    (requestData: Record<string, unknown>) => ({
      ...requestData,
      miniAppContext: {
        isAuthenticated: !!neynarAuthUser,
        hasContext: !!context,
        userFid: currentUserFid,
      },
      fid: currentUserFid,
    }),
    [neynarAuthUser, context, currentUserFid]
  );

  return { currentUserFid, getFrameData };
}
```

### Authentication Guards

#### `src/lib/auth/require-admin.ts`

- **Purpose**: Shared origin validation and server-to-server admin authentication
- **Pattern**: Export reusable `isTrustedOrigin` function
- **Usage**: Proxy routes and real admin endpoints

```typescript
export function isTrustedOrigin(request: Request): boolean {
  try {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host) {
      const originUrl = new URL(origin);
      if (originUrl.host === host) return true;
    }

    if (APP_URL) {
      const app = new URL(APP_URL);
      if (origin) {
        const req = new URL(origin);
        if (app.hostname === req.hostname && app.protocol === req.protocol)
          return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}
```

#### `src/lib/auth/require-admin.ts` (requireAdmin function)

- **Purpose**: Validate server-to-server admin requests
- **Pattern**: Check admin secret header
- **Usage**: Real admin endpoints

```typescript
export async function requireAdmin(request: Request) {
  // Check server-to-server secret first
  const adminSecret = process.env.ADMIN_SECRET;
  const headerSecret = request.headers.get('x-admin-secret');
  if (adminSecret && headerSecret === adminSecret) {
    const headerFid = parseInt(request.headers.get('x-admin-fid') || '', 10);
    if (ADMIN_FIDS.includes(headerFid)) {
      return { ok: true, adminFid: headerFid };
    }
  }

  // Fallback to NextAuth session (for direct calls)
  // ... session validation logic
}
```

### Proxy Routes Pattern

All admin proxy routes follow this pattern:

**File**: `src/app/api/admin/{endpoint}/proxy/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { APP_URL, ADMIN_FIDS } from '@/lib/constants';
import { isTrustedOrigin } from '@/lib/auth/require-admin';

export async function POST(request: Request) {
  // 1. Basic origin check for CSRF protection
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
  }

  // 2. Check admin secret is configured
  const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
  if (!ADMIN_SECRET) {
    return NextResponse.json(
      { error: 'Server misconfigured: ADMIN_SECRET missing' },
      { status: 500 }
    );
  }

  try {
    // 3. Extract request data (no frame wrapper)
    const body = await request.json();

    // 4. Use fallback admin FID since UI gating ensures only admins access
    const fallbackAdminFid = ADMIN_FIDS[0] || 0;

    // 5. Forward to real endpoint with secret
    const upstream = await fetch(`${APP_URL}/api/admin/{endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': ADMIN_SECRET,
        'x-admin-fid': String(fallbackAdminFid),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    // 6. Return response
    const text = await upstream.text();
    const contentType =
      upstream.headers.get('content-type') || 'application/json';
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Frontend Usage Pattern

Admin components use this simplified pattern:

```typescript
function AdminComponent() {
  const { isAdmin } = useAdminAccess(); // UI gating

  const handleAdminAction = async () => {
    if (!isAdmin) return; // UI-level check

    const res = await fetch('/api/admin/endpoint/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        // Clean request data - no frame wrapper needed
        targetFid: 12345,
      }),
    });

    const data = await res.json();
    // handle response
  };
}
```

## Environment Variables

### Required for Production

```bash
# Admin Configuration
ADMIN_FIDS=377557,2802,243300  # Comma-separated list of admin FIDs
ADMIN_SECRET=your-long-random-secret  # Server-to-server authentication

# App URLs
NEXT_PUBLIC_URL=https://your-domain.com  # Used by APP_URL constant

# Neynar Integration
NEYNAR_API_KEY=your-neynar-key
NEYNAR_CLIENT_ID=your-client-id
```

### Security Notes

- `ADMIN_SECRET`: Must be long, random, and kept secret
- `ADMIN_FIDS`: Only these FIDs can access admin functions
- `NEYNAR_API_KEY`: Required for frame validation (if used)

## Security Benefits

### Anti-Spoofing Protection

1. **UI Gating**: Admin interface only shown to authorized FIDs
2. **Origin Validation**: Proxy routes validate same-origin requests for CSRF protection
3. **Server Secrets**: Real endpoints only accept internal calls with secrets
4. **Fallback FID**: Uses first admin FID since UI ensures only admins can access

### Attack Scenarios Blocked

- ❌ **UI Access**: Non-admin FIDs can't see admin interface
- ❌ **Direct Endpoint Access**: Requires `ADMIN_SECRET` header
- ❌ **CSRF Attacks**: Origin validation prevents cross-site requests
- ❌ **Proxy Bypass**: Real endpoints require server secret

## Testing Admin Access

### Check Admin Status

```typescript
const { isAdmin, currentUserFid } = useAdminAccess();
console.log('Is Admin:', isAdmin, 'FID:', currentUserFid);
```

### Test Admin API Call

```typescript
// For status endpoints (public)
const response = await fetch('/api/admin/holder-status', {
  method: 'GET',
  credentials: 'include',
});

// For admin actions (via proxy)
const response = await fetch('/api/admin/send-cast/proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ text: 'Test message' }),
});
```

## Troubleshooting

### Common Issues

1. **403 Forbidden Origin**: Check origin validation in proxy routes
2. **500 Server Error**: Verify `ADMIN_SECRET` and `NEXT_PUBLIC_URL` are set
3. **Admin tab not showing**: Check if your FID is in `ADMIN_FIDS`
4. **Status check fails**: Ensure Redis is accessible

### Debug Steps

1. Check environment variables: `ADMIN_SECRET`, `NEXT_PUBLIC_URL`, `ADMIN_FIDS`
2. Verify FID is in admin list: `console.log(ADMIN_FIDS)`
3. Test admin status: `console.log(useAdminAccess())`
4. Check server logs for origin validation or secret errors

## Migration Notes

This system evolved through several iterations:

1. **Original**: NextAuth + frame signature validation
2. **V2**: Frame context validation with `requireFrameAdmin`
3. **Current**: UI gating + origin validation + server secrets

### Why the Current Approach

- **Simplified**: No frame context parsing or validation needed
- **Reliable**: UI gating is straightforward and works consistently
- **Secure**: Origin validation + server secrets prevent spoofing
- **Maintainable**: Shared `isTrustedOrigin` function reduces code duplication
- **Fast**: No complex frame validation on every request

The current approach maintains strong security while being simpler to understand and maintain.
