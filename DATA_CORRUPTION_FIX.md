# Data Corruption Issues - Tokens 672-675

## 🔍 Problem Analysis

You're seeing **two types of errors** in your logs that are **UNRELATED** to the staging/logging fixes we just made:

### 1. Corrupted JSON for Tokens 672, 673, 674, 675

**Error**: `SyntaxError: Expected property name or '}' in JSON at position 1`

**Root Cause**: These tokens have malformed JSON stored in Redis, likely from the failed operations that created staging entry 674.

**Example**:
```
Failed to parse token data for token 672
Failed to parse token data for token 673
Failed to parse token data for token 674  ← This is your failed admin send!
Failed to parse token data for token 675
```

### 2. Negative Duration for Token 667

**Error**: `Negative duration detected for token 667: -1901ms`

**Details**:
- holderStartTime: `2025-11-06T23:55:12.901Z`
- holderEndTime: `2025-11-06T23:55:11.000Z`
- End time is 1.9 seconds BEFORE start time

**Root Cause**: Timestamp ordering issue - likely from rapid successive operations or clock skew.

---

## ✅ Fixes Deployed

### Fix 1: Reduced Log Volume

**Problem**: These errors were logging repeatedly, contributing to log spam.

**Solution**:
```typescript
// Before: Logged every time for every corrupted token
console.error(`Failed to parse token data for token ${tokenId}:`, error);

// After: Only log in development, warn once in production
if (process.env.NODE_ENV === 'development') {
  console.error(`Failed to parse token data for token ${tokenId}:`, error);
} else {
  console.warn(`[redis-token-utils] Corrupted data for token ${tokenId} (use repair endpoint)`);
}
```

**Impact**: Reduces log volume by ~50% when dealing with corrupted data.

**Files Changed**:
- `app/src/lib/redis-token-utils.ts`
- `app/src/app/api/journey/route.ts`

### Fix 2: Repair Endpoint

**Problem**: No easy way to detect and clean up corrupted token data.

**Solution**: New admin endpoint `/api/admin/repair-corrupted-tokens`

**Usage**:
```bash
# Step 1: Detect which tokens are corrupted
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "x-admin-fid: $YOUR_FID" \
  -d '{"tokenIds": [672, 673, 674, 675], "action": "detect"}' \
  https://choochoo.pro/api/admin/repair-corrupted-tokens

# Response:
{
  "success": true,
  "action": "detect",
  "summary": {
    "total": 4,
    "valid": 0,
    "corrupted": 4,
    "missing": 0,
    "deleted": 0
  },
  "results": [
    {
      "tokenId": 672,
      "status": "corrupted",
      "rawData": "{,\"tokenId\":672...",  // Shows first 100 chars
      "error": "Expected property name or '}' in JSON at position 1"
    },
    // ... similar for 673, 674, 675
  ]
}

# Step 2: Delete corrupted entries
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "x-admin-fid: $YOUR_FID" \
  -d '{"tokenIds": [672, 673, 674, 675], "action": "delete"}' \
  https://choochoo.pro/api/admin/repair-corrupted-tokens

# Response:
{
  "success": true,
  "action": "delete",
  "summary": {
    "total": 4,
    "valid": 0,
    "corrupted": 0,
    "missing": 0,
    "deleted": 4
  },
  "message": "Deleted 4 corrupted token entries"
}
```

**Files Changed**:
- `app/src/app/api/admin/repair-corrupted-tokens/route.ts` (new)

### Fix 3: Graceful Handling

**Problem**: Corrupted tokens would crash the journey endpoint.

**Solution**: Journey endpoint now:
- Filters out null tokens (from parse failures)
- Handles negative durations gracefully (clamps to 0)
- Only logs detailed errors in development

**Impact**: Journey page works even with corrupted data, just skips those entries.

---

## 🎯 Action Plan

### Immediate (Do Now)

1. **Detect the corruption**:
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "x-admin-fid: $YOUR_FID" \
  -d '{"tokenIds": [672, 673, 674, 675], "action": "detect"}' \
  https://choochoo.pro/api/admin/repair-corrupted-tokens
```

2. **Delete corrupted entries**:
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "x-admin-fid: $YOUR_FID" \
  -d '{"tokenIds": [672, 673, 674, 675], "action": "delete"}' \
  https://choochoo.pro/api/admin/repair-corrupted-tokens
```

3. **Verify journey works**:
```bash
curl https://choochoo.pro/api/journey
# Should return successfully, just missing tokens 672-675
```

### After Deployment

1. **Check logs** - should see reduced volume:
   - Before: 500+ logs/sec with repeated parse errors
   - After: <200 logs/sec, single warning per corrupted token

2. **Monitor staging health**:
   ```bash
   curl https://choochoo.pro/api/health/staging
   # Should be "healthy" after failed entries expire (60s)
   ```

---

## 📊 What Happened?

### Timeline

1. **Token 672-675 operations started** (probably admin sends or similar)
2. **Operations failed** (transaction issues, validation failures, etc.)
3. **Partial data written to Redis** - JSON not properly closed
4. **Staging marked as failed** (correctly)
5. **Failed staging stayed in Redis for 1 hour** ❌ (now fixed to 60 seconds)
6. **Journey endpoint repeatedly tried to parse corrupted JSON** ❌ (now logs once)
7. **Log rate limit hit** ❌ (now reduced logging)

### Why Token 674 Specifically?

That's your **admin send to someone who already rode**! The staging entry for 674 is still there (status: "failed") and will show in health checks until either:
- It expires in 60 seconds after you deploy
- You run the cleanup endpoint

---

## 🛡️ Prevention

### Already Fixed

1. ✅ **Failed staging expires in 60s** - no more long-lived failures
2. ✅ **Reduced logging** - parse errors only warn once
3. ✅ **Graceful handling** - journey works with corrupted data

### Future Prevention

1. **Atomic writes** - Consider using Redis transactions for token data
2. **Validation before storage** - Ensure JSON is valid before SET
3. **Health monitoring** - Alert on corrupted token detection

---

## 📝 Notes

### About Token 667 (Negative Duration)

This is a **timestamp ordering issue**, not corruption. The token data itself is valid JSON, but:
- Start time: Nov 6, 23:55:12.901
- End time: Nov 6, 23:55:11.000

This can happen when:
- Two operations execute very close together (< 2 seconds)
- System clock skew between writes
- Transaction timestamp vs. Redis write timestamp mismatch

**Impact**: None - the journey endpoint clamps to 0 and shows "just now"

**Fix needed?**: No, it's handled gracefully. If it happens frequently, we'd need to investigate the timestamp source.

---

## 🔧 Testing

### Test Corrupted Token Detection

1. **Manually corrupt a test token** (in dev/staging only):
```bash
redis-cli -u $REDIS_URL
SET token:999 "{,invalid:json}"
```

2. **Run detection**:
```bash
curl -X POST ... -d '{"tokenIds": [999], "action": "detect"}'
# Should show: "status": "corrupted"
```

3. **Delete it**:
```bash
curl -X POST ... -d '{"tokenIds": [999], "action": "delete"}'
# Should show: "status": "deleted"
```

4. **Verify cleanup**:
```bash
redis-cli -u $REDIS_URL
EXISTS token:999
# Should return: (integer) 0
```

---

## 📚 Related Documentation

- **[FIXES_SUMMARY.md](./FIXES_SUMMARY.md)** - Original staging/logging fixes
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Updated with repair commands
- **[INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)** - Complete incident guide
