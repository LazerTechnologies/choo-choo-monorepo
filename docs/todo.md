# ChooChoo Train - TODO Checklist

## 🚨 High Priority - Core Functionality

### Smart Contract & Backend Integration

- [ ] **Set up admin key for backend** - `contracts/src/ChooChooTrain.sol:12`

  - Configure admin key on backend that can call `nextStop` function
  - Make function either manual or automated following game-flow

- [ ] **Allow admins to bypass all timelocked functions** - `contracts/src/ChooChooTrain.sol`

  - Add admin override capability for all time-locked contract functions
  - Ensure admins can perform emergency actions without waiting for timeouts

- [ ] **Replace dummy journey data with real contract data** - `app/src/components/Home.tsx:59`

  - Connect JourneyTimeline to actual contract data
  - Replace placeholder data with real NFT ticket information

- [ ] **Implement yoink countdown from contract** - `app/src/utils/countdown.ts:1,86,90`

  - Update `getYoinkAvailableTimestamp()` to read from contract
  - Get timestamp of last train movement and add 2/3 days based on user eligibility
  - Replace placeholder countdown with real contract data

- [ ] **Implement yoink logic in dialog** - `app/src/components/ui/dialogs/YoinkDialog.tsx:12`

  - Connect yoink button to actual contract call
  - Handle transaction states and user feedback

- [ ] **Update yoink mechanic for single 2-day window** - `contracts/src/ChooChooTrain.sol`
  - Change yoink to transfer train directly to caller's wallet
  - Add check to prevent users who have previously held the train from yoinking
  - Simplify to single 2-day window (remove 3-day option)
  - Update contract logic to match new yoink rules

### API & Data Management

- [ ] **Add KV store for token ID management** - `generator/src/utils/pinata.ts:129`

  - Store `nextTokenId` in KV to avoid race conditions
  - Don't pull tokenId directly from contract

- [ ] **Add KV store-based fetching for train data** - `app/src/app/api/send-train/route.ts:134`

  - Prevent race conditions in train sending
  - Avoid RPC misuse by caching contract state

- [ ] **Replace cast actions with in-app casting** - `app/src/hooks/useHasEligibleReplies.ts:3`
  - Since cast actions are going away, trigger casts from within app
  - Store cast data in Vercel KV store
  - Check cast replies from KV store instead of external API

## 🔧 Infrastructure & Configuration

### Deployment & Environment

- [ ] **Set Coinbase paymaster** - `contracts/script/ChooChooTrain.s.sol:7`

  - Configure paymaster for gas sponsorship

- [ ] **Remove admin private key in favor of paymaster** - `app/src/app/api/internal/next-stop/execute/route.ts:10`

  - Replace direct admin key usage with paymaster system

- [ ] **Check if project already exists in deploy script** - `app/scripts/deploy.js:407`

  - Add validation to prevent duplicate deployments

- [ ] **Support rebuilding in build script** - `app/scripts/build.js:100`
  - Ensure build script handles rebuilds properly

### Collection & Metadata

- [ ] **Finalize collection metadata** - `generator/src/config.ts:11`
  - Complete collection name, description, and other metadata
  - Ensure all collection details are production-ready

## 🎨 UI/UX Improvements

### YoinkDialog Enhancements

- [ ] **Add yoink timer to dialog** - `app/src/components/ui/dialogs/YoinkDialog.tsx:10`

  - Display countdown timer within the yoink dialog
  - Show when yoink becomes available

- [ ] **Add specific time displays** - `app/src/components/ui/dialogs/YoinkDialog.tsx:40`

  - Show exact timestamps for 2-day and 3-day yoink availability
  - Make timing information more precise

- [x] **Update UI for simplified 2-day yoink window** - `app/src/components/ui/dialogs/YoinkDialog.tsx`
  - Remove 3-day window references from dialog content
  - Update text to reflect single 2-day window for all users
  - Remove "immediate previous passenger" vs "any previous passenger" distinction
  - Simplify countdown logic to single 2-day timer

## 🐛 Bug Fixes & Optimizations

### API Fixes

- [ ] **Fix timestamp field in most-liked-reply** - `app/src/app/api/most-liked-reply/route.ts:124`

  - Ensure using correct timestamp field (not `created_at`)

- [ ] **Add failure handling to send-train flow** - `README.md:123`
  - Add comprehensive error handling for the train sending orchestration
  - Handle failures in each step of the process

## 📱 Future Enhancements

### Smart Contract Features

- [ ] **Implement eligibility-based yoink timing**
  - 2 days for immediate previous passenger
  - 3 days for any previous passenger
  - Add user eligibility checking

### Frontend Features

- [ ] **Add real-time train movement notifications**
- [ ] **Implement journey history pagination**
- [ ] **Add train movement animations**
- [ ] **Implement user profile integration**

---

## 🎯 Next Sprint Priority Order

1. **Countdown integration** (`app/src/utils/countdown.ts`) - Critical for yoink functionality
2. **Yoink logic implementation** (`YoinkDialog.tsx`) - Core user feature
3. **Real journey data** (`Home.tsx`) - Essential for accurate display
4. **KV store setup** (API routes) - Prevents race conditions
5. **Smart contract admin setup** - Required for automation

---

_Last updated: 7/28/2025 @ 23:19_
_Total items: 21 tasks across 13 files_
