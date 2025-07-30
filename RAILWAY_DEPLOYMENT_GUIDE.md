# Railway Deployment Guide for Choo-Choo Train

This guide will walk you through deploying your Choo-Choo Train Farcaster mini-app to Railway using Docker, including setting up Upstash KV store for Redis functionality.

## Overview

Your project is a monorepo containing:

- **app/**: Next.js Farcaster mini-app (main deployment target)
- **contracts/**: Foundry smart contracts
- **generator/**: NFT image generation package

## Prerequisites

1. Railway account: [Sign up at railway.app](https://railway.app)
2. Upstash account: [Sign up at upstash.com](https://upstash.com)
3. GitHub repository with your code
4. Required API keys and environment variables (see Environment Variables section)

## Step 1: Create Dockerfile

First, let's create a Dockerfile optimized for your Next.js monorepo:

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.12.1

# Copy package.json and pnpm files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY app/package.json ./app/
COPY generator/package.json ./generator/
COPY turbo.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.12.1

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/app/node_modules ./app/node_modules
COPY --from=deps /app/generator/node_modules ./generator/node_modules

# Copy source code
COPY . .

# Build the application
ENV NEXT_TELEMETRY_DISABLED 1
RUN pnpm build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/app/.next/standalone ./
COPY --from=builder /app/app/.next/static ./app/.next/static
COPY --from=builder /app/app/public ./app/public

# Copy necessary files for the generator package
COPY --from=builder /app/generator/dist ./generator/dist
COPY --from=builder /app/generator/layers ./generator/layers

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "app/server.js"]
```

## Step 2: Configure Next.js for Standalone Output

Update your `app/next.config.js` to enable standalone output:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // Enable if you're using App Router
    serverComponentsExternalPackages: ['imagescript'],
  },
  // Add any other existing configurations
};

module.exports = nextConfig;
```

## Step 3: Set Up Upstash KV Store

1. **Create Upstash Account**

   - Go to [upstash.com](https://upstash.com) and sign up
   - Verify your email and complete onboarding

2. **Create a Redis Database**

   - Click "Create Database" in the Upstash console
   - Choose "Redis" as the database type
   - Select a region close to where you'll deploy (Railway supports multiple regions)
   - Choose "Global" for better performance if budget allows
   - Give it a name like "choochoo-redis"
   - Click "Create"

3. **Get Connection Details**
   - Once created, go to the database details page
   - Copy the "REST URL" and "REST Token" (you'll need these for Railway)
   - The format will be:
     ```
     REST URL: https://your-db-name.upstash.io
     REST Token: your-rest-token-here
     ```

## Step 4: Deploy to Railway

### Option A: Using Railway Web Interface (Recommended)

1. **Connect Repository**

   - Go to [railway.app](https://railway.app) and sign in
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub account if not already connected
   - Select your repository

2. **Configure Build Settings**

   - Railway should auto-detect it's a Node.js project
   - Set the **Root Directory** to `/` (since we're building from the monorepo root)
   - Railway will use the Dockerfile we created

3. **Set Environment Variables**
   - Go to your project settings
   - Click on "Variables" tab
   - Add all the required environment variables (see section below)

### Option B: Using Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Deploy
railway up
```

## Step 5: Environment Variables Configuration

Add these environment variables in Railway's dashboard under Project Settings > Variables:

### Core Application Variables

```bash
# App Configuration
NEXT_PUBLIC_URL=https://your-app-name.up.railway.app
NEXT_PUBLIC_MINI_APP_NAME="Choo-Choo Train"
NEXT_PUBLIC_MINI_APP_DESCRIPTION="A social experiment on Base and Farcaster"
NEXT_PUBLIC_MINI_APP_BUTTON_TEXT="All Aboard!"
NEXT_PUBLIC_MINI_APP_PRIMARY_CATEGORY="social"
NEXT_PUBLIC_MINI_APP_TAGS="social,base,nft,train"

# Authentication
NEXTAUTH_SECRET=your-randomly-generated-secret-here
NEXTAUTH_URL=https://your-app-name.up.railway.app

# Internal API Security
INTERNAL_SECRET=another-randomly-generated-secret

# Environment
NODE_ENV=production
```

### Upstash KV Configuration

```bash
# From your Upstash dashboard
KV_REST_API_URL=https://your-db-name.upstash.io
KV_REST_API_TOKEN=your-rest-token-here
```

### Blockchain & Contract Variables

```bash
# Contract Configuration
NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS=your-deployed-contract-address
CHOOCHOO_TRAIN_ADDRESS=your-deployed-contract-address
RPC_URL=your-rpc-endpoint
USE_MAINNET=true
ADMIN_PRIVATE_KEY=your-admin-private-key

# Base Network API Keys (optional but recommended)
GETBLOCKS_API_KEY=your-getblocks-api-key
BASESCAN_API_KEY=your-basescan-api-key
```

### Farcaster & Social Features

```bash
# Neynar API (required for Farcaster features)
NEYNAR_API_KEY=your-neynar-api-key
NEYNAR_CLIENT_ID=your-neynar-client-id
FID=your-farcaster-id

# Wallet Configuration
NEXT_PUBLIC_USE_WALLET=false
SEED_PHRASE=your-seed-phrase-for-bot-wallet
```

### IPFS & Media Storage

```bash
# Pinata for IPFS uploads
PINATA_JWT=your-pinata-jwt-token
NEXT_PUBLIC_PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

### Optional Analytics

```bash
NEXT_PUBLIC_ANALYTICS_ENABLED=false
```

## Step 6: Custom Start Command (if needed)

If Railway doesn't automatically detect your start command, you can set it manually:

1. Go to Project Settings > Deploy
2. Set Custom Start Command to: `node app/server.js`

## Step 7: Domain Configuration

1. **Custom Domain (Optional)**

   - In Railway dashboard, go to Settings > Domains
   - Add your custom domain
   - Update your environment variables to use the custom domain

2. **Update Environment Variables**
   - Update `NEXT_PUBLIC_URL` and `NEXTAUTH_URL` to match your Railway domain
   - The format will be: `https://your-app-name.up.railway.app`

## Step 8: Verify Deployment

1. **Check Build Logs**

   - Monitor the deployment logs in Railway dashboard
   - Ensure all packages install correctly and the build succeeds

2. **Test Application**

   - Visit your Railway URL
   - Test key features:
     - Frame loading
     - API endpoints (`/api/health` if you have one)
     - Database connectivity
     - Contract interactions

3. **Monitor Performance**
   - Use Railway's metrics dashboard to monitor:
     - Memory usage
     - CPU usage
     - Response times

## Step 9: Production Optimizations

### Enable Caching

Add these to your environment variables for better performance:

```bash
REDIS_TTL=3600
NEXT_CACHE_HANDLER=redis
```

### Database Connection Pooling

Upstash Redis handles connection pooling automatically, but ensure your app properly closes connections.

### Health Checks

Create a health check endpoint at `app/src/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { redis } from '@/lib/kv';

export async function GET() {
  try {
    // Test Redis connection
    await redis.ping();

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        redis: 'connected',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error.message,
      },
      { status: 500 }
    );
  }
}
```

## Troubleshooting

### Common Issues

1. **Build Failures**

   - Ensure all dependencies are properly listed in package.json
   - Check that environment variables are correctly set
   - Verify Dockerfile syntax

2. **Memory Issues**

   - Railway provides 512MB by default; upgrade if needed
   - Optimize your Next.js bundle size
   - Consider using dynamic imports

3. **Environment Variable Issues**

   - Double-check variable names (case-sensitive)
   - Ensure no trailing spaces in values
   - Use Railway's variable validation

4. **Database Connection Issues**
   - Verify Upstash credentials are correct
   - Check Upstash dashboard for connection logs
   - Ensure your app handles Redis connection errors gracefully

### Useful Commands

```bash
# View logs
railway logs

# Open app in browser
railway open

# Check environment variables
railway variables

# Redeploy
railway up --detach
```

## Cost Estimation

- **Railway**: $5-20/month depending on usage
- **Upstash Redis**: Free tier available (10K commands/day), paid plans from $0.20/100K commands
- **Total estimated cost**: $5-25/month for moderate usage

## Security Considerations

1. **Never commit sensitive environment variables**
2. **Use Railway's environment variable encryption**
3. **Regularly rotate API keys and secrets**
4. **Enable 2FA on Railway and Upstash accounts**
5. **Monitor access logs regularly**

## Next Steps

1. Set up monitoring and alerting
2. Configure automated backups for critical data
3. Set up staging environment for testing
4. Consider implementing CI/CD pipelines
5. Monitor performance and optimize as needed

Your Choo-Choo Train app should now be successfully running on Railway with Upstash KV! 🚂
