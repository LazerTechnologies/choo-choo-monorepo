# Quick Reference - ChooChoo Admin Operations

## 🚨 Emergency Commands

### Clean Up Failed Operations

```bash
# Remove ALL failed staging entries immediately
curl -X DELETE \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "x-admin-fid: $YOUR_FID" \
  https://choochoo.pro/api/admin/cleanup-failed-staging
```

### Abandon Specific Token

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "x-admin-fid: $YOUR_FID" \
  -d '{"tokenId": 674, "reason": "Admin intervention"}' \
  https://choochoo.pro/api/admin/abandon-staging
```

### Check System Health

```bash
# Staging health
curl https://choochoo.pro/api/health/staging

# All staging entries
curl -H "x-admin-secret: $ADMIN_SECRET" \
     -H "x-admin-fid: $YOUR_FID" \
     https://choochoo.pro/api/admin/recover-staging
```

### Repair Corrupted Token Data

```bash
# Detect corrupted tokens (returns status for each)
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "x-admin-fid: $YOUR_FID" \
  -d '{"tokenIds": [672, 673, 674, 675], "action": "detect"}' \
  https://choochoo.pro/api/admin/repair-corrupted-tokens

# Delete corrupted tokens (clears bad data from Redis)
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "x-admin-fid: $YOUR_FID" \
  -d '{"tokenIds": [672, 673, 674, 675], "action": "delete"}' \
  https://choochoo.pro/api/admin/repair-corrupted-tokens
```

---

## 📊 Monitoring

### Log Patterns to Alert On

**Critical**:
- `orchestrator.*.failed` - Train movement failed
- `staging.promotion.failed` - Can't promote staging to permanent
- `Transaction.*not found` - RPC broadcast failure

**Warning**:
- `rate limit` OR `logs/sec` - Hitting log limits
- `staging.lifecycle.abandoned` - Failed operations
- `Generation timeout` - Pinata/NFT generation stuck

**Info**:
- `orchestrator.*.completed` - Successful movements
- `staging.promotion.success` - Successful promotions

### Railway Environment Variables

```bash
# Reduce log volume (recommended for production)
LOG_LEVEL=warn

# Other important vars
NODE_ENV=production
REDIS_URL=<your-redis-url>
BASE_RPC_URL=<your-rpc-url>
```

---

## 🔍 Common Issues

### "Failed staging entries stuck"

**Symptom**: `/api/health/staging` shows `"stuckCount": 1` with status "failed"
**Cause**: Failed operation left staging entry in Redis
**Fix**: Wait 60 seconds (auto-expires) OR run cleanup endpoint
**Prevention**: Already fixed - failed entries now expire in 60s

### "Log rate limit exceeded"

**Symptom**: Railway shows "500 logs/sec reached" and "Messages dropped"
**Cause**: Retry storms during failures
**Fix**: Set `LOG_LEVEL=warn`, restart app
**Prevention**: Already fixed - reduced retry logging by ~70%

### "Recipient already rode train"

**Symptom**: Admin send fails with "already ridden" error
**Cause**: Contract validation working correctly
**Fix**: Choose a different recipient
**Prevention**: Check `/api/has-ridden?address=0x...` before sending

### "Transaction not found"

**Symptom**: `TransactionNotFoundError` in logs
**Cause**: RPC node failed to broadcast transaction
**Fix**: Abandon staging, retry operation
**Prevention**: Use multiple RPC providers with failover

### "Failed to parse token data"

**Symptom**: `SyntaxError: Expected property name or '}'` for specific tokens
**Cause**: Corrupted JSON in Redis from failed operations
**Fix**: Use repair endpoint to detect and delete corrupted entries
**Prevention**: Fixed - staging entries now expire quickly on failure

### "Negative duration detected"

**Symptom**: Journey shows negative duration for a token
**Cause**: Timestamp ordering issue in Redis
**Fix**: Non-critical - journey endpoint handles gracefully
**Prevention**: Timestamps are now validated during storage

---

## 🛠️ Admin Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/send-train` | POST | Admin send train to specific FID |
| `/api/admin/abandon-staging` | POST | Manually abandon stuck staging |
| `/api/admin/cleanup-failed-staging` | DELETE | Delete all failed staging entries |
| `/api/admin/repair-corrupted-tokens` | POST | Detect/delete corrupted token data |
| `/api/admin/recover-staging` | GET | List all staging entries |
| `/api/admin/recover-staging` | POST | Manually promote staging |
| `/api/health/staging` | GET | Check staging health (public) |

### Required Headers (Admin Endpoints)

```
x-admin-secret: YOUR_ADMIN_SECRET
x-admin-fid: YOUR_ADMIN_FID
Content-Type: application/json
```

---

## 📈 Success Metrics

**Healthy System**:
- ✅ `/api/health/staging` → `"status": "healthy"`
- ✅ Logs < 200/sec average
- ✅ No staging entries > 5 minutes old
- ✅ `orchestrator.*.completed` rate > 95%

**Degraded System**:
- ⚠️ `/api/health/staging` → `"status": "degraded"`
- ⚠️ Logs 200-400/sec
- ⚠️ Staging entries 5-10 minutes old
- ⚠️ `orchestrator.*.completed` rate 80-95%

**Critical System**:
- 🚨 `/api/health/staging` → `"status": "error"`
- 🚨 Logs > 400/sec
- 🚨 Staging entries > 10 minutes old
- 🚨 `orchestrator.*.completed` rate < 80%

---

## 🎯 Quick Diagnosis

### Is the problem with staging?

```bash
curl https://choochoo.pro/api/health/staging
# If stuckCount > 0 → Check staging entries
# If status = "failed" → Run cleanup
```

### Is the problem with logs?

```bash
# Check Railway logs for:
# "rate limit" → Set LOG_LEVEL=warn
# "retry.operation.*" appearing frequently → Retry storm
```

### Is the problem with RPC?

```bash
# Check logs for:
# "TransactionNotFoundError" → RPC broadcast failure
# "Failed to verify transaction" → RPC sync issues
```

### Is the problem with a specific operation?

```bash
# Search logs for:
# orchestrator.manual-send.failed
# orchestrator.random-send.failed
# orchestrator.yoink.failed
# Check the error payload for root cause
```

---

## 💡 Pro Tips

1. **Always check staging health first** - it's your canary
2. **Failed entries auto-expire in 60s** - don't panic, just wait
3. **Set LOG_LEVEL=warn in production** - saves logs, same errors
4. **Monitor stuckCount not totalStaging** - total can be normal during operations
5. **Failed ≠ Stuck** - failed entries are cleaned up automatically

---

## 📚 Full Documentation

- **[FIXES_SUMMARY.md](./FIXES_SUMMARY.md)** - What was fixed and why
- **[INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)** - Complete incident response guide
- **[OBSERVABILITY_DASHBOARD.md](./OBSERVABILITY_DASHBOARD.md)** - All log patterns for Railway dashboard

---

## 🆘 When to Escalate

Escalate if:
- Multiple tokens stuck for > 10 minutes
- System can't recover after running cleanup endpoints
- RPC provider showing persistent failures
- Redis connection lost
- Critical errors affecting user funds/deposits

Otherwise, use this guide to self-serve! 🚂
