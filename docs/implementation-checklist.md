# ChooChoo Train Implementation Checklist

## IMMEDIATE PRIORITY: Fix Canvas/Native Dependencies Issue

The `/api/send-train` endpoint is currently crashing due to the `canvas` package's native binaries not being compatible with Next.js serverless functions. Here's the step-by-step solution:

### Phase 1: Canvas Issue Resolution

- [ ] **Option A: Switch to Canvas-Free Image Generat**

  - **Goal:** Replace `canvas` with a serverless-friendly image generation solution
  - **How:**
    1. **Install `@vercel/og` or similar:** Replace canvas with a serverless-compatible image generation library
    2. **Update generator package:** Rewrite `generator/src/utils/compose.ts` to use SVG/HTML-based composition instead of canvas
    3. **Alternative:** Use `sharp` + pre-rendered layer PNGs for server-side composition
    4. **Benefit:** Works in Vercel serverless functions without native dependencies

### Phase 2: Complete Backend Orchestration Implementation

Once canvas issue is resolved, implement the full backend flow:

- [ ] **Environment Setup & Configuration:**

  - [ ] **Vercel KV Store Setup:**
    - Create Vercel KV instance in dashboard
    - Add `KV_REST_API_URL` and `KV_REST_API_TOKEN` to environment variables
    - Install `@upstash/redis` in app package
  - [ ] **Required Environment Variables:**
    ```
    NEYNAR_API_KEY=your_neynar_key
    PINATA_JWT=your_pinata_jwt
    CHOOCHOO_TRAIN_ADDRESS=contract_address
    ADMIN_PRIVATE_KEY=private_key
    RPC_URL=base_rpc_url
    INTERNAL_SECRET=random_secret_string
    APP_URL=http://localhost:3000 (dev) / https://yourdomain.com (prod)
    USE_MAINNET=false (dev) / true (prod)
    KV_REST_API_URL=your_vercel_kv_url
    KV_REST_API_TOKEN=your_vercel_kv_token
    ```

- [ ] **KV Store Integration:**

  - [ ] **Create KV utilities:**
    - `app/src/lib/kv.ts` - Helper functions for KV operations
    - Functions: `setCastHash()`, `getCastHash()`, `setTokenMetadata()`, `getTokenMetadata()`
  - [ ] **Cast hash management:**
    - Store active cast hash for reply tracking
    - Update when new casts are posted
  - [ ] **Transaction state tracking:**
    - Store processing states: pending, processing, completed, failed
    - Implement idempotency for retry protection

- [ ] **Pinata Integration Setup:**

  - [ ] **Verify Pinata configuration:**
    - Test JWT token in environment
    - Verify upload permissions
  - [ ] **Error handling:**
    - Implement retry logic for failed uploads
    - Add proper error messages and logging

- [ ] **Contract Integration Completion:**

  - [ ] **Test contract calls:**
    - Verify `nextStop` function works with admin private key
    - Test `totalSupply` reading
  - [ ] **Add transaction monitoring:**
    - Wait for transaction confirmation
    - Return transaction hash in response
  - [ ] **Gas optimization:**
    - Implement proper gas estimation
    - Add error handling for failed transactions

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
- [x] **Vercel KV Store Integration:** _(Updated above in Phase 2)_
- [x] **Implement Orchestration API Route (`/api/send-train`):**
  - **Goal:** Create the main entry point for the train's movement, orchestrating NFT generation and contract interaction.
  - **Status:** Partially implemented but needs canvas fix and completion per Phase 2 above.
- [x] **Update Internal API Routes (`/api/internal/next-stop/read` and `/api/internal/next-stop/execute`):**
  - **Goal:** Provide secure interfaces for contract interactions and `totalSupply` queries using distinct endpoints.
  - **Status:** Done. Created separate `/read` endpoint for `totalSupply` queries and `/execute` endpoint for `nextStop` transactions.

## 2.5. Security and Reliability for `/api/send-train`

_(Updated and expanded above in Phase 2)_

- [x] **Create a dedicated `generator` package:**

  - **Goal:** Isolate all image and metadata generation logic from the Next.js frontend application.
  - **Status:** Done but needs canvas fix per Phase 1 above.

- [x] **Add Artwork and Configure Git LFS:**

  - **Goal:** Store all raw art layers in the repository without bloating the Git history.
  - **Status:** Done. All artwork has been added to `generator/layers/`. Git LFS has been configured to track all `.png` and `.jpg` files, and the `.gitattributes` file is committed.

- [x] **Implement Rarity and Trait Management:**

  - **Goal:** Create a flexible system for defining trait rarities that can be easily updated.
  - **Status:** Done. A `generator/rarities.json` file has been created to map each trait to a numerical weight. The composition logic reads this file directly.

- [x] **Implement Core Generation Logic in TypeScript:**
  - **Goal:** Write clean, well-typed, and maintainable code for composing images and uploading them to IPFS.
  - **Status:** Done but needs canvas replacement per Phase 1 above.
    - `src/config.ts`: Defines layer order, image dimensions, and collection metadata.
    - `src/utils/compose.ts`: Contains the logic to select traits based on rarity and compose the final image using `canvas`. **NEEDS CANVAS REPLACEMENT**
    - `src/utils/pinata.ts`: Contains helper functions to upload image buffers and metadata JSON to Pinata.

## 4. Frontend UI Development

With the backend in place, you can now build out the user interface.

- [x] **Component Implementation:**
  - **Goal:** Create the React components outlined in the documentation.
  - **Status:** Basic components implemented, needs expansion:
    - ✅ `NextStopTrigger` component added to Home.tsx
    - [ ] `NFTDisplay.tsx`: Display the NFT image and metadata.
    - [ ] `TrainJourney.tsx`: Show the history of the train's journey.
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
