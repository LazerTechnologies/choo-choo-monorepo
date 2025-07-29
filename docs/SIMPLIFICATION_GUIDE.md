# ChooChoo Project Simplification Guide

This guide outlines how to simplify the ChooChoo project deployment and make it more maintainable. The current setup has unnecessary complexity that can be streamlined significantly.

## 🎯 Overview: Why Simplify?

**Current Issues:**

- Complex Docker setup fighting against platform conventions
- Interactive build scripts that don't work in CI/CD
- Hard failures for optional services
- Environment variable management scattered across files
- Notification system complexity for unused features

**Goals:**

- Reduce deployment time from 10+ minutes to 2-3 minutes
- Eliminate Docker complexity
- Make local development easier
- Improve error handling and debugging

## 🚀 Step 1: Switch to Railway Native Buildpack

### Remove Docker Completely

**Delete/Rename Files:**

```bash
mv Dockerfile Dockerfile.backup
mv .dockerignore .dockerignore.backup
```

**Update `railway.toml`:**

```toml
[build]
# Remove: builder = "dockerfile"
buildCommand = "pnpm install && pnpm --filter generator build && pnpm --filter app build"
startCommand = "pnpm --filter app start"

[deploy]
healthcheckPath = "/api/health"
healthcheckTimeout = 300
restartPolicyType = "always"
```

### Benefits

- ✅ No Node.js version mismatches
- ✅ Railway handles caching automatically
- ✅ Faster builds (native buildpack optimizations)
- ✅ Simpler debugging

## 📦 Step 2: Simplify Build Scripts

### Replace Interactive Build Scripts

**Current Problem:**

```javascript
// app/scripts/build.js - Uses inquirer prompts
const { domain } = await inquirer.prompt([...])  // Fails in CI/CD
```

**Solution - Update `app/package.json`:**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "build:with-generator": "pnpm --filter generator build && next build",
    "type-check": "tsc --noEmit",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "clean": "rm -rf .next node_modules/.cache"
  }
}
```

**Update Root `package.json`:**

```json
{
  "scripts": {
    "dev": "pnpm --filter app dev",
    "build": "pnpm --filter generator build && pnpm --filter app build",
    "start": "pnpm --filter app start",
    "type-check": "pnpm --filter app type-check && pnpm --filter generator tsc --noEmit",
    "lint": "pnpm --filter app lint && pnpm --filter generator lint",
    "clean": "pnpm --filter app clean && pnpm --filter generator clean"
  }
}
```

## 🔧 Step 3: Centralized Environment Management

### Create Environment Schema

**Create `app/src/config/env.ts`:**

```typescript
import { z } from 'zod';

const envSchema = z.object({
  // Required in production
  NEXT_PUBLIC_URL: z.string().url(),
  NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),

  // App metadata
  NEXT_PUBLIC_MINI_APP_NAME: z.string().default('ChooChoo on Base'),
  NEXT_PUBLIC_MINI_APP_BUTTON_TEXT: z.string().default('Launch Mini App'),
  NEXT_PUBLIC_MINI_APP_DESCRIPTION: z.string().optional(),

  // Auth
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),

  // Optional services
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  NEYNAR_API_KEY: z.string().optional(),
  NEYNAR_CLIENT_ID: z.string().optional(),
});

function parseEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ Environment validation failed:', error);
      throw error;
    }

    console.warn('⚠️ Environment validation failed, using defaults:', error);
    return envSchema.parse({
      ...process.env,
      NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
      NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS:
        '0x0000000000000000000000000000000000000001',
      NEXTAUTH_SECRET: 'dev-secret-not-for-production-use-only',
      NEXTAUTH_URL: process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
    });
  }
}

export const env = parseEnv();
```

### Update Constants File

**Replace `app/src/lib/constants.ts`:**

```typescript
import { env } from '@/config/env';

export const APP_URL = env.NEXT_PUBLIC_URL;
export const APP_NAME = env.NEXT_PUBLIC_MINI_APP_NAME;
export const APP_DESCRIPTION = env.NEXT_PUBLIC_MINI_APP_DESCRIPTION;
export const APP_BUTTON_TEXT = env.NEXT_PUBLIC_MINI_APP_BUTTON_TEXT;
export const CHOOCHOO_TRAIN_ADDRESS =
  env.NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS as `0x${string}`;

// Derived constants
export const APP_ICON_URL = `${APP_URL}/icon.png`;
export const APP_OG_IMAGE_URL = `${APP_URL}/api/opengraph-image`;
export const APP_WEBHOOK_URL =
  env.NEYNAR_API_KEY && env.NEYNAR_CLIENT_ID
    ? `https://api.neynar.com/f/app/${env.NEYNAR_CLIENT_ID}/event`
    : `${APP_URL}/api/webhook`;
```

## 🗄️ Step 4: Graceful Service Degradation

### Update KV Store with Fallbacks

**Replace `app/src/lib/kv.ts`:**

```typescript
import { Redis } from '@upstash/redis';
import { env } from '@/config/env';

// Initialize Redis with fallback
const redis =
  env.KV_REST_API_URL && env.KV_REST_API_TOKEN
    ? new Redis({
        url: env.KV_REST_API_URL,
        token: env.KV_REST_API_TOKEN,
      })
    : null;

// In-memory fallback for development
const memoryStore = new Map<string, any>();

function getStore() {
  if (redis) return redis;

  console.warn('📝 Using in-memory store (Redis not configured)');
  return {
    get: async (key: string) => memoryStore.get(key) || null,
    set: async (key: string, value: any) => memoryStore.set(key, value),
    del: async (key: string) => memoryStore.delete(key),
    // Add other Redis methods as needed
  };
}

export async function getCurrentHolder(): Promise<ChooChooHolder | null> {
  try {
    const store = getStore();
    return await store.get(KEYS.CURRENT_HOLDER);
  } catch (error) {
    console.error('Failed to get current holder:', error);
    return null; // Graceful degradation
  }
}

// Apply this pattern to all KV functions...
```

## 📋 Step 5: Environment Variable Documentation

### Create `.env.example`

**Root `.env.example`:**

```bash
# =============================================================================
# ChooChoo Environment Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Required in Production
# -----------------------------------------------------------------------------

# Your deployed app URL (set by Railway automatically, or set manually)
NEXT_PUBLIC_URL=https://your-app.railway.app

# Smart contract address on Base
NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS=0x1234567890123456789012345678901234567890

# NextAuth configuration
NEXTAUTH_SECRET=your-super-secret-jwt-secret-at-least-32-characters
NEXTAUTH_URL=https://your-app.railway.app

# -----------------------------------------------------------------------------
# App Metadata (Optional - has defaults)
# -----------------------------------------------------------------------------

NEXT_PUBLIC_MINI_APP_NAME=ChooChoo on Base
NEXT_PUBLIC_MINI_APP_BUTTON_TEXT=Launch Mini App
NEXT_PUBLIC_MINI_APP_DESCRIPTION=A train visiting every wallet on Base

# -----------------------------------------------------------------------------
# Optional Services
# -----------------------------------------------------------------------------

# Upstash Redis (for holder data persistence)
# Get these from: https://console.upstash.com/
KV_REST_API_URL=https://your-redis.upstash.io
KV_REST_API_TOKEN=your-redis-token

# Neynar API (for Farcaster integration)
# Get these from: https://neynar.com/
NEYNAR_API_KEY=your-neynar-api-key
NEYNAR_CLIENT_ID=your-neynar-client-id

# -----------------------------------------------------------------------------
# Development Only
# -----------------------------------------------------------------------------

# Set to true to enable wallet functionality in development
NEXT_PUBLIC_USE_WALLET=false
```

### Railway Environment Setup Script

**Create `scripts/setup-railway-env.sh`:**

```bash
#!/bin/bash

echo "🚂 Setting up Railway environment variables..."

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install it first:"
    echo "npm install -g @railway/cli"
    exit 1
fi

# Required variables
railway variables set NEXTAUTH_SECRET=$(openssl rand -hex 32)
railway variables set NEXT_PUBLIC_MINI_APP_NAME="ChooChoo on Base"
railway variables set NEXT_PUBLIC_MINI_APP_BUTTON_TEXT="Launch Mini App"

echo "✅ Basic environment variables set!"
echo ""
echo "📋 Don't forget to set these manually in Railway dashboard:"
echo "  - NEXT_PUBLIC_URL (set automatically by Railway)"
echo "  - NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS"
echo "  - KV_REST_API_URL (if using Redis)"
echo "  - KV_REST_API_TOKEN (if using Redis)"
echo "  - NEYNAR_API_KEY (if using Neynar)"
echo "  - NEYNAR_CLIENT_ID (if using Neynar)"
```

## 🧪 Step 6: Improved Development Experience

### Development Setup Script

**Create `scripts/dev-setup.sh`:**

```bash
#!/bin/bash

echo "🚂 ChooChoo Development Setup"
echo "============================"

# Check Node.js version
node_version=$(node -v | cut -d'v' -f2)
required_version="20.0.0"

if [ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "❌ Node.js $required_version or higher required. You have $node_version"
    echo "Install from: https://nodejs.org/"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Copy environment template
if [ ! -f .env.local ]; then
    echo "📋 Creating .env.local from template..."
    cp .env.example .env.local
    echo "⚠️  Please edit .env.local with your actual values"
fi

# Build generator
echo "🔨 Building generator package..."
pnpm --filter generator build

echo "✅ Setup complete!"
echo ""
echo "🚀 Next steps:"
echo "  1. Edit .env.local with your environment variables"
echo "  2. Run 'pnpm dev' to start development server"
echo "  3. Visit http://localhost:3000"
```

### Package.json Updates

**Add helpful scripts to root `package.json`:**

```json
{
  "scripts": {
    "setup": "chmod +x scripts/dev-setup.sh && ./scripts/dev-setup.sh",
    "dev": "pnpm --filter app dev",
    "build": "pnpm --filter generator build && pnpm --filter app build",
    "start": "pnpm --filter app start",
    "type-check": "pnpm --filter app type-check && pnpm --filter generator type-check",
    "lint": "pnpm --filter app lint && pnpm --filter generator lint",
    "lint:fix": "pnpm --filter app lint:fix && pnpm --filter generator lint:fix",
    "clean": "pnpm --filter app clean && pnpm --filter generator clean",
    "deploy:railway": "chmod +x scripts/setup-railway-env.sh && ./scripts/setup-railway-env.sh"
  }
}
```

## 📊 Step 7: Migration Checklist

### Phase 1: Immediate Wins (Low Risk)

- [ ] Create environment validation (`app/src/config/env.ts`)
- [ ] Create `.env.example` files
- [ ] Add development setup scripts
- [ ] Update package.json scripts to remove interactive prompts

### Phase 2: Railway Migration (Medium Risk)

- [ ] Test Railway native buildpack in staging
- [ ] Update `railway.toml`
- [ ] Remove Docker files (keep as backup)
- [ ] Deploy and verify

### Phase 3: Code Cleanup (Low Risk)

- [ ] Update KV store with graceful degradation
- [ ] Remove unused notification code (already done)
- [ ] Centralize constants using env validation

## 🎯 Expected Benefits

**Before:**

- 10+ minute deployments
- Build failures due to environment issues
- Complex debugging
- Docker version conflicts

**After:**

- 2-3 minute deployments
- Self-healing environment validation
- Clear error messages
- Platform-native deployment

## 🆘 Rollback Plan

If anything goes wrong:

1. **Restore Docker deployment:**

   ```bash
   mv Dockerfile.backup Dockerfile
   mv .dockerignore.backup .dockerignore
   # Revert railway.toml
   ```

2. **Keep old build scripts:**

   ```bash
   mv app/scripts/build.js app/scripts/build.js.backup
   # They're still there if needed
   ```

3. **Environment variables:**
   - Old hardcoded values in Dockerfile still work
   - New env validation is backwards compatible

## 📚 Additional Resources

- [Railway Native Buildpack Docs](https://docs.railway.app/deploy/builds)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Zod Schema Validation](https://zod.dev/)
- [PNPM Workspace Commands](https://pnpm.io/workspaces)

---

💡 **Pro Tip:** Implement these changes incrementally. Start with environment validation and work your way up to the Railway migration.
