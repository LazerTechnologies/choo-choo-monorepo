# ChooChoo Train Implementation Checklist

## Phase 1: NFT Creation

- [x] write `ChooChooTrain.sol` and scripts
- [x] get image generator working

## Phase 2: Complete Backend Orchestration Implementation

- [x] **Railway setup**
- [x] **Redis**

  - [ ] **Create Redis utilities:**
    - `app/src/lib/kv.ts` - Helper functions for KV operations
    - Functions: `setCastHash()`, `getCastHash()`, `setTokenMetadata()`, `getTokenMetadata()`
  - [ ] **Cast hash management:**
    - Store active cast hash for reply tracking
    - Update when new casts are posted
  - [ ] **Transaction state tracking:**
    - Store processing states: pending, processing, completed, failed
    - Implement idempotency for retry protection

- [x] **Pinata Integration**

- [x] **Contract Integration Completion:**

  - [x] **Test contract calls:**
    - Verify `nextStopWithTicketData` function works with admin private key
    - Test `totalSupply` reading
    - Added new contract read methods: `getCurrentTrainHolder`, `getTrainStatus`, `hasRiddenTrain`, `getTotalTickets`
  - [x] **Add transaction monitoring:**
    - Return transaction hash in response
    - Enhanced error handling for admin-only restrictions
  - [x] **Gas optimization:**
    - Implement proper gas estimation with `estimateNextStopGas`
    - Add comprehensive error handling for failed transactions

- [ ] **Security & Reliability Implementation:**

  - [ ] **Request validation:**
    - Validate cast hash format
    - Sanitize all inputs
    - Add rate limiting (use Vercel's rate limiting or upstash)
  - [ ] **Idempotency:**
    - Require `idempotency-key` header
    - Store processed keys in KV with TTL
    - Return cached results for duplicate requests
  - [ ] **Error handling & rollback:**
    - Implement transaction state machine
    - Rollback Pinata uploads on contract failures
    - Add comprehensive logging

- [ ] **API Route Completion:**
  - [ ] **Update `/api/send-train`:**
    - Fix missing `try` keyword (line 103)
    - Add comprehensive error handling
    - Implement all security measures
    - Add proper logging
  - [ ] **Complete missing functions:**
    - `fetchRepliesAndReactions()` - may need implementation
    - Verify all imports are working
  - [ ] **Add health check endpoint:**
    - `/api/health` - Test all external services
    - Verify contract connectivity, Pinata, Neynar, KV store

## 1. Smart Contract Modifications

- [x] **Integrate OpenZeppelin `ERC2771Context`:**

  1. Import `ERC2771Context.sol`: `import {ERC2771Context} from "openzeppelin-contracts/metatx/ERC2771Context.sol";`
  2. Inherit from `ERC2771Context` in your contract definition: `contract ChooChooTrain is ERC721Enumerable, Ownable, ERC2771Context { ... }`
  3. Update the `constructor` to accept a `trustedForwarder` address and pass it to the `ERC2771Context` constructor: `constructor(address trustedForwarder) ERC721("ChooChooTrain", "CHOOCHOO") Ownable(msg.sender) ERC2771Context(trustedForwarder) { ... }`
  4. Override the `_msgSender()` and `_msgData()` functions to use the `ERC2771Context` implementation.

- [x] **Update `nextStop` and `yoink` to use `_msgSender()`:**

- [x] **Add a `setTicketData` Function for Backend Metadata Updates:**

- [x] **Modify `_stampTicket` to Only Mint:**

- [x] write scripts to set and manage admin accounts in the `/contracts/script` directory. place them all in one file, but have different function/contract/scripts for each of the actions

## 2. Backend API Development

The backend is the core of the application, orchestrating the train's movement, NFT creation, and Farcaster interactions.

- [ ] **Implement Coinbase Paymaster:**
  - **Goal:** Remove the need for users to pay gas fees when interacting with the contract.
  - **How:**
    1. **Research:** Deep dive into the Coinbase Paymaster documentation. Understand how to integrate it with your existing contract and backend.
    2. **Integration:** Modify your contract to support the paymaster. This might involve inheriting from a `BasePaymaster` contract or similar.
    3. **Backend Logic:** Update your backend API to use the paymaster when sending transactions. This will involve using a specific RPC endpoint and signing the transaction with your paymaster sponsor key.
- [ ] **Set up Farcaster Signer:**
  - **Goal:** Allow the application to post casts on behalf of the ChooChoo Train Farcaster account.
  - **How:**
    1. **Neynar Signer:** Use the Neynar API to create a signer for your app's Farcaster account. This will give you an `signer_uuid` that you can use to post casts.
    2. **API Route:** Create a new API route (e.g., `/api/internal/post-cast`) that uses the Neynar SDK and the `signer_uuid` to post a cast.
    3. **Security:** Ensure this route is protected and can only be called by your backend services.
- [x] **Implement Orchestration API Route (`/api/send-train`):**
  - **Goal:** Create the main entry point for the train's movement, orchestrating NFT generation and contract interaction.
  - **Status:** Partially implemented but needs canvas fix and completion per Phase 2 above.
- [x] **Update Internal API Routes (`/api/internal/next-stop/read` and `/api/internal/next-stop/execute`):**
  - **Goal:** Provide secure interfaces for contract interactions and `totalSupply` queries using distinct endpoints.
  - **Status:** Done. Created separate `/read` endpoint for `totalSupply` queries and `/execute` endpoint for `nextStop` transactions.

## 3. Test all pieces of `api/send-train`

### 3.1 Neynar API Integration Testing

- [x] **Create test endpoint:** `/api/test-neynar-replies`
  - [x] Test `fetchReactions` function with real cast hash
  - [x] Verify API pagination works with `cursor` parameter
  - [x] Test unique user deduplication (no reaction counting needed)
  - [x] Verify primary wallet extraction logic:
    - `verified_addresses.primary.eth_address` → `verified_addresses.eth_addresses[0]` fallback
  - [x] Test random winner selection from all eligible reactors
  - [x] Verify FID deduplication works correctly
  - [x] Test edge cases: no replies, invalid cast hash, API rate limits
  - [x] Return complete user data: fid, username, display_name, pfp_url, primary.eth_address

### 3.2 Contract Service Integration Testing

- [x] **Create test endpoint:** `/api/test-contract`
  - [x] Test contract connection works with RPC endpoint
  - [x] Verify `getTotalSupply()` returns correct current value
  - [x] Test token ID calculation (`totalSupply + 1`) accuracy
  - [x] Test `executeNextStop()` transaction submission (testnet first)
  - [x] Verify gas estimation and transaction confirmation
  - [x] Test contract error handling (insufficient gas, invalid recipient)

### 3.3 Winner Selection Algorithm Testing

- [x] **Test random selection logic:**
  - [x] Test with eligible reactors of varying counts
  - [x] Verify random selection produces different winners on repeated calls
  - [x] Test edge case: single reactor
  - [x] Verify address validation for selected winner
  - [x] Test winner selection with multiple eligible users

### 3.4 Token ID Coordination Testing

- [ ] **Test end-to-end token ID consistency:**
  - [ ] Contract `totalSupply` → calculated `tokenId` matches
  - [ ] Image naming uses correct token ID
  - [ ] Metadata references correct token ID
  - [ ] Redis storage uses correct token ID keys
  - [ ] Test no race conditions with simultaneous requests

### 3.5 Error Recovery & Edge Cases Testing

- [ ] **Test failure scenarios:**
  - [ ] Neynar API failures: rate limiting, timeouts, invalid responses
  - [ ] Pinata upload failures: network issues, authentication errors
  - [ ] Contract transaction failures: insufficient gas, reverted transactions
  - [ ] Redis storage failures (should not break main flow)
  - [ ] Invalid input: malformed cast hashes, non-existent casts
  - [ ] Casts with no eligible replies (no verified addresses)

### 3.6 Environment Variables & Configuration Testing

- [x] **Verify all required environment variables:**
  - [x] `NEYNAR_API_KEY` is valid and has necessary permissions
  - [x] `PINATA_JWT` works for image and metadata uploads
  - [ ] `RPC_URL` connects to correct network (testnet/mainnet)
  - [ ] `CHOOCHOO_TRAIN_ADDRESS` points to correct deployed contract
  - [ ] `ADMIN_PRIVATE_KEY` has minting permissions on contract
  - [x] Redis connection variables are correct

### 3.7 Comprehensive Integration Test

- [ ] **Create comprehensive test endpoint:** `/api/test-send-train-components`
  - [ ] Run all component tests with health check report
  - [ ] Test complete end-to-end flow with mock data
  - [ ] Verify all components work together correctly
  - [ ] Generate test report with pass/fail status for each component

## 4. Frontend UI Development

With the backend in place, you can now build out the user interface.

- [x] **Component Implementation:**
  - **Goal:** Create the React components outlined in the documentation.
  - **Status:** Basic components implemented, needs expansion:
    - [x] `NextStopTrigger` component added to Home.tsx
    - [ ] `NFTDisplay.tsx`: Display the NFT image.
    - [ ] `TrainJourney.tsx`: Show the history of the train's journey.
      - [ ] show the correct NFT for each step of the history
      - in Redis, each KV should be "token<tokenId>-metadata" : "<IPFS_hash>" (i.e. "token13-metadata" : "Qc0m...")
    - [ ] `SendTrainButton.tsx`: Enhanced version of current trigger.
- [ ] **Wagmi and Viem Integration:**
  - **Goal:** Connect the frontend to the blockchain.
  - **How:**
    - Use the `useWriteContract` hook from `wagmi` to call the `nextStop` function (for manual transfers).
    - Use `viem` to interact with the contract for read-only operations (e.g., getting the current holder).
- [ ] **Farcaster AuthKit:**
  - **Goal:** Authenticate users with their Farcaster accounts.
  - **How:**
    - Integrate the `@farcaster/auth-kit` into your frontend to handle the login flow.
    - Use the authentication status to protect routes and show/hide UI elements.

## 5. Testing and Deployment

- [ ] **End-to-End Testing:**
  - **Goal:** Ensure the entire flow works as expected.
  - **How:**
    - Write tests that simulate a user creating a cast, another user replying, and the first user triggering the `nextStop` flow.
    - Use a testing framework like Vitest or Jest.
- [ ] **Deployment:**
  - **Goal:** Deploy the application to Vercel.
  - **How:**
    - Use the Vercel CLI to deploy your Next.js application.
    - Ensure all environment variables are set up correctly in your Vercel project.

## 6. Operational Readiness

This section outlines tasks to ensure the application is robust and maintainable in a production environment.

- [ ] **Robust Error Handling & Logging:**
  - **Goal:** Implement comprehensive error handling and structured logging across all backend services.
  - **How:** Ensure all API routes and the `generator` package log errors effectively, potentially integrating with a centralized logging service.
- [ ] **Monitoring & Alerting:**
  - **Goal:** Set up systems to proactively monitor application health and alert on issues.
  - **How:** Implement monitoring for API response times, error rates, and successful external service interactions (Pinata, Neynar, blockchain).
- [ ] **Rate Limiting:**
  - **Goal:** Protect public API endpoints from abuse and ensure fair usage.
  - **How:** Implement rate limiting on public-facing API routes (e.g., `/api/send-train`) to prevent excessive requests.

## 7. Deployment on Vercel

This section outlines the key considerations for deploying the entire monorepo to Vercel.

- [ ] **Vercel Project Configuration:**

  - **Goal:** Set up the Vercel project to correctly build and deploy the Next.js application from the monorepo.
  - **How:**
    1. Connect your GitHub repository to a new Vercel project.
    2. In the project settings, set the "Root Directory" to `app`. This tells Vercel to run the build from within your Next.js app directory.
    3. Vercel should automatically detect that you are using pnpm and a workspace.

- [ ] **Environment Variables:**

  - **Goal:** Securely provide all necessary API keys and secrets to the Vercel environment.
  - **How:**
    - In the Vercel project settings, add all required environment variables. This includes, but is not limited to:
      - `PINATA_JWT`: For authenticating with the Pinata IPFS service.
      - `NEYNAR_API_KEY`: For Farcaster interactions.
      - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: For Vercel KV.
      - `YOUR_RPC_URL`: An RPC endpoint for your chosen blockchain.
      - `SPONSOR_WALLET_PRIVATE_KEY`: The private key for your paymaster sponsor wallet.

- [ ] **Handling Git LFS:**

  - **Goal:** Ensure the large image assets stored in Git LFS are available during the build and at runtime.
  - **How:**
    - No extra configuration is needed. Vercel has native support for Git LFS.
    - As long as your `.gitattributes` file is committed to the repository, Vercel's build process will automatically detect it, download the LFS objects, and make the full-resolution images in `generator/layers` available to your serverless functions.

- [ ] **Verify Serverless Function Operation:**
  - **Goal:** Confirm that the API routes, especially the new `/api/send-train` route, are functioning correctly in the deployed environment.
  - **How:**
    - After deployment, use the Vercel dashboard logs to monitor the execution of your serverless functions.
    - Trigger the `send-train` flow and check the logs for any errors related to file access, canvas operations, or API calls to Pinata.
