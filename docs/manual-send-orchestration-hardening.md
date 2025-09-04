## Manual Send Orchestration Hardening Plan (no Lua, randomness preserved)

This document proposes changes to make manual send atomic and idempotent without using Lua scripts or deterministic image generation. It addresses duplicate execution, orphan assets, and Redis drift.

### Context and symptoms

- Duplicate calls produced two Pinata uploads for the same tokenId.
- A second mint attempt failed (500), leaving Redis without `token1` data.
- Admin flow later overwrote repaired Redis entries.
- Off‑by‑one fixes moved authority to on-chain `nextTicketId`, but orchestration remained non-atomic.

### Goals

- Single-writer orchestration: one place coordinates generate → mint → store → cast.
- Idempotent, retry-safe endpoints (no double mint, no duplicate assets, no overwritten Redis).
- Preserve artist randomness; avoid deterministic generation.
- Avoid Lua; use simple Redis primitives (SET NX EX, SETNX, basic transactions where available, or sequential guards).

---

## High-level design

Introduce a server-side orchestrator that owns the entire manual-send flow. All UI/route entry points call the orchestrator. The orchestrator uses a short-lived distributed lock and idempotency/pending caches to make the process atomic-ish and repeatable.

### Orchestrator: `orchestrateManualSend(currentHolderFid, targetFid)`

Steps (single source of truth for the flow):

1. Acquire operation lock

- Key: `lock:manual:<currentHolderFid>:<targetFid>` using Redis `SET key value NX EX 120`.
- If lock is already held ⇒ return 409 "Manual send already in progress".

2. Read authoritative token ID

- `nextTicketId = contractService.getNextOnChainTicketId()`.

3. Resolve pending generation (random, but de-duped)

- Check `pending-nft:<nextTicketId>` for `{ imageHash, metadataHash, tokenURI, attributes, passengerUsername }`.
- If missing: call `POST /api/internal/generate-nft` with `{ tokenId: nextTicketId, passengerUsername: <departing-username> }` and store the full response at `pending-nft:<nextTicketId>` with TTL (e.g., 15 minutes).
- This preserves randomness but reuses the first successful generation for that tokenId across retries.

4. Mint (no Redis writes here)

- Call `POST /api/internal/mint-token` with header `x-no-redis-write: true` so the endpoint skips any Redis writes.
- Optionally, inside `mint-token` acquire a short lock `lock:mint:<nextTicketId>` (EX 60) to guard direct callers; return 409 if locked.
- After tx: use `actualTokenId = nextTokenId` (the value captured before the transaction). Optionally verify `postNextId = getNextOnChainTicketId()` equals `nextTokenId + 1` for validation.

5. Store token data (write-once semantics)

- Build `TokenData` from pending NFT + participants + `txHash` + timestamp.
- `SETNX token<id> value` — if key exists, do NOT overwrite; log and continue (idempotent).
- Update `current-token-id` tracker monotonically:
  - Read current tracker; if `< tokenId`, set to `tokenId`; otherwise skip.
- Delete `pending-nft:<id>` on success.

6. Announcement casts (idempotent)

- Call `POST /api/internal/send-cast` with body containing `idem: "mint-<tokenId>"` so retries do not duplicate social posts.

7. Workflow state

- On success: set `NOT_CASTED` for the new holder (one place: the orchestrator).
- On failure: reset to `CASTED` so UI isn’t stuck in `MANUAL_SEND`.

8. Release the operation lock

All API entry points (`user-send-train`, `admin/send-train`) should call this orchestrator and not execute sub-steps themselves.

---

## Endpoint changes

### `/api/user-send-train`

- Preconditions: deposit satisfied, workflow is `CASTED` or `MANUAL_SEND`.
- After deposit confirmation, set workflow to `MANUAL_SEND`.
- Call `orchestrateManualSend`. If it returns 409, show "Sending in progress…" and poll a status endpoint (optional: `GET /api/status/manual-send?fid=...`).
- On non-2xx, reset workflow to `CASTED` (done in UI handler) and surface error toast.
- Remove inline generate/mint logic from this route; it should be a thin wrapper around the orchestrator.

### `/api/admin/send-train`

- Same as user route: thin wrapper calling orchestrator.
- Respect write-once semantics so existing `token<id>` records aren’t overwritten.

### `/api/internal/generate-nft`

- Before composing, check `pending-nft:<tokenId>`; if present and valid, return it rather than regenerating.
- After successful generation/uploads, write `pending-nft:<tokenId>` with full payload and TTL (e.g., 15 minutes). Return that payload.
- Keep randomness (no deterministic seed) — the pending cache ensures de-duplication for a given tokenId during retries.

### `/api/internal/mint-token`

- Respect header `x-no-redis-write: true` to skip any Redis writes. Orchestrator is the single writer.
- Optionally add short lock `lock:mint:<nextTicketId>` to block double execution if route is called directly.
- Validation: use `actualTokenId = tokenId` (the value captured before the transaction) and return it along with `txHash` and `tokenURI`.

---

## Redis helpers (no Lua)

Add small utilities in `lib/redis-utils` (or extend existing `redis-token-utils`):

1. `acquireLock(key: string, ttlMs: number): Promise<boolean>`

- Use `SET key value NX PX ttl`.
- Store a random token if you want strict unlock; otherwise best-effort delete on release.

2. `releaseLock(key: string): Promise<void>`

- Best-effort `DEL key`.

3. `getOrSetPendingGeneration(tokenId: number, producer: () => Promise<PendingNFT>): Promise<PendingNFT>`

- Read `pending-nft:<id>`; if exists, return.
- Else run `producer()`, then `SET pending-nft:<id> payload EX 900`, and return payload.

4. `storeTokenDataWriteOnce(tokenData: TokenData): Promise<'created' | 'exists'>`

- `SETNX token<id> value`; return `'exists'` if key already present.
- Tracker update: read current tracker; if `< tokenId`, set to `tokenId` (separate write). This isn’t perfectly atomic, but safe enough with write-once data and single-writer orchestrator.

Note: If the Redis client supports WATCH/MULTI/EXEC, we can optionally WATCH the tracker key to avoid races when increasing it. This plan assumes simple, widely-supported commands only.

---

## Frontend behavior

- On 409 from orchestrator: disable the button, surface “Sending in progress…”, and optionally poll a status endpoint.
- After deposit confirmation, set state to `MANUAL_SEND`. On any error, reset to `CASTED` so the user can try again.

---

## Instrumentation and health

- Correlation IDs: Include a `correlationId` (e.g., the lock key or a UUID) in logs across generate/mint/store/cast.
- Add `/api/health/token-sync` checks to compare `getTotalTickets()` with Redis keys and report missing tokens.
- Add a small repair script (already present) for backfilling Redis from on-chain.
- Optional cleanup worker: list `pending-nft:*` older than TTL and report or unpin orphans if needed.

---

## Step-by-step implementation checklist

1. Redis utilities

- [ ] Implement `acquireLock`, `releaseLock`.
- [ ] Implement `getOrSetPendingGeneration`.
- [ ] Implement `storeTokenDataWriteOnce` (SETNX + monotonic tracker update).

2. Internal endpoints

- [ ] Update `internal/generate-nft` to use pending cache.
- [ ] Update `internal/mint-token` to honor `x-no-redis-write` and add optional `mint-lock`.

3. Orchestrator

- [ ] Create/extend `lib/train-orchestrator.ts` with `orchestrateManualSend` as described.
- [ ] Make orchestrator the single writer to Redis and the only place that changes workflow state to `NOT_CASTED` on success.

4. Public/admin routes

- [ ] Refactor `user-send-train` to call orchestrator and remove inline generate/mint.
- [ ] Refactor `admin/send-train` similarly.

5. UI

- [ ] Treat 409 as in-progress (disable button + optional polling).
- [ ] Ensure error path resets workflow to `CASTED`.

6. Verification

- [ ] E2E happy path: one click → one image, one mint, Redis tokenN present, timeline updates.
- [ ] Simulate duplicate clicks: second request returns 409; no extra image/mint.
- [ ] Simulate transient failure after generate but before mint: retry uses pending; no duplicate uploads.
- [ ] Admin path cannot overwrite existing `tokenN` in Redis.

---

## Future considerations

- If needed, add a compact status endpoint for UI polling during lock: `GET /api/status/manual-send?tokenId=N`.
- Replace tracker update with WATCH/MULTI when client support is confirmed.
- Optional: scheduled orphan cleanup for `pending-nft:*` beyond TTL.
