# ChooChoo Train Contract Refactoring Guide

This guide documents the comprehensive refactoring of the ChooChooTrain contract and related APIs to simplify the metadata structure and consolidate train movement functions.

## Overview

The refactoring removes the separate `traits` field from the `TicketData` struct and consolidates train movement functions, since the NFT metadata JSON already contains all necessary information (image + traits).

## Changes Summary

### 🎯 **Goals Achieved:**

- Simplified `TicketData` struct by removing redundant `traits` field
- Consolidated `nextStop` and `nextStopWithTicketData` into a single function
- Maintained admin override functionality for manual ticket metadata updates
- Streamlined API endpoints to match new function signatures

---

## 1. Contract Changes (`contracts/src/ChooChooTrain.sol`)

### 1.1 Update TicketData Struct

**Before:**

```solidity
struct TicketData {
    string tokenURI;
    string image;
    string traits;
}
```

**After:**

```solidity
struct TicketData {
    string tokenURI;
    string image;
}
```

### 1.2 Update TicketStamped Event

**Before:**

```solidity
event TicketStamped(address indexed to, uint256 indexed tokenId, string traits);
```

**After:**

```solidity
event TicketStamped(address indexed to, uint256 indexed tokenId);
```

### 1.3 Consolidate nextStop Functions

**Remove the old `nextStop` function and rename `nextStopWithTicketData` to `nextStop`:**

**Before:**

```solidity
function nextStop(address to) external onlyAdmin notInvalidAddress(to) {
    // ... implementation without ticket data
}

function nextStopWithTicketData(address to, string memory ticketTokenURI)
    external onlyAdmin notInvalidAddress(to) {
    // ... implementation with ticket data
}
```

**After:**

```solidity
function nextStop(address to, string memory ticketTokenURI)
    external onlyAdmin notInvalidAddress(to) {
    address from = ownerOf(0);
    if (to == from) {
        revert CannotSendToCurrentPassenger(to);
    }
    if (hasBeenPassenger[to]) {
        revert AlreadyRodeTrain(to);
    }

    uint256 futureTicketId = nextTicketId;

    hasBeenPassenger[from] = true;
    trainJourney.push(from);

    previousPassenger = from;
    lastTransferTimestamp = block.timestamp;
    _safeTransfer(from, to, 0, "");
    emit TrainDeparted(from, to, block.timestamp);
    _stampTicket(from);

    // Set the ticket data immediately after minting
    ticketData[futureTicketId].tokenURI = ticketTokenURI;
}
```

### 1.4 Update setTicketData Function

**Before:**

```solidity
function setTicketData(uint256 tokenId, string memory fullTokenURI, string memory image, string memory traits)
    external onlyAdmin
{
    require(tokenId != 0, "Cannot update train NFT");
    require(_ownerOf(tokenId) != address(0), "Token does not exist");
    ticketData[tokenId] = TicketData({tokenURI: fullTokenURI, image: image, traits: traits});
}
```

**After:**

```solidity
function setTicketData(uint256 tokenId, string memory fullTokenURI, string memory image)
    external onlyAdmin
{
    require(tokenId != 0, "Cannot update train NFT");
    require(_ownerOf(tokenId) != address(0), "Token does not exist");
    ticketData[tokenId] = TicketData({tokenURI: fullTokenURI, image: image});
}
```

### 1.5 Update ownerMintTicket Function

**Before:**

```solidity
function ownerMintTicket(address to, string memory fullTokenURI, string memory image, string memory traits)
    external onlyOwner notInvalidAddress(to)
{
    uint256 tokenId = nextTicketId;
    _safeMint(to, tokenId);
    ticketData[tokenId] = TicketData({tokenURI: fullTokenURI, image: image, traits: traits});
    ticketMintedAt[tokenId] = block.timestamp;
    nextTicketId++;
    emit TicketStamped(to, tokenId, traits);
}
```

**After:**

```solidity
function ownerMintTicket(address to, string memory fullTokenURI, string memory image)
    external onlyOwner notInvalidAddress(to)
{
    uint256 tokenId = nextTicketId;
    _safeMint(to, tokenId);
    ticketData[tokenId] = TicketData({tokenURI: fullTokenURI, image: image});
    ticketMintedAt[tokenId] = block.timestamp;
    nextTicketId++;
    emit TicketStamped(to, tokenId);
}
```

### 1.6 Update \_stampTicket Internal Function

**Before:**

```solidity
function _stampTicket(address to) internal notInvalidAddress(to) {
    uint256 tokenId = nextTicketId;
    _safeMint(to, tokenId);
    ticketMintedAt[tokenId] = block.timestamp;
    nextTicketId++;
    emit TicketStamped(to, tokenId, "");
}
```

**After:**

```solidity
function _stampTicket(address to) internal notInvalidAddress(to) {
    uint256 tokenId = nextTicketId;
    _safeMint(to, tokenId);
    ticketMintedAt[tokenId] = block.timestamp;
    nextTicketId++;
    emit TicketStamped(to, tokenId);
}
```

### 1.7 Update Error Message Comment

**Before:**

```solidity
// Train can only be moved by admins via nextStop functions
```

**After:**

```solidity
// Train can only be moved by admins via nextStop function
```

---

## 2. Backend Service Changes (`app/src/lib/services/contract.ts`)

### 2.1 Update setTicketData Method

**Before:**

```typescript
async setTicketData(
  tokenId: number,
  tokenURI: string,
  image: string,
  traits: string
): Promise<`0x${string}`> {
  // ... implementation with traits parameter
  const hash = await contract.write.setTicketData([BigInt(tokenId), tokenURI, image, traits]);
  return hash;
}
```

**After:**

```typescript
async setTicketData(
  tokenId: number,
  tokenURI: string,
  image: string = ''
): Promise<`0x${string}`> {
  // ... implementation without traits parameter
  const hash = await contract.write.setTicketData([BigInt(tokenId), tokenURI, image]);
  return hash;
}
```

### 2.2 Update executeNextStop Method

**Before:**

```typescript
async executeNextStop(recipient: Address, tokenURI: string): Promise<`0x${string}`> {
  // ... implementation
  const hash = await contract.write.nextStopWithTicketData([recipient, tokenURI]);
  return hash;
}
```

**After:**

```typescript
async executeNextStop(recipient: Address, tokenURI: string): Promise<`0x${string}`> {
  // ... implementation
  const hash = await contract.write.nextStop([recipient, tokenURI]);
  return hash;
}
```

### 2.3 Update estimateNextStopGas Method

**Before:**

```typescript
const gasEstimate = await publicClient.estimateContractGas({
  address: this.config.address,
  abi: ChooChooTrainAbi,
  functionName: 'nextStopWithTicketData',
  args: [recipient, tokenURI],
  account,
});
```

**After:**

```typescript
const gasEstimate = await publicClient.estimateContractGas({
  address: this.config.address,
  abi: ChooChooTrainAbi,
  functionName: 'nextStop',
  args: [recipient, tokenURI],
  account,
});
```

---

## 3. API Route Changes

### 3.1 Internal Set Ticket Data Route (`app/src/app/api/internal/set-ticket-data/route.ts`)

**Update validation schema:**

```typescript
// Before
const setTicketDataSchema = z.object({
  tokenId: z.number().min(0, 'Token ID must be non-negative'),
  tokenURI: z.string().min(1, 'Token URI is required'),
  image: z.string().optional().default(''),
  traits: z.string().optional().default(''),
});

// After
const setTicketDataSchema = z.object({
  tokenId: z.number().min(0, 'Token ID must be non-negative'),
  tokenURI: z.string().min(1, 'Token URI is required'),
  image: z.string().optional().default(''),
});
```

**Update function call:**

```typescript
// Before
const { tokenId, tokenURI, image, traits } = validation.data;
const hash = await contractService.setTicketData(
  tokenId,
  tokenURI,
  image,
  traits
);

// After
const { tokenId, tokenURI, image } = validation.data;
const hash = await contractService.setTicketData(tokenId, tokenURI, image);
```

### 3.2 Admin Set Ticket Data Route (`app/src/app/api/admin/set-ticket-data/route.ts`)

**Update validation schema:**

```typescript
// Before
const adminSetTicketDataSchema = z.object({
  tokenId: z.number().min(0, 'Token ID must be non-negative'),
  tokenURI: z.string().min(1, 'Token URI is required'),
  image: z.string().optional().default(''),
  traits: z.string().optional().default(''),
});

// After
const adminSetTicketDataSchema = z.object({
  tokenId: z.number().min(0, 'Token ID must be non-negative'),
  tokenURI: z.string().min(1, 'Token URI is required'),
  image: z.string().optional().default(''),
});
```

**Update request body:**

```typescript
// Before
const { tokenId, tokenURI, image, traits } = validation.data;
body: JSON.stringify({
  tokenId,
  tokenURI,
  image,
  traits,
}),

// After
const { tokenId, tokenURI, image } = validation.data;
body: JSON.stringify({
  tokenId,
  tokenURI,
  image,
}),
```

### 3.3 Initial Holder Route (`app/src/app/api/admin/initial-holder/route.ts`)

**Update request body:**

```typescript
// Before
body: JSON.stringify({
  tokenId: 0,
  tokenURI: CHOOCHOO_TRAIN_METADATA_URI,
  image: '',
  traits: '',
}),

// After
body: JSON.stringify({
  tokenId: 0,
  tokenURI: CHOOCHOO_TRAIN_METADATA_URI,
  image: '',
}),
```

---

## 4. Test File Changes (`contracts/test/ChooChooTrain.t.sol`)

### 4.1 Update Event Declaration

**Before:**

```solidity
event TicketStamped(address indexed to, uint256 indexed tokenId, string traits);
```

**After:**

```solidity
event TicketStamped(address indexed to, uint256 indexed tokenId);
```

### 4.2 Update All nextStop Function Calls

**Add tokenURI parameter to all `nextStop` calls:**

```solidity
// Before
train.nextStop(passenger1);

// After
string memory tokenURI = "ipfs://QmTestMetadata";
train.nextStop(passenger1, tokenURI);
```

### 4.3 Remove nextStopWithTicketData Test

**Delete the entire `testNextStopWithTicketData` function since the function no longer exists.**

### 4.4 Update ownerMintTicket Test

**Before:**

```solidity
function testOwnerMintTicket() public {
    string memory uri = "ipfs://QmMetaHash";
    string memory img = "ipfs://QmImageHash";
    string memory traits = "ipfs://QmTraitsHash";
    vm.prank(owner);
    train.ownerMintTicket(passenger1, uri, img, traits);
    assertEq(train.ownerOf(1), passenger1);
    (string memory tUri, string memory tImg, string memory tTraits) = train.ticketData(1);
    assertEq(tUri, uri);
    assertEq(tImg, img);
    assertEq(tTraits, traits);
}
```

**After:**

```solidity
function testOwnerMintTicket() public {
    string memory uri = "ipfs://QmMetaHash";
    string memory img = "ipfs://QmImageHash";
    vm.prank(owner);
    train.ownerMintTicket(passenger1, uri, img);
    assertEq(train.ownerOf(1), passenger1);
    (string memory tUri, string memory tImg) = train.ticketData(1);
    assertEq(tUri, uri);
    assertEq(tImg, img);
}
```

### 4.5 Update setTicketData Tests

**Remove traits parameter from all `setTicketData` calls and assertions:**

```solidity
// Before
train.setTicketData(1, uri, img, traits);
(string memory tUri, string memory tImg, string memory tTraits) = train.ticketData(1);
assertEq(tTraits, traits);

// After
train.setTicketData(1, uri, img);
(string memory tUri, string memory tImg) = train.ticketData(1);
```

### 4.6 Update Admin Test

**Replace nextStopWithTicketData usage with consolidated nextStop:**

```solidity
// Before
function testAddedAdminCanMoveTrainAndSetData() public {
    // Add new admin
    vm.prank(owner);
    train.addAdmin(admin1);

    // New admin can move train
    vm.prank(admin1);
    train.nextStop(passenger1);
    assertEq(train.ownerOf(0), passenger1);

    // New admin can use nextStopWithTicketData
    string memory tokenURI = "ipfs://QmTestMetadata";
    vm.prank(admin1);
    train.nextStopWithTicketData(passenger2, tokenURI);

    assertEq(train.ownerOf(0), passenger2);
    (string memory tUri,,) = train.ticketData(2);
    assertEq(tUri, tokenURI);
}

// After
function testAddedAdminCanMoveTrainAndSetData() public {
    // Add new admin
    vm.prank(owner);
    train.addAdmin(admin1);

    // New admin can move train with ticket data
    string memory tokenURI = "ipfs://QmTestMetadata";
    vm.prank(admin1);
    train.nextStop(passenger1, tokenURI);
    assertEq(train.ownerOf(0), passenger1);

    // Check that ticket data was set automatically
    (string memory tUri,) = train.ticketData(1);
    assertEq(tUri, tokenURI);

    // New admin can move train again
    string memory tokenURI2 = "ipfs://QmTestMetadata2";
    vm.prank(admin1);
    train.nextStop(passenger2, tokenURI2);

    assertEq(train.ownerOf(0), passenger2);
    (string memory tUri2,) = train.ticketData(2);
    assertEq(tUri2, tokenURI2);
}
```

---

## 5. Frontend Changes (if applicable)

### 5.1 Update useChooChoo Hook

If the frontend hook calls the old `nextStop` function without parameters, update it to use the new signature or remove it entirely if only the backend should call this function.

---

## 6. ABI Regeneration

After making all contract changes, regenerate the ABI file:

```bash
cd contracts
forge build
# Copy the new ABI to app/src/abi/ChooChooTrain.abi.json
```

---

## 7. Deployment Checklist

### Pre-Deployment

- [ ] All contract changes implemented
- [ ] All API routes updated
- [ ] All tests updated and passing
- [ ] ABI regenerated and updated in frontend

### Deployment Process

1. **Deploy new contract** with updated functions
2. **Update environment variables** to point to new contract address
3. **Deploy updated application** with matching API signatures
4. **Verify functionality** through admin interface

### Post-Deployment Verification

- [ ] Train movement works with automatic ticket metadata setting
- [ ] Admin can manually update ticket metadata via AdminPage
- [ ] All API endpoints respond correctly
- [ ] USDC deposit functionality unchanged
- [ ] Yoink mechanism functions properly

---

## 8. Benefits Achieved

### ✅ **Simplified Architecture**

- Single `nextStop` function handles both train movement and ticket metadata
- Reduced redundancy in `TicketData` struct
- Cleaner API signatures

### ✅ **Maintained Functionality**

- Admin override capability preserved for manual corrections
- All existing USDC deposit features unchanged
- Yoink mechanics unaffected
- Complete backward compatibility for existing tickets

### ✅ **Improved Developer Experience**

- Single function call for train movement + metadata
- Reduced chance of metadata/movement desync
- Cleaner test suite

---

## 9. Rollback Plan

If issues arise, the rollback process involves:

1. **Revert contract** to previous version
2. **Update environment variables** to previous contract address
3. **Revert API changes** to support old function signatures
4. **Revert test changes** to match old contract
5. **Regenerate old ABI** and update frontend

---

## Notes

- The `traits` field removal is safe because the `tokenURI` JSON contains all metadata
- Admin functionality for manual ticket updates is preserved
- USDC deposit system remains completely unchanged
- All existing tickets retain their metadata through the `tokenURI` field
