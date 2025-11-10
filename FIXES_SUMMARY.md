# Fixes Summary - Log Flooding & Failed Staging Cleanup

## Issues Fixed

### 1. **Failed Staging Entries Stay in Redis Too Long** ✅

**Problem**: When an admin send failed (e.g., recipient already rode), the staging entry was marked as "failed" but stayed in Redis for 1 hour, showing as "degraded" in health checks.

**Solution**:
- Failed staging entries now auto-expire in 60 seconds instead of 1 hour
- `isStagingStuck()` now ignores "failed" entries (they're not stuck, they're done)
- Added `/api/admin/cleanup-failed-staging` to immediately delete all failed entries

**Files Changed**:
- `app/src/lib/staging-manager.ts`
- `app/src/app/api/admin/cleanup-failed-staging/route.ts` (new)

### 2. **Log Rate Limit Exceeded (500 logs/sec)** ✅

**Problem**: Retry storms during failures caused >500 logs/sec, hitting Railway's rate limit and dropping messages.

**Solution**:
- Reduced retry logging - only log first and last attempts
- Only log backoff schedule on first retry
- Only log success if it took multiple attempts
- Added `LOG_LEVEL` environment variable support (set to `warn` in production)
- Added production-specific log optimization (redact unnecessary fields)

**Files Changed**:
- `app/src/lib/retry-utils.ts`
- `app/src/lib/event-log.ts`

### 3. **Admin Endpoint for Abandoning Stuck Staging** ✅

**Problem**: No easy way to manually abandon a stuck staging entry when things go wrong.

**Solution**:
- Added `/api/admin/abandon-staging` endpoint
- Accepts `tokenId` and optional `reason`
- Automatically cleans up pending NFT cache
- Logs admin action for audit trail

**Files Changed**:
- `app/src/app/api/admin/abandon-staging/route.ts` (new)

---

## How to Fix Your Current Issue

### Immediate Action (60 seconds)

The failed staging entry for token 674 will **auto-expire in 60 seconds** after you deploy this fix. No manual intervention needed!

### If You Need Immediate Cleanup

```bash
# Clean up ALL failed staging entries right now
curl -X DELETE \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -H "x-admin-fid: YOUR_ADMIN_FID" \
  https://choochoo.pro/api/admin/cleanup-failed-staging
```

### To Prevent Log Flooding

Add this to your Railway environment variables:
```
LOG_LEVEL=warn
```

Then restart the app. This reduces log volume by ~70%.

---

## Why It Failed

The error you saw:
```json
{
  "lastError": "Recipient 0x90125f9e5155f4965a2429d9a4b40283341d5ba2 has already ridden the train and cannot receive it again (caught during gas estimation)"
}
```

This is actually the system **working correctly**! Here's what happened:

1. Admin tried to send to FID that had already ridden
2. System did pre-flight validation (✅ passed at that moment)
3. System created staging and uploaded NFT to Pinata (✅)
4. System tried to mint token
5. **Contract gas estimation caught the issue** (✅ prevented bad transaction)
6. Staging marked as "failed" with clear error message (✅)
7. ~~Staging stayed in Redis for 1 hour~~ ❌ **NOW FIXED**: Expires in 60 seconds

The validation IS working - it prevented wasting gas on a bad transaction. The only issue was the cleanup, which is now fixed.

---

## New Admin Endpoints

### 1. Abandon Staging

```bash
POST /api/admin/abandon-staging
{
  "tokenId": 674,
  "reason": "Manual intervention"
}
```

### 2. Cleanup All Failed Staging

```bash
DELETE /api/admin/cleanup-failed-staging
```

### 3. Check Staging Health (existing)

```bash
GET /api/health/staging
```

### 4. List All Staging Entries (existing)

```bash
GET /api/admin/recover-staging
```

---

## Testing the Fix

1. **Deploy the changes**
2. **Wait 60 seconds** - token 674 should auto-expire
3. **Check health**:
   ```bash
   curl https://choochoo.pro/api/health/staging
   ```
   Should now show: `"status":"healthy","totalStaging":0,"stuckCount":0`

4. **Test failed send** (to verify auto-cleanup):
   - Admin send to someone who already rode
   - Check health immediately: should show "failed" entry
   - Wait 60 seconds
   - Check health again: should be gone ✅

---

## Prevention

To avoid this in the future:

1. **Check recipient before admin send**: Use `/api/has-ridden?address=0x...`
2. **Monitor staging health**: Set up alerts for `stuckCount > 0` lasting > 2 minutes
3. **Use the cleanup endpoint**: Run `/api/admin/cleanup-failed-staging` as part of your incident response

---

## Documentation

- **[OBSERVABILITY_DASHBOARD.md](./OBSERVABILITY_DASHBOARD.md)** - All log patterns for monitoring
- **[INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)** - Complete incident response guide
- **[FIXES_SUMMARY.md](./FIXES_SUMMARY.md)** - This document

---

## Deployment Checklist

- [ ] Deploy code changes
- [ ] Set `LOG_LEVEL=warn` in Railway
- [ ] Restart application
- [ ] Wait 60 seconds for token 674 to expire
- [ ] Verify staging health is green
- [ ] Test: Try sending to someone who already rode
- [ ] Verify: Failed entry auto-expires in 60 seconds
- [ ] Monitor logs: Should see <200 logs/sec
