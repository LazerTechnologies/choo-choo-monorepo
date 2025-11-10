# Observability Dashboard - Log Patterns & Error Codes

This document provides a comprehensive list of log patterns, error codes, and metrics for setting up an observability dashboard in Railway.

## Structured Log Codes (Domain-based)

### Orchestrator Logs (`orchestrator.*`)

**Operations:**
- `send-train`
- `random-send`
- `manual-send`
- `yoink`
- `admin-send`

**Events:**
- `start`
- `staging_created`
- `staging_updated`
- `promotion_store_success`
- `promotion_success`
- `promotion_failed`
- `abandon_failed`
- `completed`
- `failed`
- `contract_submitted`
- `contract_confirmed`
- `metadata_set`
- `recovered`
- `post_commit_warning`

**Full Log Code Patterns:**
```
orchestrator.send-train.start
orchestrator.send-train.staging_created
orchestrator.send-train.staging_updated
orchestrator.send-train.promotion_store_success
orchestrator.send-train.promotion_success
orchestrator.send-train.promotion_failed
orchestrator.send-train.abandon_failed
orchestrator.send-train.completed
orchestrator.send-train.failed
orchestrator.send-train.contract_submitted
orchestrator.send-train.contract_confirmed
orchestrator.send-train.metadata_set
orchestrator.send-train.recovered
orchestrator.send-train.post_commit_warning

orchestrator.random-send.start
orchestrator.random-send.staging_created
orchestrator.random-send.staging_updated
orchestrator.random-send.promotion_store_success
orchestrator.random-send.promotion_success
orchestrator.random-send.promotion_failed
orchestrator.random-send.abandon_failed
orchestrator.random-send.completed
orchestrator.random-send.failed
orchestrator.random-send.contract_submitted
orchestrator.random-send.contract_confirmed
orchestrator.random-send.metadata_set
orchestrator.random-send.recovered
orchestrator.random-send.post_commit_warning

orchestrator.manual-send.start
orchestrator.manual-send.staging_created
orchestrator.manual-send.staging_updated
orchestrator.manual-send.promotion_store_success
orchestrator.manual-send.promotion_success
orchestrator.manual-send.promotion_failed
orchestrator.manual-send.abandon_failed
orchestrator.manual-send.completed
orchestrator.manual-send.failed
orchestrator.manual-send.contract_submitted
orchestrator.manual-send.contract_confirmed
orchestrator.manual-send.metadata_set
orchestrator.manual-send.recovered
orchestrator.manual-send.post_commit_warning

orchestrator.yoink.start
orchestrator.yoink.staging_created
orchestrator.yoink.staging_updated
orchestrator.yoink.promotion_store_success
orchestrator.yoink.promotion_success
orchestrator.yoink.promotion_failed
orchestrator.yoink.abandon_failed
orchestrator.yoink.completed
orchestrator.yoink.failed
orchestrator.yoink.contract_submitted
orchestrator.yoink.contract_confirmed
orchestrator.yoink.metadata_set
orchestrator.yoink.recovered
orchestrator.yoink.post_commit_warning

orchestrator.admin-send.start
orchestrator.admin-send.staging_created
orchestrator.admin-send.staging_updated
orchestrator.admin-send.promotion_store_success
orchestrator.admin-send.promotion_success
orchestrator.admin-send.promotion_failed
orchestrator.admin-send.abandon_failed
orchestrator.admin-send.completed
orchestrator.admin-send.failed
orchestrator.admin-send.contract_submitted
orchestrator.admin-send.contract_confirmed
orchestrator.admin-send.metadata_set
orchestrator.admin-send.recovered
orchestrator.admin-send.post_commit_warning
```

### Staging Logs (`staging.*`)

**Categories:**
- `lifecycle`
- `promotion`
- `validation`
- `listing`
- `health_check`

**Events:**
- `exists`
- `created`
- `updated`
- `abandoned`
- `success`
- `failed`
- `parse_failed`
- `conflict`
- `conflict_exhausted`
- `update_failed`

**Full Log Code Patterns:**
```
staging.lifecycle.exists
staging.lifecycle.created
staging.lifecycle.updated
staging.lifecycle.abandoned
staging.lifecycle.success
staging.lifecycle.failed
staging.lifecycle.conflict
staging.lifecycle.conflict_exhausted
staging.lifecycle.update_failed

staging.promotion.success
staging.promotion.failed

staging.validation.parse_failed

staging.listing.failed
staging.listing.parse_failed
```

### Redis Logs (`redis.*`)

**Actions:**
- `set`
- `get`
- `del`
- `publish`
- `lock`

**Events:**
- `attempt`
- `success`
- `failed`
- `skipped`

**Full Log Code Patterns:**
```
redis.set.attempt
redis.set.success
redis.set.failed
redis.set.skipped

redis.get.attempt
redis.get.success
redis.get.failed
redis.get.skipped

redis.del.attempt
redis.del.success
redis.del.failed
redis.del.skipped

redis.publish.attempt
redis.publish.success
redis.publish.failed
redis.publish.skipped

redis.lock.attempt
redis.lock.success
redis.lock.failed
redis.lock.skipped
```

### Contract Logs (`contract.*`)

**Operations:**
- `next-stop`
- `yoink`
- `set-ticket-data`
- `verify`
- `read`

**Events:**
- `attempt`
- `success`
- `failed`

**Full Log Code Patterns:**
```
contract.next-stop.attempt
contract.next-stop.success
contract.next-stop.failed

contract.yoink.attempt
contract.yoink.success
contract.yoink.failed

contract.set-ticket-data.attempt
contract.set-ticket-data.success
contract.set-ticket-data.failed

contract.verify.attempt
contract.verify.success
contract.verify.failed

contract.read.attempt
contract.read.success
contract.read.failed
```

### Retry Logs (`retry.*`)

**Subjects:**
- `operation`
- `backoff`

**Events:**
- `attempt`
- `success`
- `failed`
- `scheduled`
- `exhausted`

**Full Log Code Patterns:**
```
retry.operation.attempt
retry.operation.success
retry.operation.failed
retry.operation.scheduled
retry.operation.exhausted

retry.backoff.attempt
retry.backoff.success
retry.backoff.failed
retry.backoff.scheduled
retry.backoff.exhausted
```

## Console Log Patterns (API Routes)

### Yoink Endpoint (`/api/yoink`)

```
[yoink] 🫡 Yoink request received
[yoink] Failed to parse request body
[yoink] Orchestration failed
```

### Send Train Endpoint (`/api/send-train`)

```
[send-train] 🫡 Public random winner selection request
[send-train] No workflow state found in Redis
[send-train] No current cast hash found in workflow state
[send-train] Timer has not expired yet. {minutes} minutes remaining.
[send-train] Timer expired, transitioning to CHANCE_EXPIRED
[send-train] Invalid state for random selection
[send-train] Failed to validate workflow state
[send-train] Starting orchestration for cast
[send-train] Orchestration failed
```

### Admin Send Train Endpoint (`/api/admin/send-train`)

```
[admin-send-train] Error parsing request body
[admin-send-train] Failed to fetch user data
[admin-send-train] Found user
[admin-send-train] Current holder
[admin-send-train] Failed to get current holder (non-critical)
```

### User Send Train Endpoint (`/api/user-send-train`)

```
[user-send-train] Failed to fetch user data
[user-send-train] Error parsing request body
[user-send-train] Failed to check deposit status
[user-send-train] 🚂 Manual selection request for target FID
[user-send-train] User orchestration failed
```

### Internal Select Winner (`/api/internal/select-winner`)

```
[internal/select-winner] Processing cast hash
[internal/select-winner] Making Neynar API request
[internal/select-winner] Neynar API error response
[internal/select-winner] Could not read error response body
[internal/select-winner] Fetched replies in this batch
[internal/select-winner] Next cursor
[internal/select-winner] Total raw replies fetched
[internal/select-winner] Skipping candidate - Neynar score too low
[internal/select-winner] Failed to verify Neynar score
[internal/select-winner] No repliers met the minimum Neynar score requirement
[internal/select-winner] Selected winner
[internal/select-winner] Error
[internal/select-winner] Error parsing request body
```

### Internal Mint Token (`/api/internal/mint-token`)

```
[mint-token] Failed to get user address
[internal/mint-token] Error parsing request body
[internal/mint-token] Authoritative token ID from contract
[internal/mint-token] Failed to get next token ID from contract
[internal/mint-token] Transaction executed
[internal/mint-token] Failed to execute contract transaction
[internal/mint-token] Post-mint verification skipped (non-critical)
[internal/mint-token] Successfully minted token
[internal/mint-token] Error
[internal/mint-token] Failed to release mint lock
```

### Internal Set Ticket Data (`/api/internal/set-ticket-data`)

```
[internal/set-ticket-data] Unauthorized: Invalid or missing internal secret
[internal/set-ticket-data] Invalid JSON in request body
[internal/set-ticket-data] Validation failed
[internal/set-ticket-data] Setting ticket data for token
[internal/set-ticket-data] Contract interaction failed
[internal/set-ticket-data] Unexpected error
```

### Webhook Cast Detection (`/api/webhook/cast-detection`)

```
🔔 [webhook] Received webhook
🚨 [webhook] Neynar signature missing from request headers
🚨 [webhook] Invalid webhook signature
🚨 [webhook] Expected signature validation failed
🚨 [webhook] Received signature
✅ [webhook] Signature validation passed
📨 [webhook] Webhook type
📨 [webhook] Full webhook data
🔍 [webhook] Cast text
🎯 [webhook] @choochoo cast detected! Processing...
🚨 [webhook] No current holder found in Redis - this is a critical error
🚨 [webhook] Redis current-holder key is missing or null
🔍 [webhook] Current holder data
🚨 [webhook] Failed to parse current holder data
🚨 [webhook] Raw holder data
🚨 [webhook] Current holder missing FID field
🚨 [webhook] Holder object
🔍 [webhook] FID Comparison Details
✅ [webhook] FID match confirmed! Processing cast from current holder
✅ [webhook] Updated workflow state to CASTED with hash
✅ [webhook] Workflow data stored
🚨 [webhook] Failed to update workflow state in Redis
ℹ️ [webhook] @choochoo cast detected but NOT from current holder
ℹ️ [webhook] Cast author
ℹ️ [webhook] Ignoring cast from non-holder
ℹ️ [webhook] Cast does not contain @choochoo, ignoring
ℹ️ [webhook] Non-cast webhook type, ignoring
🚨 [webhook] Critical webhook error
🚨 [webhook] Error details
```

### Workflow State (`/api/workflow-state`)

```
Detected corrupted workflow state data with SET prefix, cleaning...
Cleaned workflow state data
Stored cleaned workflow state back to Redis
Could not extract JSON from corrupted data, using default
Error fetching workflow state
Raw workflow state data
Reset workflow state to default due to parsing error
Failed to reset workflow state
[workflow-state] Failed to read existing state, using defaults
Error updating workflow state
```

### Users/Address (`/api/users/address`)

```
[users/address] Neynar API key is not configured
[users/address] Request received for FID
[users/address] No FID parameter provided
[users/address] Invalid FID parameter
[users/address] Calling Neynar API for FID
[users/address] Neynar API response status
[users/address] User not found in Neynar API
[users/address] Neynar API returned users count
[users/address] No users found in Neynar response
[users/address] User has no verified_addresses object
[users/address] Found address
[users/address] No valid Ethereum address found
[users/address] Primary eth_address
[users/address] ETH addresses array
[users/address] Returning successful response
[users/address] Failed to fetch user address
```

### Enable Random Winner (`/api/enable-random-winner`)

```
[enable-random-winner] Calling Neynar API for FID
[enable-random-winner] Neynar API response status
[enable-random-winner] Neynar API returned users count
[enable-random-winner] Resolved username
[enable-random-winner] No username found, using fallback
[enable-random-winner] Neynar API returned non-OK status
[enable-random-winner] No Neynar API key configured
[enable-random-winner] Failed to resolve username for FID
[enable-random-winner] Final username for cast
```

## HTTP Status Codes

### Success Codes

- `200` - Success
- `201` - Created

### Client Error Codes

- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict (lock unavailable, operation in progress)

### Server Error Codes

- `500` - Internal Server Error
- `502` - Bad Gateway
- `503` - Service Unavailable

## Error Message Patterns

### Lock-Related Errors

```
Another train movement is in progress
Manual send already in progress
Random send already in progress
Yoink already in progress
global_lock_unavailable
dedupe_lock_unavailable
```

### Validation Errors

```
targetAddress is required in request body
userFid is required in request body
Invalid address format
Invalid request body
Invalid JSON body
Missing or invalid castHash
FID is required
Target FID must be positive
User with FID not found
```

### Contract Errors

```
Yoink not available: {reason}
Target address has already ridden the train
Insufficient USDC deposit. You must deposit at least 1 USDC to yoink.
You must have a Neynar score of at least {score} to yoink ChooChoo
Failed to fetch current holder
No current holder found
Cannot send train to current holder {username} ({address})
Target user {username} ({address}) has already ridden the train and cannot receive it again
Departing passenger missing address
Contract execution failed
Failed to execute contract
Token minting failed
mint-token failed: {errorText}
```

### Neynar Score Errors

```
Target user must have a Neynar score of at least {score} to receive ChooChoo
Selected winner does not meet the minimum Neynar score requirement
You must have a Neynar score of at least {score} to yoink ChooChoo
No eligible repliers meet the minimum Neynar score requirement
```

### Staging Errors

```
Staging entry must exist before calling executeTrainMovement
Train movement already in progress (status: {status})
Staging timed out, please retry the operation
Failed to promote completed staging entry
Failed to promote staging entry
Cannot promote staging entry missing {field}
Cannot promote staging entry in status {status}
No staging entry found for token {tokenId}
Staging already exists, skipping creation
Concurrent update detected, retrying
Failed to update staging after max retries due to conflicts
```

### Workflow Errors

```
No workflow state found in Redis
No current cast hash found in workflow state
No active workflow state found.
No active cast found. The current holder must publish a cast first.
Timer has not expired yet. Please wait {minutes} more minutes.
Random selection is not currently available.
Invalid state for random selection: {state}
Failed to validate workflow state
Failed to validate current state
```

### Winner Selection Errors

```
Winner selection failed
No eligible repliers found
No repliers met the minimum Neynar score requirement
Failed to fetch target user
Target user not found
Target user missing address
Failed to fetch yoinker user data
Yoinker user not found
```

### NFT Generation Errors

```
generate-nft failed
Failed to fetch user data
```

### Metadata Errors

```
Metadata setting failed, marking for retry
Metadata setting failed: {error}
metadata_needs_retry
Metadata setting failed, queued for retry
```

### Post-Commit Warnings

```
welcome_cast
ticket_cast
cast_requests
notifications
workflow_state
```

## Log Levels

- `debug` - Debug information
- `info` - Informational messages
- `warn` - Warning messages (non-critical failures)
- `error` - Error messages (critical failures)

## Key Metrics to Track

### Operation Success Rates

- Track `orchestrator.*.completed` vs `orchestrator.*.failed`
- Track by operation type: `send-train`, `random-send`, `manual-send`, `yoink`, `admin-send`

### Lock Contention

- Count `global_lock_unavailable` and `dedupe_lock_unavailable` events
- Track HTTP 409 responses

### Staging Health

- Track staging status transitions
- Monitor `staging.lifecycle.conflict` and `staging.lifecycle.conflict_exhausted`
- Track stuck staging entries (older than 10 minutes)

### Contract Interaction Health

- Track `contract.*.success` vs `contract.*.failed`
- Monitor contract operation types

### Redis Health

- Track `redis.*.failed` events
- Monitor `redis.lock.failed` for lock acquisition issues

### Retry Patterns

- Track `retry.operation.exhausted` for operations that fail after all retries
- Monitor retry attempt counts

### Post-Commit Warnings

- Track `orchestrator.*.post_commit_warning` events
- Monitor specific stages: `welcome_cast`, `ticket_cast`, `notifications`, `workflow_state`

### API Endpoint Health

- Track HTTP status codes by endpoint
- Monitor error rates per endpoint

## Dashboard Queries (Example)

### Error Rate by Operation

```
count(orchestrator.*.failed) / count(orchestrator.*.start) * 100
```

### Lock Contention Rate

```
count(code="orchestrator.*.failed" AND reason="*_lock_unavailable") / count(orchestrator.*.start) * 100
```

### Staging Conflicts

```
count(staging.lifecycle.conflict) + count(staging.lifecycle.conflict_exhausted)
```

### Contract Failure Rate

```
count(contract.*.failed) / count(contract.*.attempt) * 100
```

### Redis Failure Rate

```
count(redis.*.failed) / count(redis.*.attempt) * 100
```

### Post-Commit Warning Rate

```
count(orchestrator.*.post_commit_warning) / count(orchestrator.*.completed) * 100
```

## Alert Thresholds (Recommended)

1. **Critical Errors**: `orchestrator.*.failed` > 5% of operations
2. **Lock Contention**: `*_lock_unavailable` > 10% of operations
3. **Staging Conflicts**: `staging.lifecycle.conflict_exhausted` > 0
4. **Contract Failures**: `contract.*.failed` > 3% of attempts
5. **Redis Failures**: `redis.*.failed` > 1% of operations
6. **Retry Exhaustion**: `retry.operation.exhausted` > 0
7. **Post-Commit Warnings**: `orchestrator.*.post_commit_warning` > 20% of completions
