# Dashboard Migration Guide

This guide shows how to replace your existing dashboard views with the new structured logging system.

## 1. Arrivals & Departures

**Old Pattern:** `[internal/mint-token] Minting token # for <user>, and executing contract: ChooChoo to <address>`

**New Structured Logs:**
```javascript
// Query for:
code = "api.mint-token.request" AND level = "info"

// Fields to display:
- tokenId (from payload)
- nftRecipient (from payload)
- nftRecipientUsername (from payload)
- newHolderAddress (from payload)
- msg (full message)
- timestamp
```

**Query Example (Railway/LogQL):**
```
{code="api.mint-token.request", level="info"}
```

**Railway Query (with old logs):**
```
"[train-orchestrator] Updated current holder to:" OR "[internal/mint-token] Minting token" OR "[internal/mint-token] Executing contract:" OR ("api.mint-token.request" AND @level:info)
```

**Note:** The parentheses around `("api.mint-token.request" AND @level:info)` are optional but recommended for clarity. Railway will parse it correctly either way since `OR` has lower precedence than `AND`. However, for consistency and readability, keeping the parentheses is good practice.

**Simplified (parentheses optional):**
```
"[train-orchestrator] Updated current holder to:" OR "[internal/mint-token] Minting token" OR "[internal/mint-token] Executing contract:" OR "api.mint-token.request" AND @level:info
```

**Filter:** Info level only

---

## 2. Manual Sends

**Old Pattern:** `[user-send-train]` or manual send logs

**New Structured Logs:**
```javascript
// Query for:
code =~ "orchestrator.manual-send.*" AND level IN ("info", "warn", "error")

// Key events to track:
- orchestrator.manual-send.start
- orchestrator.manual-send.completed
- orchestrator.manual-send.failed
- orchestrator.manual-send.post_commit_warning
```

**Query Example:**
```
{code=~"orchestrator.manual-send.*", level=~"info|warn|error"}
```

**Railway Query (with old logs):**
```
("user-send-train" OR "orchestrator.manual-send.*") AND (@level:info OR @level:warn OR @level:error)
```

**Note:** The parentheses are important! Without them, the query would be parsed incorrectly as:
```
"user-send-train" OR ("orchestrator.manual-send.*" AND @level:info) AND @level:warn AND @level:error
```
This would only match old logs OR new logs that are info AND warn AND error (impossible).

**Fields to display:**
- `code` (event type)
- `tokenId` (from payload)
- `newHolder.username` (from payload)
- `departingPassenger.username` (from payload)
- `error` (if present)
- `msg` (if present)
- `timestamp`

---

## 3. Cast Status Logs

**Old Pattern:** `[cast-status]`

**⚠️ NOTE:** The `/api/cast-status` route still uses console.log and needs to be converted to structured logging. Once converted, use:

**New Structured Logs (after conversion):**
```javascript
// Query for:
code =~ "api.cast-status.*" AND level IN ("info", "warn", "error")

// Expected events (to be added):
- api.cast-status.request
- api.cast-status.found
- api.cast-status.not_found
- api.cast-status.failed
```

**Temporary Workaround:** Continue using console log pattern `[cast-status]` until route is converted.

---

## 4. Yoinks

**Old Pattern:** `[yoink]` or yoink-related logs

**New Structured Logs:**
```javascript
// Query for:
code =~ "orchestrator.yoink.*" AND level IN ("info", "warn", "error")

// Key events:
- orchestrator.yoink.start
- orchestrator.yoink.completed
- orchestrator.yoink.failed
- orchestrator.yoink.contract_confirmed
- orchestrator.yoink.post_commit_warning
```

**Query Example:**
```
{code=~"orchestrator.yoink.*", level=~"info|warn|error"}
```

**Fields to display:**
- `code` (event type)
- `tokenId` (from payload)
- `userFid` (from payload)
- `targetAddress` (from payload)
- `txHash` (from payload, when available)
- `error` (if present)
- `timestamp`

---

## 5. Cast Webhooks

**Old Pattern:** `[webhook]`

**⚠️ NOTE:** The `/api/webhook/cast-detection` route still uses console.log and needs to be converted. Once converted, use:

**New Structured Logs (after conversion):**
```javascript
// Query for:
code =~ "api.webhook.*" AND level IN ("info", "warn", "error")

// Expected events (to be added):
- api.webhook.received
- api.webhook.signature_validated
- api.webhook.signature_invalid
- api.webhook.cast_processed
- api.webhook.cast_ignored
- api.webhook.failed
```

**Temporary Workaround:** Continue using console log pattern `[webhook]` until route is converted.

---

## 6. Random Sends

**Old Pattern:** `[internal/select-winner]`

**New Structured Logs:**
```javascript
// Query for:
code =~ "orchestrator.random-send.*" AND level IN ("info", "warn", "error")

// Key events:
- orchestrator.random-send.start
- orchestrator.random-send.completed
- orchestrator.random-send.failed
- orchestrator.random-send.contract_confirmed
- orchestrator.random-send.post_commit_warning
```

**Query Example:**
```
{code=~"orchestrator.random-send.*", level=~"info|warn|error"}
```

**Fields to display:**
- `code` (event type)
- `tokenId` (from payload)
- `castHash` (from payload)
- `winner.username` (from payload, when available)
- `totalEligibleReactors` (from payload)
- `txHash` (from payload, when available)
- `error` (if present)
- `timestamp`

**Note:** The winner selection logic is now part of the orchestrator, so you'll see the full flow from start to completion.

---

## 7. Ticket Metadata

**Old Pattern:** `[internal/set-ticket-data]` and "failed to set ticket metadata for token" logs

**New Structured Logs:**
```javascript
// Query for:
(code =~ "api.set-ticket-data.*" OR code =~ "api.admin-set-ticket-data.*")
AND level IN ("info", "warn", "error")

// Key events:
- api.set-ticket-data.request
- api.set-ticket-data.success
- api.set-ticket-data.failed
- api.set-ticket-data.unauthorized
- api.set-ticket-data.validation_failed
- api.admin-set-ticket-data.request
- api.admin-set-ticket-data.success
- api.admin-set-ticket-data.failed
```

**Query Example:**
```
{code=~"api.(set-ticket-data|admin-set-ticket-data).*", level=~"info|warn|error"}
```

**Fields to display:**
- `code` (event type)
- `tokenId` (from payload)
- `txHash` (from payload, when available)
- `error` (if present)
- `adminFid` (for admin-set-ticket-data)
- `msg` (full message)
- `timestamp`

**Filter for failures:**
```
{code=~"api.(set-ticket-data|admin-set-ticket-data).failed", level="error"}
```

---

## 8. Transaction Receipts

**Old Pattern:** Any logs with transaction hashes

**New Structured Logs:**
```javascript
// Query for completed transactions (must have txHash):
(
  code = "api.mint-token.success" OR
  code = "api.mint-token.contract_executed" OR
  code = "contract.next-stop.success" OR
  code = "contract.yoink.success" OR
  code = "contract.set-ticket-data.success" OR
  code = "contract.tx-mined.success" OR
  code = "orchestrator.*.contract_confirmed"
)
AND level = "info"
AND txHash EXISTS
```

**Query Example:**
```
{level="info", txHash!=""}
  | code =~ "api.mint-token.(success|contract_executed)"
  OR code =~ "contract.(next-stop|yoink|set-ticket-data|tx-mined).success"
  OR code =~ "orchestrator.*.contract_confirmed"
```

**Fields to display:**
- `code` (operation type)
- `txHash` (transaction hash)
- `tokenId` (from payload, when available)
- `status` (from payload, when available)
- `operation` (from payload, when available)
- `timestamp`

**Filter:** Info level only, must have valid `txHash` field

---

## Dashboard Query Templates

### Railway Logs Query Format

```javascript
// Example: Manual Sends Dashboard
{
  "query": "{code=~\"orchestrator.manual-send.*\", level=~\"info|warn|error\"}",
  "timeRange": "1h"
}

// Example: Transaction Receipts
{
  "query": "{level=\"info\", txHash!=\"\"} | code =~ \"(api.mint-token|contract).*success\" OR code =~ \"orchestrator.*.contract_confirmed\"",
  "timeRange": "24h"
}
```

### LogQL Format (Loki/Grafana)

```logql
# Manual Sends
{code=~"orchestrator.manual-send.*"}
  |= "info" or |= "warn" or |= "error"

# Transaction Receipts
{level="info"}
  | json
  | txHash != ""
  | code =~ "(api.mint-token|contract).*success|orchestrator.*.contract_confirmed"
```

---

## Migration Checklist

- [x] Arrivals & Departures → `api.mint-token.request` (info)
- [x] Manual Sends → `orchestrator.manual-send.*` (info, warn, error)
- [ ] Cast Status → `api.cast-status.*` (⚠️ **Needs conversion**)
- [x] Yoinks → `orchestrator.yoink.*` (info, warn, error)
- [ ] Cast Webhooks → `api.webhook.*` (⚠️ **Needs conversion**)
- [x] Random Sends → `orchestrator.random-send.*` (info, warn, error)
- [x] Ticket Metadata → `api.set-ticket-data.*` + `api.admin-set-ticket-data.*` (info, error)
- [x] Transaction Receipts → Multiple codes with `txHash` field (info only)

---

## Next Steps

1. **Convert remaining routes:**
   - `/api/cast-status` → Add `api.cast-status.*` log codes
   - `/api/webhook/cast-detection` → Add `api.webhook.*` log codes

2. **Update dashboard queries** using the patterns above

3. **Test each dashboard view** to ensure all expected logs are captured

4. **Remove old console.log pattern filters** once migration is complete
