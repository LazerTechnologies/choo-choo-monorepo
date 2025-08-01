# Contract Service Integration Task

## **Objective**

Update the contract service in `app/src/lib/services/contract.ts` to work with the modified `ChooChooTrain.sol` contract and create a test endpoint to validate contract integration for the `send-train` route.

## **Context**

The `ChooChooTrain.sol` contract has been modified with these key changes:

1. **Admin-only train movement**: Only accounts with `ADMIN_ROLE` can call `nextStop()` functions
2. **New function**: `nextStopWithTicketData(address to, string memory ticketTokenURI)` - moves train and sets ticket metadata in one transaction
3. **Enhanced analytics**: New view functions for better data access
4. **Blocked regular transfers**: Token ID 0 (the train) can only be moved via admin functions

## **Required Changes**

### **1. Update Contract Service (`app/src/lib/services/contract.ts`)**

**Current Issues:**

- Line 83: `contract.write.nextStop([recipient, tokenURI])` - function signature is wrong (old ABI)
- Should use `nextStopWithTicketData(recipient, tokenURI)` instead of basic `nextStop(recipient)`
- Missing new view functions for analytics

**Required Updates:**

1. **Fix `executeNextStop()` method:**

   ```typescript
   // Change from:
   const hash = await contract.write.nextStop([recipient, tokenURI]);
   // To:
   const hash = await contract.write.nextStopWithTicketData([
     recipient,
     tokenURI,
   ]);
   ```

2. **Add new contract read methods:**

   ```typescript
   async getCurrentTrainHolder(): Promise<Address>
   async getTrainStatus(): Promise<{
     holder: Address,
     totalStops: bigint,
     lastMoveTime: bigint,
     canBeYoinked: boolean,
     nextTicketId: bigint
   }>
   async hasRiddenTrain(address: Address): Promise<boolean>
   async getTotalTickets(): Promise<number>
   ```

3. **Update error handling** for admin-only restrictions

### **2. Update Contract ABI**

- **Location:** `app/src/abi/ChooChooTrain.abi.json`
- **Action:** Regenerate ABI from the updated contract to include new functions
- **Command:** `cd contracts && forge build` then copy ABI to app directory

### **3. Create Contract Test Endpoint**

- **File:** `app/src/app/api/test-contract/route.ts`
- **Purpose:** Test all contract integration components individually

**Test Cases to Implement:**

```typescript
// 3.2 Contract Service Integration Testing from checklist:
- [ ] Test contract connection works with RPC endpoint
- [ ] Verify `getTotalSupply()` returns correct current value
- [ ] Test token ID calculation (`totalSupply + 1`) accuracy
- [ ] Test `executeNextStop()` transaction submission (testnet first)
- [ ] Verify gas estimation and transaction confirmation
- [ ] Test contract error handling (insufficient gas, invalid recipient)
```

**Expected Test Response:**

```json
{
  "success": true,
  "tests": {
    "contractConnection": "PASS",
    "getTotalSupply": "PASS",
    "tokenIdCalculation": "PASS",
    "executeNextStop": "PASS", // or "SKIPPED" if testnet not configured
    "gasEstimation": "PASS",
    "errorHandling": "PASS"
  },
  "contractInfo": {
    "address": "0x...",
    "network": "base-sepolia",
    "currentHolder": "0x...",
    "totalSupply": 5,
    "nextTokenId": 6,
    "adminCount": 2
  }
}
```

### **4. Environment Variables to Verify**

Ensure these are properly configured:

- `RPC_URL` - connects to correct network (testnet/mainnet)
- `CHOOCHOO_TRAIN_ADDRESS` - points to correct deployed contract
- `ADMIN_PRIVATE_KEY` - has minting permissions on contract

### **5. Integration with Send-Train Route**

Once contract service is working:

- Verify `send-train` route can successfully call `contractService.executeNextStop(winnerAddress, tokenURI)`
- Test the full flow: Neynar → Winner Selection → Image Generation → Pinata → Contract Execution

## **Testing Strategy**

1. Start with read-only functions (connection, totalSupply, status)
2. Test admin permissions and error cases
3. Test transaction submission (use testnet first)
4. Validate gas estimation and confirmation
5. Test end-to-end integration with send-train

## **Expected Deliverables**

1. Updated `contract.ts` with correct function calls and new methods
2. New `/api/test-contract` endpoint with comprehensive testing
3. Updated implementation checklist marking contract integration as complete
4. Verification that `send-train` route works end-to-end

## **Files to Modify**

- `app/src/lib/services/contract.ts`
- `app/src/abi/ChooChooTrain.abi.json` (regenerate)
- `app/src/app/api/test-contract/route.ts` (create)
- `docs/implementation-checklist.md` (update)

## **Notes**

This task completes the critical contract integration needed for the `send-train` route to function properly with the admin-only train movement model.

The contract tests are passing and the Solidity implementation is ready. The focus should be on the TypeScript/API integration layer.
