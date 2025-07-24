# ChooChoo Journey: System Docs

This document describes how ChooChoo moves using a user-triggered, backend-orchestrated process for calling the `nextStop` method on the ChooChooTrain contract. The process of selecting the next recipient, generating and pinning NFT metadata and images, and triggering the contract call is initiated by any user via the mini-app.

---

## Flow Description

### User Interaction

1.  The current train holder creates a cast indicating the train is ready for its next journey.
2.  Other users reply to that cast.
3.  After a set period, any user can trigger the next stop.
4.  The user with the most-reacted reply is chosen as the next recipient.

### Backend Orchestration

- When a user clicks the "Send Train" button, the frontend calls the public `/api/send-train` endpoint.
- This endpoint orchestrates the entire flow:
  1.  It fetches all replies and reactions to the designated cast using the Neynar API.
  2.  It determines the winner (the user whose reply received the most reactions).
  3.  It calls the internal `/api/internal/next-stop` endpoint to get the current `totalSupply` and determine the next `tokenId`.
  4.  It invokes the `generator` package to compose a unique NFT image and its metadata attributes.
  5.  The `generator` uploads the image and metadata to IPFS via Pinata.
  6.  Finally, the orchestrator calls the `/api/internal/next-stop` endpoint again, this time with the winner's address and the new `tokenURI`. This endpoint uses a secure admin key to execute the `nextStop` transaction on-chain.

---

## Code Overview

### API Routes

-   **`/api/send-train`**: A public-facing endpoint that anyone can call to initiate the train's movement. It contains the primary orchestration logic.
-   **`/api/internal/next-stop`**: An internal-only endpoint protected by a secret key. It has two functions:
    -   `GET`: Safely retrieves the current `totalSupply` from the smart contract.
    -   `POST`: Executes the `nextStop` transaction on the smart contract using a secure admin key.

### `generator` Package

-   **`generator/`**: A self-contained package responsible for all NFT asset generation.
    -   `layers/`: Contains the raw artwork.
    -   `rarities.json`: Defines the rarity weights for each trait.
    -   `src/`: Contains the TypeScript logic for composing images (`compose.ts`) and uploading to IPFS (`pinata.ts`).

### React Hooks

-   **`useChooChoo.ts`**: Centralizes blockchain contract logic for the frontend (read/write, status, etc.).
-   **`useFetchFromPinata.ts`**: Fetches and formats NFT metadata from Pinata/IPFS for frontend display.
-   **`useNextStopFlow.ts`**: Contains the logic for the frontend to call the `/api/send-train` endpoint.

---

## Security

-   The sensitive `/api/internal/next-stop` endpoint is protected by a secret key (`INTERNAL_SECRET`), ensuring it can only be called by our own backend services.
-   The public-facing `/api/send-train` endpoint is safe to expose as it doesn't handle private keys. It simply starts the orchestration flow.
-   Admin keys and Pinata JWTs are stored securely as environment variables on Vercel and are never exposed to the frontend.

---

## System Architecture Diagram

```mermaid
flowchart TD
  User[Any User] -- "Clicks 'Send Train'" --> MiniApp["Mini-app Frontend"]
  MiniApp -- "Calls API" --> SendTrain["/api/send-train"]

  subgraph "Backend Logic (on Vercel)"
    SendTrain -- "1. Get Winner" --> Neynar[Neynar API]
    SendTrain -- "2. Get totalSupply" -->|GET| InternalNextStop["/api/internal/next-stop"]
    SendTrain -- "3. Generate Assets" --> Generator["Generator Package"]
    Generator -- "4. Upload to IPFS" --> Pinata[IPFS/Pinata]
    SendTrain -- "5. Execute Tx" -->|POST| InternalNextStop
  end

  InternalNextStop -- "6. Call nextStop()" --> Contract["ChooChooTrain Contract"]

  subgraph "External Services"
    Neynar
    Pinata
    Contract
  end
```

