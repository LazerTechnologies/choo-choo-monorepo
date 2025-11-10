# 🚨 Incident Response Guide

## Current Incident: Transaction Not Found + Log Flooding

### What's Happening

1. **Root Cause**: Transaction `0x38c908d9b13ef3ef8585eb55056f7a7d43c0bc4e6ae53ed402cd54da70d20feb` was submitted but doesn't exist on the blockchain
2. **Cascade Effect**:
   - System retries the transaction → fails
   - Each retry generates extensive logs
   - Token 674 generation times out waiting for the transaction
   - Logs exceed Railway's 500 logs/sec limit → 146 messages dropped
3. **Impact**: System is stuck, logs are flooding, new operations may fail

---

## 🔥 Immediate Actions (Do These Now)

### 1. Abandon the Stuck Staging Entry

```bash
# First, check the status
curl -H "x-admin-secret: YOUR_ADMIN_SECRET" \
     -H "x-admin-fid: YOUR_ADMIN_FID" \
     https://your-app.railway.app/api/health/staging

# Then abandon token 674
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -H "x-admin-fid: YOUR_ADMIN_FID" \
  -d '{"tokenId": 674, "reason": "Transaction not found on network - RPC broadcast failure"}' \
  https://your-app.railway.app/api/admin/abandon-staging
```

### 2. Clean Up Failed Staging Entries

```bash
# Quick cleanup of ALL failed staging entries
curl -X DELETE \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -H "x-admin-fid: YOUR_ADMIN_FID" \
  https://your-app.railway.app/api/admin/cleanup-failed-staging

# Or manually clear specific token via Redis
redis-cli -u $REDIS_URL

# Delete the staging entry
DEL staging:674

# Delete the pending NFT cache
DEL pending-nft:674

# Delete the generation lock (if stuck)
DEL gen-lock:674

# Check if there are other stuck tokens
KEYS staging:*
```

### 3. Set Log Level to Warn (Immediate Relief)

In Railway dashboard, add environment variable:
```
LOG_LEVEL=warn
```

Then **restart the application**.

This will reduce log volume by ~70% immediately.

### 4. Verify Transaction Status

Check if the transaction actually exists on Base:
```bash
# Base Mainnet
curl https://mainnet.base.org \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getTransactionByHash","params":["0x38c908d9b13ef3ef8585eb55056f7a7d43c0bc4e6ae53ed402cd54da70d20feb"],"id":1}'

# Or use Basescan
# https://basescan.org/tx/0x38c908d9b13ef3ef8585eb55056f7a7d43c0bc4e6ae53ed402cd54da70d20feb
```

If the transaction doesn't exist, the RPC node failed to broadcast it.

---

## 🔍 Root Cause: RPC Broadcast Failure

### Why This Happens

The contract service received a transaction hash from the RPC, but the transaction was never actually broadcast to the network. This can happen when:

1. **RPC Node Issues**: Node accepted the transaction but failed to broadcast it to the network
2. **Network Congestion**: Transaction was dropped during mempool congestion
3. **Nonce Conflict**: Another transaction with the same nonce was already mined
4. **Gas Price Too Low**: Transaction was rejected by the network
5. **RPC Provider Failover**: Request went to a node that wasn't synced

### Detection in Code

The error occurs in `ContractService.executeNextStop()` at line 459:

```typescript
try {
  await publicClient.getTransaction({ hash });
  console.log(`[ContractService] Transaction ${hash} confirmed on network...`);
} catch (txCheckError) {
  console.error(
    `[ContractService] Failed to verify transaction ${hash} exists on network:`,
    txCheckError,
  );
  throw new Error(
    `Transaction ${hash} does not exist on the blockchain...`,
  );
}
```

---

## 🛠️ Long-Term Fixes (Deploy These)

### Fix 1: Improved Transaction Verification with Retries

Update `app/src/lib/services/contract.ts`:

```typescript
// After getting transaction hash, verify with retries
async function verifyTransactionExists(
  hash: `0x${string}`,
  publicClient: any,
  maxAttempts = 5
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const tx = await publicClient.getTransaction({ hash });
      if (tx) return true;
    } catch (error) {
      if (i === maxAttempts - 1) {
        console.error(
          `[ContractService] Transaction ${hash} not found after ${maxAttempts} attempts`
        );
        return false;
      }
      // Wait 500ms between checks
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return false;
}

// Use it after sending transaction
const exists = await verifyTransactionExists(hash, publicClient);
if (!exists) {
  throw new Error(
    `Transaction ${hash} was not broadcast to the network. ` +
    `This is likely an RPC provider issue. Please retry the operation.`
  );
}
```

### Fix 2: Add Transaction Monitoring

Create `app/src/lib/transaction-monitor.ts`:

```typescript
import { redis } from '@/lib/kv';

interface PendingTransaction {
  hash: `0x${string}`;
  tokenId: number;
  operation: string;
  timestamp: string;
  retryCount: number;
}

export async function trackPendingTransaction(
  hash: `0x${string}`,
  tokenId: number,
  operation: string
): Promise<void> {
  const key = `pending-tx:${hash}`;
  const data: PendingTransaction = {
    hash,
    tokenId,
    operation,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };

  // Store for 1 hour
  await redis.set(key, JSON.stringify(data), 'EX', 3600);
}

export async function listPendingTransactions(): Promise<PendingTransaction[]> {
  const keys: string[] = [];
  let cursor = '0';

  do {
    const result = await redis.scan(cursor, 'MATCH', 'pending-tx:*', 'COUNT', 100);
    if (Array.isArray(result) && result.length === 2) {
      cursor = result[0] as string;
      keys.push(...(result[1] as string[]));
    } else {
      break;
    }
  } while (cursor !== '0');

  const transactions: PendingTransaction[] = [];
  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      transactions.push(JSON.parse(data));
    }
  }

  return transactions;
}
```

### Fix 3: Rate Limit Protection

The changes I already made will help:

1. ✅ **Reduced retry logging** - Only log first and last attempts
2. ✅ **Added LOG_LEVEL support** - Set to `warn` in production
3. ✅ **Production log optimization** - Redact unnecessary fields

### Fix 4: Circuit Breaker for RPC

Add a circuit breaker to detect RPC failures:

```typescript
// app/src/lib/circuit-breaker.ts
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private readonly threshold = 3;
  private readonly timeoutMs = 60000; // 1 minute

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker is open. RPC may be experiencing issues.');
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    if (this.failures >= this.threshold) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      return timeSinceLastFailure < this.timeoutMs;
    }
    return false;
  }

  private onSuccess(): void {
    this.failures = 0;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
  }
}
```

---

## 📊 Monitoring Setup

### Railway Dashboard Filters

Set up these log filters in Railway:

1. **Critical Errors**:
   ```
   level:error AND (
     "orchestrator.*.failed" OR
     "staging.promotion.failed" OR
     "Transaction.*not found"
   )
   ```

2. **RPC Issues**:
   ```
   "Failed to verify transaction" OR
   "does not exist on the blockchain" OR
   "RPC"
   ```

3. **Rate Limit Warnings**:
   ```
   "rate limit" OR "logs/sec" OR "Messages dropped"
   ```

4. **Stuck Operations**:
   ```
   "staging.lifecycle.abandoned" OR
   "Generation timeout" OR
   "lock_unavailable"
   ```

### Alert Thresholds

Set up alerts for:

1. **Error Rate**: > 5% of operations failing
2. **Log Rate**: > 400 logs/sec (leaves 100 logs/sec buffer)
3. **Stuck Staging**: Any entry > 10 minutes old
4. **Transaction Failures**: > 2 in 5 minutes

---

## 🔄 Recovery Checklist

- [ ] Abandon stuck staging entry (token 674)
- [ ] Clear Redis cache for token 674
- [ ] Set `LOG_LEVEL=warn` in Railway
- [ ] Restart application
- [ ] Verify transaction on Basescan
- [ ] Check staging health endpoint
- [ ] Monitor logs for 5 minutes
- [ ] If stable, retry the operation that failed
- [ ] Document incident details

---

## 🚀 Prevention Measures

### 1. RPC Provider Configuration

Consider using multiple RPC providers with automatic failover:

```typescript
const rpcProviders = [
  process.env.BASE_RPC_URL_PRIMARY,
  process.env.BASE_RPC_URL_SECONDARY,
  'https://mainnet.base.org', // Public fallback
];
```

### 2. Transaction Receipts Storage

Store transaction receipts in Redis for debugging:

```typescript
await redis.set(
  `tx-receipt:${hash}`,
  JSON.stringify({
    hash,
    status: receipt.status,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
  }),
  'EX',
  7 * 24 * 60 * 60 // 7 days
);
```

### 3. Automatic Staging Cleanup Job

Add a cron job to auto-abandon stuck staging entries:

```typescript
// app/src/app/api/cron/cleanup-staging/route.ts
export async function GET() {
  const entries = await listStagingEntries();
  const stuckEntries = entries.filter(e =>
    isStagingStuck(e, 10 * 60 * 1000)
  );

  for (const entry of stuckEntries) {
    await abandonStaging(
      entry.tokenId,
      'Auto-abandoned: exceeded 10 minute timeout'
    );
  }

  return NextResponse.json({
    abandoned: stuckEntries.length
  });
}
```

### 4. Log Sampling

For high-volume operations, implement log sampling:

```typescript
const shouldLog = Math.random() < 0.1; // Log 10% of operations
if (shouldLog) {
  retryLog.info(/* ... */);
}
```

---

## 📞 When to Escalate

Contact the team lead if:

1. **Multiple tokens stuck** (>3 simultaneous)
2. **RPC provider down** (all transactions failing)
3. **Redis connection lost** (can't clear cache)
4. **Log rate stays >400/sec** after fixes
5. **User funds at risk** (deposits not processing)

---

## 📝 Incident Report Template

After resolving, document:

```markdown
## Incident: [Date] - Transaction Not Found

**Duration**: [Start] to [End]
**Impact**: [Number of affected operations]
**Root Cause**: RPC node failed to broadcast transaction
**Resolution**:
- Abandoned stuck staging
- Cleared cache
- Reduced log level
- Restarted application

**Prevention**:
- [ ] Implement transaction verification with retries
- [ ] Add circuit breaker for RPC
- [ ] Set up monitoring alerts
- [ ] Document RPC provider SLA
```

---

## 🔗 Related Documentation

- [OBSERVABILITY_DASHBOARD.md](./OBSERVABILITY_DASHBOARD.md) - Log patterns and dashboard setup
- [Staging Manager](./app/src/lib/staging-manager.ts) - Staging lifecycle management
- [Contract Service](./app/src/lib/services/contract.ts) - Blockchain interaction layer
