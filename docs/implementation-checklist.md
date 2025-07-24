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
- [ ] **Implement Remaining API Routes:**
  - **Goal:** Build out the remaining API routes as defined in the documentation.
  - **How:**
    - `/api/trigger-next-stop`: This will be the main entry point for the user to trigger the train's movement. It should authenticate the user, verify they are the current holder, and then trigger the backend orchestration.
    - `/api/pinata/mint`: This route will handle the image and metadata uploads to Pinata.
    - `/api/next-stop`: This internal route will call the contract's `nextStop` function.

## 3. NFT Image and Metadata

This section focuses on creating the visual assets for the NFTs and uploading them to IPFS.

- [ ] **Image Composition:**
  - **Goal:** Combine trait images to create the final NFT image.
  - **How:**
    1. **Image Library:** Use a library like `sharp` or `canvas` in a Node.js environment to composite the images.
    2. **API Route:** Create an API route (e.g., `/api/internal/compose-image`) that takes the traits as input and returns the composed image.
- [ ] **IPFS Upload:**
  - **Goal:** Upload the composed image and metadata to IPFS.
  - **How:**
    1. **Pinata SDK:** Use the Pinata SDK to upload the image and metadata JSON.
    2. **API Integration:** Integrate the IPFS upload logic into your `/api/pinata/mint` route.

### 3.1 On-Demand Generation with HashLips Art Engine (Vercel-friendly)

assuming <5 mints/day - Vercel backgrond function

- [ ] **Project Structure & Assets**

  1. **Add `/art/layers`** folder at the repo root; store trait PNGs here.
  2. **Git Hygiene:**
     - Commit only _low-res_ or placeholder layers.
     - Add `art/output` and large binaries to `.gitignore` or Git LFS.
  3. **Environment Variable:** `ART_LAYERS_PATH` → defaults to `process.cwd()/art/layers` for flexibility across local & CI.

- [ ] **Install HashLips Art Engine**

  ```bash
  pnpm add -D @hashlips-lab/art-engine @napi-rs/canvas
  ```

  (`@napi-rs/canvas` bundles pre-built binaries → smaller Vercel uploads.)

- [ ] **Create a Vercel Background Function**
      Path: `app/api/internal/generate-art/route.ts`

  - Exports a `POST` handler; body: `{ tokenId: number }`.
  - Sets `runtime = "edge"` _false_ → forces Node (needed for native modules).
  - Uses the snippet below to generate **one** edition:

  ```ts
  import {
    ArtEngine,
    inputs,
    generators,
    renderers,
    exporters,
  } from '@hashlips-lab/art-engine';
  import pinata from '@pinata/sdk';

  export const config = { runtime: 'nodejs' };

  async function generateEdition(editionId: number) {
    const ae = new ArtEngine({
      cachePath: `/tmp/cache`,
      outputPath: `/tmp/output`,
      useCache: false,
      inputs: {
        traits: new inputs.ImageLayersInput({
          assetsBasePath: process.env.ART_LAYERS_PATH!,
        }),
      },
      generators: [
        new generators.ImageLayersAttributesGenerator({
          dataSet: 'traits',
          startIndex: editionId,
          endIndex: editionId,
        }),
      ],
      renderers: [
        new renderers.ImageLayersRenderer({ width: 2048, height: 2048 }),
        new renderers.ItemAttributesRenderer(),
      ],
      exporters: [
        new exporters.ImagesExporter(),
        new exporters.Erc721MetadataExporter(),
      ],
    });
    await ae.run();
    return {
      imagePath: `/tmp/output/images/${editionId}.png`,
      metadataPath: `/tmp/output/json/${editionId}.json`,
    };
  }
  ```

- [ ] **Pinata Integration**

  1. Install SDK: `pnpm add @pinata/sdk`.
  2. Add env vars: `PINATA_JWT`, `PINATA_GATEWAY_URL`.
  3. In the same route handler:
     - Upload the PNG → receive `imageCID`.
     - Patch `image` field inside metadata JSON with `ipfs://$imageCID/${editionId}.png`.
     - Upload patched JSON → receive `metaCID`.
     - Return `{ imageCID, metaCID }` in the HTTP response.

- [ ] **Concurrency Safeguards**

  1. Use `@upstash/redis` KV to store & increment `nextTokenId` atomically (`INCR`).
  2. Store `dnaHash => tokenId` to prevent duplicates.

- [ ] **Security & Access Control**

  - Protect the endpoint with an HMAC header or Vercel Cron invocation token; only backend services should hit it.

- [ ] **Testing**

  1. Write a Vitest that mocks Pinata, hits the route 10×, and verifies:
     - Unique DNA hashes.
     - Valid IPFS CIDs returned.
  2. Snapshot the metadata schema with `expect(metadata).toMatchSnapshot()`.

- [ ] **Deployment Notes**

  1. Vercel limits: 1024 MB RAM, 50 MB bundled code; `@napi-rs/canvas` keeps us under the cap.
  2. Cold start ~2 s; acceptable for ≤5 mints/day.
  3. No persistent disk; rely on `/tmp` only.

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
