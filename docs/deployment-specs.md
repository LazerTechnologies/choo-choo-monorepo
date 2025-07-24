# ChooChoo Train: Deployment Specifications on Vercel

This document details the process and considerations for deploying the entire ChooChoo Train monorepo, including the Next.js application, the NFT generator, and associated backend logic, to Vercel.

---

## 1. Vercel Project Setup

To deploy your monorepo on Vercel, you need to configure the project correctly to recognize the Next.js application within the `app/` directory and handle the monorepo structure.

-   **Connect Repository:** Connect your GitHub repository (where this monorepo resides) to a new Vercel project.
-   **Root Directory:** In the Vercel project settings, ensure the **"Root Directory"** is explicitly set to `app`. This tells Vercel that your primary application to build and deploy is located within the `app/` folder of your monorepo.
-   **Monorepo Detection:** Vercel has native support for monorepos managed by tools like pnpm and Turborepo. It should automatically detect your `pnpm-workspace.yaml` and `turbo.json` files and configure the build process accordingly. No special build commands are typically needed beyond what's defined in your `app/package.json` (e.g., `pnpm build`).

---

## 2. Environment Variables

All sensitive API keys, secrets, and configuration values must be securely provided to your Vercel deployment as environment variables. These are crucial for the backend API routes and the NFT generator to function correctly.

Add the following environment variables in your Vercel project settings (for both `Production` and `Development` environments as appropriate):

-   **`APP_URL`**: The public URL of your deployed Vercel application (e.g., `https://your-app-name.vercel.app`). This is used for internal API calls within your application.
-   **`INTERNAL_SECRET`**: A strong, randomly generated secret string. This is used to protect internal API routes (e.g., `/api/internal/next-stop`) from unauthorized access.
-   **`PINATA_JWT`**: Your Pinata Cloud JWT (JSON Web Token) for authenticating API requests to upload images and metadata to IPFS.
-   **`NEYNAR_API_KEY`**: Your API key for the Neynar Farcaster API, used for fetching cast replies, user data, and potentially posting casts.
-   **`CHOOCHOO_TRAIN_ADDRESS`**: The deployed address of your `ChooChooTrain` smart contract on the blockchain.
-   **`ADMIN_PRIVATE_KEY`**: The private key of the wallet authorized to call sensitive functions on your `ChooChooTrain` contract (e.g., `nextStop`). **Handle with extreme care; never expose this in client-side code.**
-   **`RPC_URL`**: An RPC endpoint URL for the blockchain network your contract is deployed on (e.g., Base Mainnet or Base Sepolia).
-   **`USE_MAINNET`**: Set to `true` for mainnet deployments, `false` for testnet. This controls which blockchain network your contract interactions target.
-   **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`**: If you implement Vercel KV (Upstash Redis) for storing cast hashes or other data.
-   **`SPONSOR_WALLET_PRIVATE_KEY`**: If you implement a paymaster for gasless transactions.

---

## 3. Handling Git LFS (Large File Storage)

Your project uses Git LFS to manage large artwork files in the `generator/layers/` directory. Vercel provides native support for Git LFS, simplifying the deployment process for these assets.

-   **Automatic Detection:** As long as your `.gitattributes` file (which tracks `*.png`, `*.jpg`, etc., with LFS) is committed to your repository, Vercel's build process will automatically detect it.
-   **LFS Object Download:** During the build, Vercel will download the actual large files from Git LFS storage, making them available within your build environment. This ensures that your `generator` package can access the full-resolution artwork when composing NFT images.
-   **No Extra Configuration:** You do not need to configure any special build steps or environment variables for Git LFS on Vercel. It works out-of-the-box.

---

## 4. Build Process Considerations

Vercel will execute the `pnpm build` command (or equivalent based on your `package.json` scripts) within the `app/` directory. Key points:

-   **Monorepo Dependencies:** Vercel's build environment correctly handles pnpm workspaces, ensuring that the `generator` package (and its dependencies like `canvas`) is properly built and linked for use by your Next.js application's API routes.
-   **Serverless Functions:** Your API routes (e.g., `/api/send-train`, `/api/internal/next-stop`) will be deployed as Vercel Serverless Functions. These are optimized for on-demand execution and scale automatically.
-   **`canvas` Library:** The `canvas` library used in the `generator` package has native dependencies. Vercel's build environment is robust enough to compile these correctly. Ensure your `package.json` for the `generator` package specifies `canvas` as a dependency.

---

## 5. Post-Deployment Verification

After a successful deployment, it's crucial to verify that all components are functioning as expected.

-   **Access Application:** Navigate to your deployed Vercel URL to ensure the frontend loads correctly.
-   **Check Logs:** Use the Vercel dashboard to monitor the logs of your serverless functions. This is invaluable for debugging any issues.
-   **Test API Endpoints:**
    -   Manually trigger the `/api/send-train` endpoint (e.g., using `curl` or Postman) with a valid `castHash` to initiate the full NFT generation and minting flow.
    -   Observe the logs for successful image generation, Pinata uploads, and contract interactions.
    -   Verify that new NFTs are minted on the blockchain and that their `tokenURI` points to the correct IPFS metadata.
-   **Monitor External Services:** Check your Pinata dashboard to confirm successful image and metadata uploads. Monitor your blockchain explorer for new transactions from your contract.

By following these specifications, you can ensure a smooth and reliable deployment of your ChooChoo Train project on Vercel.
