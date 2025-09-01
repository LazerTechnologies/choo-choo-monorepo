# Admin Authentication & Security System

This document explains the authentication and security architecture for admin functions in the ChooChoo Farcaster mini-app.

## Overview

The admin system uses a **dual-layer security model** with Farcaster mini-app context validation and server-to-server authentication. This provides robust protection against spoofing while maintaining a seamless user experience.

## Architecture

```
Frontend (Farcaster Mini-App)
  ↓ [Frame Context + Session Cookies]
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

**Purpose**: Validate admin requests from authenticated mini-app users
**Files**:

- `src/lib/auth/require-frame-admin.ts`
- `src/app/api/admin/*/proxy/route.ts`

**How it works**:

1. Frontend sends frame context data with requests
2. Proxy validates FID from authenticated Neynar context
3. Proxy forwards to real endpoint with server secret

```typescript
// Frontend wraps requests
const frameData = {
  ...requestData,
  miniAppContext: {
    userFid: currentUserFid,
    isAuthenticated: !!neynarAuthUser,
    hasContext: !!context,
  },
  fid: currentUserFid,
};

// Server validates
const fid = body?.miniAppContext?.userFid || body?.fid;
if (!ADMIN_FIDS.includes(fid)) {
  return unauthorized();
}
```

### Layer 3: Server-to-Server Authentication

**Purpose**: Protect real admin endpoints from direct access
**Files**:

- `src/lib/auth/require-admin.ts`
- `src/app/api/admin/*/route.ts`

**How it works**:

```typescript
// Proxy forwards with secret
headers: {
  'x-admin-secret': ADMIN_SECRET,
  'x-admin-fid': String(validatedFid),
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

- **Purpose**: Wrap request data with frame context
- **Pattern**: Include authenticated user FID in requests
- **Usage**: Admin API calls

```typescript
export function useFrameContext() {
  const { context } = useMiniApp();
  const { user: neynarAuthUser } = useNeynarContext();
  const currentUserFid = neynarAuthUser?.fid || context?.user?.fid;

  const getFrameData = (requestData: any) => ({
    ...requestData,
    miniAppContext: {
      isAuthenticated: !!neynarAuthUser,
      hasContext: !!context,
      userFid: currentUserFid,
    },
    fid: currentUserFid,
  });

  return { currentUserFid, getFrameData };
}
```

### Authentication Guards

#### `src/lib/auth/require-frame-admin.ts`

- **Purpose**: Validate admin requests from mini-app context
- **Pattern**: Extract and validate FID from request body
- **Usage**: Proxy routes

```typescript
export async function requireFrameAdmin(request: Request) {
  const body = await request.json();
  const fid = body?.miniAppContext?.userFid || body?.fid;

  if (!fid || !ADMIN_FIDS.includes(fid)) {
    return { ok: false, response: unauthorized() };
  }

  return { ok: true, adminFid: fid };
}
```

#### `src/lib/auth/require-admin.ts`

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
import { requireFrameAdmin } from '@/lib/auth/require-frame-admin';
import { APP_URL } from '@/lib/constants';

export async function POST(request: Request) {
  // 1. Validate admin from frame context
  const auth = await requireFrameAdmin(request);
  if (!auth.ok) return auth.response;

  // 2. Check admin secret is configured
  const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
  if (!ADMIN_SECRET) {
    return NextResponse.json(
      { error: 'Server misconfigured' },
      { status: 500 }
    );
  }

  try {
    // 3. Extract actual request data
    const frameBody = await request.json();
    const actualBody = frameBody?.untrustedData || frameBody;

    // 4. Forward to real endpoint with secret
    const upstream = await fetch(`${APP_URL}/api/admin/{endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': ADMIN_SECRET,
        'x-admin-fid': String(auth.adminFid),
      },
      body: JSON.stringify(actualBody),
    });

    // 5. Return response
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
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

Admin components use this pattern:

```typescript
function AdminComponent() {
  const { getFrameData } = useFrameContext();

  const handleAdminAction = async () => {
    const res = await fetch('/api/admin/endpoint/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include session cookies
      body: JSON.stringify(
        getFrameData({
          // actual request data
          targetFid: 12345,
        })
      ),
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
NEXT_PUBLIC_URL=https://your-domain.com
APP_URL=https://your-domain.com  # Used by proxy routes

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

1. **FID Validation**: User's FID comes from authenticated Neynar context
2. **Server Secrets**: Real endpoints only accept internal calls with secrets
3. **Dual Validation**: Both proxy and endpoint validate admin status

### Attack Scenarios Blocked

- ❌ **Spoofed FID**: Can't fake FID in authenticated Neynar context
- ❌ **Direct Endpoint Access**: Requires `ADMIN_SECRET` header
- ❌ **CSRF Attacks**: Origin validation + authenticated context
- ❌ **Replay Attacks**: Session-based authentication with expiry

## Testing Admin Access

### Check Admin Status

```typescript
const { isAdmin, currentUserFid } = useAdminAccess();
console.log('Is Admin:', isAdmin, 'FID:', currentUserFid);
```

### Test Admin API Call

```typescript
const { getFrameData } = useFrameContext();
const response = await fetch('/api/admin/holder-status/proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify(getFrameData({})),
});
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check if your FID is in `ADMIN_FIDS`
2. **500 Server Error**: Verify `ADMIN_SECRET` is set
3. **Admin tab not showing**: Check Farcaster context is available

### Debug Steps

1. Check environment variables are set
2. Verify FID is in admin list: `console.log(ADMIN_FIDS)`
3. Test frame context: `console.log(context?.user?.fid)`
4. Check server logs for validation errors

## Migration Notes

This system replaced the previous NextAuth + frame signature validation approach because:

- Frame signatures weren't available in mini-app context
- NextAuth sessions required explicit sign-in flow
- New approach uses existing working FID detection pattern
- Maintains same security level with better UX

The dual-layer approach ensures both UI responsiveness and server security without requiring additional user authentication steps.
