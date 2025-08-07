# API Endpoint Cleanup Todo

This document tracks API endpoints that can potentially be removed after moving to the webhook-only cast detection flow.

## 🔴 **Safe to Remove**

### Empty Directories (files already deleted)

- [x] `/api/check-user-cast/` - Empty directory (file was already deleted)
- [x] `/api/user-cast/` - Empty directory
- [x] `/api/choochoo-cast/` - Empty directory
- [x] `/api/send-cast-proxy/` - Empty directory

### Testing Endpoints

- [ ] `/api/test-contract/` - Development/testing only
- [ ] `/api/test-neynar-replies/` - Development/testing only
- [ ] `/api/test-admin-nextstop/` - Development/testing only
- [x] `/api/test-pinata/` - ✅ Renamed to `/api/admin-generate/` with proper admin auth

### Old Cast Management (Pre-Webhook)

- [ ] `/api/cast/` - Old signer-based casting (replaced by webhook flow)
- [ ] `/api/send-announcement-cast/` - No references found in codebase

## 🟡 **Medium Confidence - Investigate Further**

### Reply-Based Features (might be unused)

- [ ] `/api/most-liked-reply/` - No frontend references found
  - **Check**: Are reply-based features planned for future?
- [ ] `/api/check-eligible-replies/` - No frontend references found
  - **Check**: Are reply-based features planned for future?

### Possibly Redundant

- [ ] `/api/get-user-casted/` - Might be redundant with `/api/user-casted-status/`
  - **Action**: Compare functionality and consolidate if duplicate
- [ ] `/api/set-user-casted/` - Might be redundant with `/api/user-casted-status/`
  - **Action**: Compare functionality and consolidate if duplicate

## 🟢 **Keep - Actively Used**

### Currently Referenced in Code

- ✅ `/api/best-friends/` - Used in `Share.tsx`
- ✅ `/api/cast-status/` - Used by new webhook polling system
- ✅ `/api/user-casted-status/` - Used by new webhook flow

### Core Functionality (Keep)

- ✅ `/api/admin-*` - All admin endpoints (app-pause, check-holder-status, send-train, etc.)
- ✅ `/api/current-holder/` - Core functionality for train status
- ✅ `/api/journey/` - Core functionality for displaying journey timeline
- ✅ `/api/internal/*` - Core internal services (generate-nft, mint-token, send-cast, etc.)
- ✅ `/api/webhook/*` - New webhook system for cast detection
- ✅ `/api/enable-*` - Winner selection and public send functionality
- ✅ `/api/send-train/` - Core train movement functionality
- ✅ `/api/user-send-train/` - Manual train sending
- ✅ `/api/yoink*` - Yoink functionality
- ✅ `/api/search-users/` - User search functionality
- ✅ `/api/users/` - User data endpoints
- ✅ `/api/redis/` - Redis management
- ✅ `/api/health/` - Health checks
- ✅ `/api/contract/` - Contract interaction
- ✅ `/api/cast-data/` - Cast data fetching
- ✅ `/api/auth/` - Authentication
- ✅ `/api/opengraph-image/` - Social media previews

## 🔍 **Action Items**

1. **Immediate cleanup**: Remove empty directories and test endpoints
2. **Investigation needed**:
   - Determine if reply-based features are planned for future releases
   - Check for any internal usage of the "medium confidence" endpoints
3. **Code consolidation**:
   - Review user-casted status endpoints for potential duplication
   - Ensure no breaking changes for existing functionality

## Notes

- This analysis was done after implementing the webhook-only cast detection flow
- Empty directories indicate files were already removed during the refactor
- All endpoints marked as "Keep" have confirmed usage in the current codebase
- Test endpoints should only be kept if actively used in development workflow
