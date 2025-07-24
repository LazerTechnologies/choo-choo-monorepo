# ChooChoo Train Implementation Checklist

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
- [ ] **Vercel KV Store Integration:**
  - **Goal:** Store the current cast hash to track which cast is active for replies.
  - **How:**
    1. **Connection:** Use the `@upstash/redis` package to connect to your Vercel KV store.
    2. **API Routes:**
    - Create a `POST` route (e.g., `/api/internal/set-cast-hash`) to store the cast hash.
    - Create a `GET` route (e.g., `/api/get-cast-hash`) to retrieve the cast hash.
- [x] **Implement Orchestration API Route (`/api/send-train`):**
  - **Goal:** Create the main entry point for the train's movement, orchestrating NFT generation and contract interaction.
  - **Status:** Done. This route now handles winner selection, calls the `generator` package, uploads to Pinata, and triggers the internal `nextStop` call.
- [x] **Update Internal API Routes (`/api/internal/next-stop/read` and `/api/internal/next-stop/execute`):**
  - **Goal:** Provide secure interfaces for contract interactions and `totalSupply` queries using distinct endpoints.
  - **Status:** Done. Created separate `/read` endpoint for `totalSupply` queries and `/execute` endpoint for `nextStop` transactions.

## 2.5. Security and Reliability for `/api/send-train`

This section addresses critical security and reliability concerns for the main orchestration API route to ensure production readiness.

- [ ] **Authentication and Authorization:**

  - **Goal:** Restrict access to authorized backend users only to prevent unauthorized train movements.
  - **How:**
    1. **API Key Authentication:** Implement API key validation using environment variables (e.g., `INTERNAL_API_KEY`).
    2. **Request Validation:** Validate all incoming requests with proper input sanitization and type checking.
    3. **Rate Limiting:** Implement per-IP rate limiting to prevent abuse and DoS attacks.
    4. **CORS Configuration:** Restrict CORS to only allow requests from trusted domains.

- [ ] **Idempotency Implementation:**

  - **Goal:** Prevent duplicate processing on retries to avoid ghost tickets and double gas charges.
  - **How:**
    1. **Idempotency Keys:** Require a unique `idempotency-key` header in all requests.
    2. **KV Store Tracking:** Use Vercel KV to store processed idempotency keys with TTL (e.g., 24 hours).
    3. **Duplicate Detection:** Check for existing idempotency keys before processing and return cached results if found.
    4. **Request Deduplication:** Implement proper request deduplication logic to handle concurrent requests.

- [ ] **Retry and Rollback Mechanisms:**

  - **Goal:** Handle failures gracefully from Pinata uploads or contract calls without leaving the system in an inconsistent state.
  - **How:**
    1. **Transaction State Tracking:** Use Vercel KV to track the state of each train movement (pending, processing, completed, failed).
    2. **Pinata Upload Retry:** Implement exponential backoff retry logic for Pinata uploads with proper error handling.
    3. **Contract Call Retry:** Implement retry logic for blockchain transactions with nonce management.
    4. **Rollback Strategy:** If contract call fails after successful Pinata upload, implement cleanup logic to prevent orphaned metadata.
    5. **Dead Letter Queue:** For permanently failed operations, log detailed error information for manual intervention.

- [ ] **Error Handling and Logging:**

  - **Goal:** Provide comprehensive error tracking and debugging capabilities.
  - **How:**
    1. **Structured Logging:** Implement structured logging with correlation IDs for each request.
    2. **Error Classification:** Categorize errors (network, validation, contract, external service) for appropriate handling.
    3. **Alerting:** Set up alerts for critical failures (contract call failures, Pinata upload failures).
    4. **Audit Trail:** Log all train movements with timestamps, user info, and transaction hashes.

- [ ] **Circuit Breaker Pattern:**
  - **Goal:** Prevent cascading failures when external services are down.
  - **How:**
    1. **Pinata Circuit Breaker:** Implement circuit breaker for Pinata API calls to fail fast when service is unavailable.
    2. **Blockchain Circuit Breaker:** Implement circuit breaker for RPC calls to prevent timeouts.
    3. **Fallback Mechanisms:** Provide graceful degradation when external services are unavailable.

## 3. NFT Image and Metadata Generation

This section covers the on-demand creation of NFT images and metadata using a dedicated `generator` package. This approach is optimized for a serverless environment like Vercel.

- [x] **Create a dedicated `generator` package:**

  - **Goal:** Isolate all image and metadata generation logic from the Next.js frontend application.
  - **Status:** Done. A new `generator` package has been created in the monorepo root.

- [x] **Add Artwork and Configure Git LFS:**

  - **Goal:** Store all raw art layers in the repository without bloating the Git history.
  - **Status:** Done. All artwork has been added to `generator/layers/`. Git LFS has been configured to track all `.png` and `.jpg` files, and the `.gitattributes` file is committed.

- [x] **Implement Rarity and Trait Management:**

  - **Goal:** Create a flexible system for defining trait rarities that can be easily updated.
  - **Status:** Done. A `generator/rarities.json` file has been created to map each trait to a numerical weight. The composition logic reads this file directly.

- [x] **Implement Core Generation Logic in TypeScript:**
  - **Goal:** Write clean, well-typed, and maintainable code for composing images and uploading them to IPFS.
  - **Status:** Done. The following files have been implemented:
    - `src/config.ts`: Defines layer order, image dimensions, and collection metadata.
    - `src/utils/compose.ts`: Contains the logic to select traits based on rarity and compose the final image using `canvas`.
    - `src/utils/pinata.ts`: Contains helper functions to upload image buffers and metadata JSON to Pinata.

## 4. Frontend UI Development

With the backend in place, you can now build out the user interface.

- [ ] **Component Implementation:**
  - **Goal:** Create the React components outlined in the documentation.
  - **How:**
    - `NFTDisplay.tsx`: Display the NFT image and metadata.
    - `TrainJourney.tsx`: Show the history of the train's journey.
    - `SendTrainButton.tsx`: The button for the current holder to trigger the `nextStop` flow.
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
  - **Goal:** Confirm that the API routes, especially the new `/api/generate-nft` route, are functioning correctly in the deployed environment.
  - **How:**
    - After deployment, use the Vercel dashboard logs to monitor the execution of your serverless functions.
    - Trigger the `generate-nft` flow and check the logs for any errors related to file access, canvas operations, or API calls to Pinata.
