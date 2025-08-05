# ChooChoo Journey: System Documentation

This document describes how ChooChoo moves between Farcaster users using a microservice-based backend orchestration. The system handles winner selection, NFT generation, smart contract interaction, and social notifications.

---

## Core Concepts

### Token System

- **ChooChoo (tokenId: 0)**: The main asset that moves between users. Current holder has no NFT.
- **Journey Tickets (tokenId: 1, 2, 3...)**: NFTs minted to previous holders as proof of their ride.
- **Current Holder**: Person who currently has ChooChoo, shown in "Current Stop"
- **Previous Holders**: People who received journey ticket NFTs, shown in "Previous Stops"

### Journey Flow

1. Alice has ChooChoo (tokenId: 0) → posts cast asking for next passenger
2. Users reply to Alice's cast
3. Bob is selected as winner → Alice gets NFT ticket #1, Bob gets ChooChoo (tokenId: 0)
4. Timeline shows Alice in "Previous Stops" with ticket #1, Bob in "Current Stop"

---

## User Flows

### Normal User Journey

1. **Current holder posts cast**: Using the CastingWidget, current holder creates a cast announcing ChooChoo is ready to move
2. **Community engagement**: Other users reply to the cast to get in line for the next ride
3. **Winner selection**: Any user can trigger the selection process after replies accumulate
4. **Automatic orchestration**: Backend selects winner, mints NFT to previous holder, transfers ChooChoo to winner
5. **Social notification**: ChooChoo account posts welcome message tagging the new holder
6. **Cycle continues**: New holder can now post their own cast to continue the journey

### Admin Journey

1. **Admin access**: Only designated admin FIDs (377557, 2802, 243300) can access admin panel
2. **Direct selection**: Admin enters any Farcaster FID to send ChooChoo directly to that user
3. **Automatic processing**: Same backend flow as normal journey, but skips winner selection
4. **Social notification**: ChooChoo account posts welcome message for the new holder

---

## Backend Architecture

### Public Endpoints

#### `/api/send-train` (POST)

**Purpose**: Orchestrates normal journey flow from cast reactions to NFT minting
**Authentication**: Requires Farcaster authentication
**Process**:

1. Gets current cast hash from Redis
2. Calls `/api/internal/select-winner` to pick winner from cast reactions
3. Gets current holder (who will receive NFT ticket)
4. Calls `/api/internal/generate-nft` to create unique NFT
5. Calls `/api/internal/mint-token` to mint NFT to previous holder and update current holder
6. Calls `/api/internal/send-cast` to send welcome notification
7. Clears cast hash from Redis

#### `/api/admin-send-train` (POST)

**Purpose**: Admin version allowing direct FID selection
**Authentication**: Admin FID validation (not session-based)
**Body**: `{ targetFid: number, adminFid: number }`
**Process**:

1. Validates admin FID against whitelist
2. Fetches target user data from Neynar API
3. Gets current holder (who will receive NFT ticket)
4. Calls same internal microservices as normal flow
5. Sends admin-style welcome notification

#### `/api/current-holder` (GET)

**Purpose**: Returns current ChooChoo holder information
**Response**: Current holder data and user's holder status

#### `/api/journey` (GET)

**Purpose**: Returns journey timeline data for UI display
**Response**: Array of previous holders with their NFT tickets

### Internal Microservice Endpoints

#### `/api/internal/select-winner` (POST)

**Purpose**: Selects random winner from Farcaster cast reactions
**Authentication**: Internal secret header
**Body**: `{ castHash: string }`
**Process**:

1. Fetches cast reactions from Neynar API
2. Filters for users with verified Ethereum addresses
3. Randomly selects winner from eligible users
4. Returns winner data (username, FID, display name, PFP, address)

#### `/api/internal/generate-nft` (POST)

**Purpose**: Generates unique NFT image and uploads to IPFS
**Authentication**: Internal secret header
**Body**: `{ tokenId: number, passengerUsername: string }`
**Process**:

1. Uses generator package to compose unique image
2. Uploads image to Pinata with sanitized filename (`ChooChoo-{tokenId}.png`)
3. Creates metadata with proper naming (`ChooChoo #{tokenId}`)
4. Uploads metadata to Pinata
5. Returns IPFS hashes and token URI

#### `/api/internal/mint-token` (POST)

**Purpose**: Mints NFT and updates holder data
**Authentication**: Internal secret header
**Body**:

```json
{
  "newHolderAddress": "0x...",
  "tokenURI": "ipfs://...",
  "tokenId": 123,
  "newHolderData": { "username": "bob", "fid": 456, ... },
  "previousHolderData": { "username": "alice", "fid": 123, ... },
  "sourceCastHash": "0x...",
  "totalEligibleReactors": 10
}
```

**Process**:

1. **NFT minting**: Mints to previous holder (not new holder) as their journey ticket
2. **Data storage**: Stores comprehensive token data in Redis
3. **Holder update**: Updates current holder to new holder with tokenId: 0
4. **Timeline update**: Ensures journey timeline reflects correct holder history

#### `/api/internal/send-cast` (POST)

**Purpose**: Posts casts on behalf of ChooChoo Farcaster account
**Authentication**: Internal secret header
**Body**: `{ text: string, channel_id?: string, embeds?: array }`
**Process**:

1. Uses CHOOCHOO_SIGNER_UUID to authenticate with Neynar
2. Posts cast to specified channel (default: "base")
3. Returns cast hash and metadata

### Data Flow

```mermaid
flowchart TD
    User[Current Holder] --> Cast[Posts Cast via CastingWidget]
    Cast --> Redis[(Redis: current-cast-hash)]

    Trigger[Any User] --> SendTrain[/api/send-train]
    SendTrain --> SelectWinner[/api/internal/select-winner]
    SelectWinner --> Neynar[Neynar API: Get Reactions]

    SendTrain --> GetHolder[Get Current Holder]
    GetHolder --> Redis2[(Redis: current-holder)]

    SendTrain --> GenerateNFT[/api/internal/generate-nft]
    GenerateNFT --> Generator[Generator Package]
    Generator --> Pinata[IPFS/Pinata Upload]

    SendTrain --> MintToken[/api/internal/mint-token]
    MintToken --> Contract[Smart Contract: nextStop]
    MintToken --> Redis3[(Redis: Token Data)]
    MintToken --> Redis4[(Redis: Update current-holder)]

    SendTrain --> SendNotification[/api/internal/send-cast]
    SendNotification --> ChooChooAccount[ChooChoo Farcaster Account]

    Admin[Admin User] --> AdminSendTrain[/api/admin-send-train]
    AdminSendTrain --> DirectNeynar[Neynar API: Get User by FID]
    AdminSendTrain --> GenerateNFT
    AdminSendTrain --> MintToken
    AdminSendTrain --> SendNotification
```

### Key Features

1. **Microservice Architecture**: Each step is isolated for better error handling and testing
2. **Proper NFT Distribution**: Previous holders get NFTs, current holder gets ChooChoo itself
3. **Real-time Updates**: Timeline and current holder components update automatically
4. **Social Integration**: Automatic cast notifications keep the community engaged
5. **Admin Override**: Admins can manually send ChooChoo for testing or special events
6. **Error Resilience**: Non-critical failures (like cast sending) don't break the core flow

### Environment Variables

```bash
# Core API Keys
NEYNAR_API_KEY=your_neynar_api_key
PINATA_JWT=your_pinata_jwt_token
CHOOCHOO_SIGNER_UUID=your_choochoo_signer_uuid

# Application URLs
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Internal Security
INTERNAL_SECRET=your_internal_secret

# Smart Contract
NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS=0x...
```

### Timeline Components

#### Current Stop

- Shows user with ChooChoo (tokenId: 0)
- Updates in real-time when new holder is set
- Displays holding duration and user info
- Special styling to indicate active status

#### Previous Stops

- Shows users who received NFT journey tickets
- Displays actual minted token IDs (1, 2, 3...)
- Includes NFT images and metadata
- Ordered chronologically by journey date

This architecture ensures ChooChoo moves smoothly between users while creating a permanent record of the journey through NFT tickets.
