# ChooChoo Train Implementation Checklist

This document outlines the next steps for completing the ChooChoo Train project. It's broken down into logical sections to help you focus on one area at a time.

## 1. Smart Contract Modifications

To support gasless transactions with Coinbase Paymaster and allow the backend to securely manage NFT metadata, you'll need to make the following changes to `contracts/src/ChooChooTrain.sol`:

- [x] **Integrate OpenZeppelin `ERC2771Context`:**

  - **Goal:** Allow the contract to correctly identify the original user (the "sender") when a transaction is relayed by a gasless provider (the "forwarder").
  - **How:**
    1. Import `ERC2771Context.sol`: `import {ERC2771Context} from "openzeppelin-contracts/metatx/ERC2771Context.sol";`
    2. Inherit from `ERC2771Context` in your contract definition: `contract ChooChooTrain is ERC721Enumerable, Ownable, ERC2771Context { ... }`
    3. Update the `constructor` to accept a `trustedForwarder` address and pass it to the `ERC2771Context` constructor: `constructor(address trustedForwarder) ERC721("ChooChooTrain", "CHOOCHOO") Ownable(msg.sender) ERC2771Context(trustedForwarder) { ... }`
    4. Override the `_msgSender()` and `_msgData()` functions to use the `ERC2771Context` implementation.

- [x] **Update `nextStop` and `yoink` to use `_msgSender()`:**

- [ ] **Add a `setTicketData` Function for Backend Metadata Updates:**

  - **Goal:** Create a secure, owner-only function that allows the backend to update a ticket's metadata _after_ it has been minted by the user.
  - **How:**
    1. Create a new function `setTicketData(uint256 tokenId, string memory fullTokenURI, string memory image, string memory traits)`
    2. Mark it as `external` and `onlyOwner`.
    3. Inside the function, update the `ticketData` mapping for the given `tokenId`.

- [ ] **Modify `_stampTicket` to Only Mint:**

  - **Goal:** Separate the minting of the ticket from the setting of its metadata.
  - **How:**
    - In the `_stampTicket` function, remove the lines that set the `tokenURI`, `image`, and `traits`. The function should only be responsible for minting the new ticket NFT.

- [ ] write scripts to set and manage admin accounts in the `/contracts/script` directory. place them all in one file, but have different function/contract/scripts for each of the actions

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

This checklist should provide a clear path forward. Good luck, and have fun building!
