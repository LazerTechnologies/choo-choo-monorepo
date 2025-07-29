# ChooChoo Deployment Guide

This guide covers deploying the ChooChoo project to Railway, both with the current setup and the improved simplified setup.

## 🚨 Current Setup (Complex)

### Prerequisites

- Railway account
- Docker knowledge
- Environment variables configured

### Current Deployment Process

1. **Environment Variables** (set in Railway dashboard):

   ```bash
   NEXT_PUBLIC_URL=https://your-app.railway.app
   NEXT_PUBLIC_MINI_APP_NAME=ChooChoo on Base
   NEXT_PUBLIC_MINI_APP_BUTTON_TEXT=Launch Mini App
   NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS=0x...
   NEXTAUTH_SECRET=your-secret
   NEXTAUTH_URL=https://your-app.railway.app
   KV_REST_API_URL=https://...
   KV_REST_API_TOKEN=...
   ```

2. **Deploy**:

   ```bash
   git push origin main
   ```

3. **Issues You'll Face**:
   - Docker build failures
   - Environment variable errors
   - Long build times (10+ minutes)
   - Node.js version conflicts

## ✅ Simplified Setup (Recommended)

### Quick Deploy (5 minutes)

1. **Remove Docker** (backup first):

   ```bash
   mv Dockerfile Dockerfile.backup
   mv .dockerignore .dockerignore.backup
   ```

2. **Update `railway.toml`**:

   ```toml
   [build]
   buildCommand = "pnpm install && pnpm --filter generator build && pnpm --filter app build"
   startCommand = "pnpm --filter app start"

   [deploy]
   healthcheckPath = "/api/health"
   healthcheckTimeout = 300
   restartPolicyType = "always"
   ```

3. **Set Environment Variables** (Railway dashboard):

   ```bash
   # Required
   NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS=0x...
   NEXTAUTH_SECRET=$(openssl rand -hex 32)

   # Optional (has defaults)
   NEXT_PUBLIC_MINI_APP_NAME=ChooChoo on Base
   NEXT_PUBLIC_MINI_APP_BUTTON_TEXT=Launch Mini App

   # Optional services
   KV_REST_API_URL=https://...  # Only if using Redis
   KV_REST_API_TOKEN=...        # Only if using Redis
   ```

4. **Deploy**:

   ```bash
   git add railway.toml
   git commit -m "Switch to Railway native buildpack"
   git push origin main
   ```

5. **Result**: 2-3 minute builds, no Docker issues!

## 🔧 Environment Variable Setup

### Using Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link project
railway login
railway link

# Set variables
railway variables set NEXTAUTH_SECRET=$(openssl rand -hex 32)
railway variables set NEXT_PUBLIC_MINI_APP_NAME="ChooChoo on Base"
railway variables set NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS="0x..."

# Deploy
railway deploy
```

### Using Railway Dashboard

1. Go to your Railway project
2. Click "Variables" tab
3. Add each environment variable
4. Redeploy

## 🐛 Troubleshooting

### Common Issues

**Build Fails with "Node.js version unsupported"**

- Solution: Use Railway native buildpack (remove Dockerfile)
- Why: Railway's buildpack uses the correct Node.js version automatically

**"Environment variable required" errors**

- Solution: Set all required variables in Railway dashboard
- Check: Use `.env.example` as reference

**Redis connection errors**

- Solution: Either set Redis variables or remove them entirely
- Info: App works without Redis (uses in-memory fallback)

**Build takes forever**

- Solution: Switch to native buildpack
- Benefit: Railway's optimized caching

### Debugging Deployment

1. **Check Railway logs**:

   ```bash
   railway logs
   ```

2. **Local testing**:

   ```bash
   # Test build locally
   pnpm build

   # Test production mode
   pnpm start
   ```

3. **Environment validation**:
   ```bash
   # Check if all required vars are set
   pnpm type-check
   ```

## 📋 Pre-deployment Checklist

### Before Deploying

- [ ] Environment variables set in Railway
- [ ] Contract address is correct
- [ ] Domain/URL is configured
- [ ] Redis credentials (if using)
- [ ] Build works locally (`pnpm build`)

### After Deploying

- [ ] App loads without errors
- [ ] Environment variables working
- [ ] Database connections working
- [ ] Farcaster integration working
- [ ] Contract interactions working

## 🚀 Deployment Strategies

### Quick Deploy (Current State)

Good for: Testing, quick fixes

```bash
git push origin main
```

### Staged Deploy (Recommended)

Good for: Production releases

1. **Create staging environment**:

   ```bash
   railway environment create staging
   ```

2. **Deploy to staging**:

   ```bash
   railway deploy --environment staging
   ```

3. **Test staging**, then promote to production

### Zero-downtime Deploy

1. Railway handles this automatically
2. Health checks ensure smooth transitions
3. Rolling deployments prevent downtime

## 🔄 Rollback Procedures

### If Deployment Fails

1. **Check Railway logs**:

   ```bash
   railway logs --tail
   ```

2. **Rollback to previous version**:

   ```bash
   # Via Railway dashboard: Deployments > Previous deployment > Redeploy
   ```

3. **Emergency rollback to Docker**:
   ```bash
   mv Dockerfile.backup Dockerfile
   git add Dockerfile
   git commit -m "Emergency rollback to Docker"
   git push origin main
   ```

### If App is Broken

1. **Check environment variables**
2. **Verify contract address**
3. **Check external service status** (Redis, Neynar)
4. **Review application logs**

## 🎯 Performance Expectations

### Current Setup (Docker)

- Build time: 8-12 minutes
- Deploy time: 2-3 minutes
- Total: 10-15 minutes

### Simplified Setup (Native Buildpack)

- Build time: 2-3 minutes
- Deploy time: 1-2 minutes
- Total: 3-5 minutes

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app/)
- [Railway CLI Reference](https://docs.railway.app/reference/cli-api)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Environment Variables Best Practices](https://12factor.net/config)

---

💡 **Pro Tip**: Start with the simplified setup. It's much easier to debug and maintain!
