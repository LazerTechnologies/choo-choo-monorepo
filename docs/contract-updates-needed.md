# ChooChoo Contract Updates Required

## Overview

Based on the current system architecture documented in `nextStop-flow.md` and the implemented backend flow, several updates are needed to the `ChooChooTrain.sol` contract to align with the actual functionality.

## Required Changes

### 1. Yoink Function Simplification ⚠️ **CRITICAL**

**Current Issue**: The yoink function has complex logic checking for previous passengers and different time windows.

**Required Changes**:

- Remove the `onlyPreviousPassengers` modifier
- Make yoink admin-only (already has backend admin control)
- Simplify to single 48-hour countdown
- Keep the restriction that target cannot have held the train before

```solidity
// BEFORE (lines 487-504)
function yoink(address to) external onlyPreviousPassengers notInvalidAddress(to) {
    (bool canYoink, string memory reason) = isYoinkable(_msgSender());
    if (!canYoink) {
        revert NotEligibleToYoink(reason);
    }
    // ... rest of function
}

// AFTER (proposed)
function yoink(address to) external onlyAdmin notInvalidAddress(to) {
    if (block.timestamp < lastTransferTimestamp + 48 hours) {
        revert NotEligibleToYoink("48 hour cooldown not met");
    }
    address from = ownerOf(0);
    if (to == from) {
        revert CannotSendToCurrentPassenger(to);
    }
    if (hasBeenPassenger[to]) {
        revert AlreadyRodeTrain(to);
    }
    // ... rest of function (same logic)
}
```

### 2. Update isYoinkable Function

**Current Issue**: Complex logic for different time windows that doesn't match simplified yoink.

**Required Changes**:

```solidity
// BEFORE (lines 461-481) - Complex 2-day/3-day logic
function isYoinkable(address caller) public view returns (bool canYoink, string memory reason) {
    // Complex logic with multiple time windows
}

// AFTER (proposed)
function isYoinkable() public view returns (bool canYoink, string memory reason) {
    if (block.timestamp < lastTransferTimestamp + 48 hours) {
        return (false, "48 hour cooldown not met");
    }
    return (true, "Train can be yoinked by admin");
}
```

### 3. Admin Management Alignment

**Current Status**: ✅ **Already Correct**

- Contract has proper admin role management
- Backend uses admin addresses for train movement
- No changes needed here

### 4. Contract Flow vs Backend Flow

**Current Issue**: Contract has some functions that aren't used by the backend.

**Analysis**:

- ✅ `nextStopWithTicketData()` - Used by backend
- ✅ Admin role management - Used by backend
- ❌ Complex yoink logic - Not used by backend (admins handle yoink)
- ✅ Ticket minting logic - Used by backend

### 5. Remove Redundant Modifiers and Functions

**Functions to Remove/Simplify**:

1. **Remove `onlyPreviousPassengers` modifier** (line 99-104)

   - No longer needed since yoink is admin-only

2. **Simplify error handling**:
   - Keep `NotEligibleToYoink` for simple 48-hour check
   - Remove complex passenger eligibility errors

### 6. Update Documentation Comments

**Required Updates**:

1. **Line 18-20**: Update yoink timing description

```solidity
// BEFORE
If the train gets stuck, previous passengers can "yoink" the train after a certain time:
- After 2 days of no movement, the immediate previous passenger can yoink.
- After 3 days, any previous passenger can yoink.

// AFTER
If the train gets stuck, admins can "yoink" the train after 48 hours to a new address
that has never held the train before.
```

2. **Update function documentation** for yoink-related functions

### 7. Update getTrainStatus Function

**Current Issue**: References old yoink logic.

**Required Changes**:

```solidity
// BEFORE (line 396)
canBeYoinked = block.timestamp >= lastTransferTimestamp + 2 days;

// AFTER
canBeYoinked = block.timestamp >= lastTransferTimestamp + 48 hours;
```

## Implementation Priority

### **High Priority** 🔴

1. Yoink function simplification (security and functionality)
2. Remove onlyPreviousPassengers modifier
3. Update isYoinkable function
4. Update getTrainStatus function

### **Medium Priority** 🟡

1. Update documentation comments
2. Remove unused error types
3. Clean up redundant code

### **Low Priority** 🟢

1. Code optimization
2. Gas optimization improvements

## Testing Requirements

After implementing these changes:

1. **Unit Tests**:

   - Test yoink with 48-hour timing
   - Test admin-only yoink access
   - Test yoink restrictions (cannot send to previous passengers)

2. **Integration Tests**:

   - Test backend admin yoink flow
   - Test proper ticket minting after yoink
   - Test timeline updates after yoink

3. **Frontend Tests**:
   - Test yoink UI for admins only
   - Test 48-hour countdown display

## Migration Considerations

**If Contract is Already Deployed**:

- These are breaking changes that require a new contract deployment
- Will need to migrate existing train holder and journey data
- Coordinate with frontend and backend for deployment

**If Contract is Not Yet Deployed**:

- Implement all changes before initial deployment
- Update deployment scripts accordingly

## Backend Alignment

**No Backend Changes Needed**:

- Backend already treats yoink as admin-only operation
- Backend already handles 48-hour cooldowns
- These contract changes align the contract with existing backend logic

## Integration Checks

- [ ] forge build
- [ ] use the root level script to copy the built ABI to `/app/abi/`
- [ ] update ABI references in `/app/src/lib/services/contract.ts`
- [ ] update hooks that use contract
- [ ] make sure API isn't calling any depricated methods

## Summary

The main issue is that the contract has complex yoink logic that doesn't match the simplified admin-controlled system implemented in the backend. These changes will align the contract with the actual system architecture where admins have full control over train movement, including yoink operations.
