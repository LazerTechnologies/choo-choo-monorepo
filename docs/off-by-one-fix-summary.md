# Off-by-One Token ID Fix Summary

This document summarizes the comprehensive refactor performed to fix off-by-one token ID issues and ensure on-chain data is the authoritative source of truth for all token operations.

## Root Cause Analysis

The off-by-one issues were caused by:

1. **Inconsistent Token ID Sources**: Different endpoints used different methods to calculate the next token ID:

   - Some used `totalSupply + 1` (incorrect - includes train token 0)
   - Some used Redis tracker (could drift from on-chain reality)
   - Some used `getNextTokenId()` which had fallback logic

2. **Wrong Passenger Metadata**: NFT metadata was generated with the new holder's username instead of the departing passenger's username

3. **Missing Redis Data**: The yoink flow didn't store token data in Redis, causing frontend gaps

4. **Validation Logic Errors**: Comparing `totalSupply` to `tokenId` was incorrect since `totalSupply` includes the train (token 0)

## Changes Made

### 1. Contract Service Enhancement

**File**: `app/src/lib/services/contract.ts`

- Added `getNextOnChainTicketId()` method as the single source of truth for next token ID
- This method uses `getTrainStatus().nextTicketId` from the contract

### 2. Internal Mint Token Endpoint (Authoritative)

**File**: `app/src/app/api/internal/mint-token/route.ts`

- **BREAKING**: Removed `tokenId` from request interface - endpoint now determines token ID internally
- Gets authoritative token ID from contract before minting
- Fixed validation to use `getTotalTickets()` instead of `getTotalSupply()`
- Ensures Redis tracker is updated with the correct token ID

### 3. Send Train Route Fixes

**File**: `app/src/app/api/send-train/route.ts`

- Uses `getNextOnChainTicketId()` instead of `totalSupply + 1`
- Generates NFT metadata with departing passenger's username (current holder)
- Removes `tokenId` from mint request (now determined by mint endpoint)

### 4. User Send Train Route Fixes

**File**: `app/src/app/api/user-send-train/route.ts`

- Uses `getNextOnChainTicketId()` instead of Redis tracker
- Generates NFT metadata with departing passenger's username
- Removes `tokenId` from mint request

### 5. Admin Send Train Route Fixes

**File**: `app/src/app/api/admin/send-train/route.ts`

- Uses `getNextOnChainTicketId()` instead of Redis tracker
- Generates NFT metadata with departing passenger's username
- Fixed mint request to use correct interface
- Uses actual token ID from mint response for notifications

### 6. Yoink Route Comprehensive Fix

**File**: `app/src/app/api/yoink/route.ts`

- Uses `getNextOnChainTicketId()` instead of `totalSupply + 1`
- **NEW**: Stores comprehensive token data in Redis (was missing before)
- **NEW**: Properly creates metadata with departing passenger's username
- Gets NFT recipient address before yoink (not after)
- Sets ticket data on contract with correct token ID

### 7. Test Route Fixes

**Files**:

- `app/src/app/api/admin/nextstop/route.ts`
- `app/src/app/api/admin/generate/route.ts`

- Use `getNextOnChainTicketId()` consistently
- Fixed validation logic to use `getTotalTickets()`

### 8. Redis Token Utils Deprecation

**File**: `app/src/lib/redis-token-utils.ts`

- Deprecated `getNextTokenId()` function with warning
- Function now delegates to contract service for consistency

### 9. New Health Check Endpoint

**File**: `app/src/app/api/health/token-sync/route.ts`

- **NEW**: Validates Redis and on-chain token data are in sync
- Detects missing tokens, extra tokens, and tracker mismatches
- Returns detailed health report for monitoring

### 10. Train Movement Orchestrator

**File**: `app/src/lib/train-orchestrator.ts`

- **NEW**: Unified orchestrator for all train movements
- Prevents future drift by centralizing the logic
- Ensures consistent token ID handling and passenger metadata
- Includes specialized yoink orchestrator

### 11. Repair Script

**File**: `app/src/scripts/repair-redis-token-sync.ts`

- **NEW**: Script to repair existing Redis inconsistencies
- Can run in dry-run mode to preview changes
- Fixes missing token data, incorrect token IDs, and tracker mismatches

## Key Principles Established

1. **On-Chain as Source of Truth**: All token ID calculations now use `getNextOnChainTicketId()`
2. **Correct Passenger Metadata**: NFT metadata always uses the departing passenger's username
3. **Authoritative Minting**: The mint endpoint determines token IDs, callers don't specify them
4. **Complete Redis Storage**: All token movements store comprehensive data in Redis
5. **Consistent Validation**: Use `getTotalTickets()` for validation, not `getTotalSupply()`

## Migration Steps

1. **Deploy the fixes** to your environment
2. **Run the health check** to identify existing issues:
   ```bash
   curl /api/health/token-sync
   ```
3. **Run the repair script** to fix existing data:

   ```bash
   # Dry run first
   npx tsx src/scripts/repair-redis-token-sync.ts --dry-run

   # Apply fixes
   npx tsx src/scripts/repair-redis-token-sync.ts
   ```

4. **Monitor the health check** regularly to catch future drift

## Breaking Changes

- `tokenId` parameter removed from `/api/internal/mint-token` request interface
- Deprecated `getNextTokenId()` function in `redis-token-utils.ts`

## Validation

After deployment, verify the fixes by:

1. Checking the health endpoint shows `healthy: true`
2. Performing a train movement and verifying:
   - Token ID matches on-chain `nextTicketId`
   - NFT metadata has correct passenger trait (departing passenger)
   - Redis contains complete token data
   - Frontend displays the token correctly

## Future Prevention

- Use the train orchestrator for new movement types
- Always use `getNextOnChainTicketId()` for token ID calculations
- Monitor the health check endpoint
- Run the repair script periodically if needed

This refactor eliminates the off-by-one issues and establishes a robust, consistent system where on-chain data is always the authoritative source of truth.
