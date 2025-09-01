# 🔄 Task: Merge Deposit Functionality into WinnerSelectionWidget

## Current State Analysis

### `WinnerSelectionWidget.tsx` (Currently Used)

- ✅ Has proper tab switcher with "Send" and "Chance" tabs
- ✅ "Chance" tab works correctly (enables random selection after 30min countdown)
- ❌ "Send" tab lacks deposit integration - directly calls `/api/user-send-train` without checking USDC deposit requirement
- ❌ No wallet connection handling
- ❌ No USDC approval/deposit flow
- ❌ Missing deposit status checks

### `UserNextStopWidget.tsx` (Not Currently Used)

- ❌ No tab switcher (single-purpose component)
- ✅ Full deposit integration with `useDepositStatus` and `useDepositUsdc` hooks
- ✅ Proper wallet connection flow with `ConnectWalletDialog`
- ✅ USDC approval and deposit transaction handling
- ✅ Network switching with `useEnsureCorrectNetwork`
- ✅ Comprehensive button states (Connect → Approve → Deposit → Send)
- ✅ Error handling for insufficient USDC, rejected transactions, etc.

## Required Merge

**Integrate the deposit functionality from `UserNextStopWidget` into the "Send" tab of `WinnerSelectionWidget` while preserving the existing tab structure and "Chance" tab functionality.**

## Specific Changes Needed

### 1. Add Required Imports to `WinnerSelectionWidget`

```tsx
import { useDepositStatus } from '@/hooks/useDepositStatus';
import { useDepositUsdc } from '@/hooks/useDepositUsdc';
import { useAccount } from 'wagmi';
import { useEnsureCorrectNetwork } from '@/hooks/useEnsureCorrectNetwork';
import { ConnectWalletDialog } from '@/components/ui/ConnectWalletDialog';
import { useMiniApp } from '@neynar/react';
```

### 2. Add State and Hooks

```tsx
// Add these hooks and state variables
const { context } = useMiniApp();
const currentUserFid = user?.fid || context?.user?.fid || null;
const deposit = useDepositStatus(currentUserFid);
const { isConnected } = useAccount();
const { ensureCorrectNetwork, isSwitching } = useEnsureCorrectNetwork();
const [connectOpen, setConnectOpen] = useState(false);

const depositHook = useDepositUsdc({
  fid: currentUserFid ?? null,
  contractAddress: process.env
    .NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS as `0x${string}`,
  usdcAddress: (deposit.config?.usdcAddress ||
    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913') as `0x${string}`,
  required: deposit.required,
});
```

### 3. Update the "Send" Tab Button Logic

Replace the current simple `handleManualSend` with a comprehensive button handler that:

- Checks wallet connection first
- Ensures correct network
- Handles USDC approval if needed
- Handles USDC deposit if needed
- Only then calls the manual send API

### 4. Update Button States

The "Send" tab button should display different text based on state:

- `"Connect wallet"` if not connected
- `"Approving USDC..."` during approval
- `"Depositing..."` during deposit
- `"Deposit 1 USDC"` if deposit not satisfied
- `"Send ChooChoo to @username"` when ready to send

### 5. Add ConnectWalletDialog

Include the wallet connection dialog component in the JSX.

### 6. Preserve Existing Functionality

- Keep the exact same tab structure and styling
- Keep the "Chance" tab completely unchanged
- Maintain all existing props and callbacks
- Keep the same visual design and purple styling

## Key Requirements

- **DO NOT** change the "Chance" tab functionality
- **DO NOT** change the overall component structure or tab switcher
- **DO NOT** change the component's external interface (props, callbacks)
- **DO** add comprehensive error handling for wallet/deposit issues
- **DO** maintain the existing purple styling and visual design
- **DO** ensure the deposit requirement is enforced before manual sending
- **DO** provide clear user feedback for each step of the deposit process

## Expected Outcome

After the merge, `WinnerSelectionWidget` should:

1. Maintain its current tab structure ("Send" | "Chance")
2. Have the "Send" tab require 1 USDC deposit before allowing manual train sending
3. Guide users through: Connect Wallet → Approve USDC → Deposit USDC → Send Train
4. Keep the "Chance" tab functionality exactly as it currently works
5. Handle all edge cases (wrong network, insufficient USDC, transaction failures, etc.)

This will create a unified component that properly enforces the deposit requirement for manual sends while preserving the existing user experience and tab-based navigation.

## Implementation Notes

### Button Handler Logic

The new button handler should follow this flow:

```tsx
const handleSendButtonClick = async () => {
  // Connection gate
  if (!isConnected) {
    setConnectOpen(true);
    return;
  }

  // Network gate
  const ok = await ensureCorrectNetwork();
  if (!ok) return;

  // Deposit gate
  if (!deposit.satisfied) {
    if (depositHook.needsApproval) {
      await depositHook.approve();
    } else {
      await depositHook.deposit();
      await deposit.refresh();
    }
    return;
  }

  // Ready to send
  await handleManualSend();
};
```

### Button Text Logic

```tsx
const getButtonText = () => {
  if (loading) return 'Sending ChooChoo...';
  if (!isConnected) return 'Connect wallet';
  if (deposit.isLoading) return 'Loading...';
  if (!deposit.satisfied) {
    if (depositHook.isApproving) return 'Approving USDC...';
    if (depositHook.isDepositing || depositHook.isConfirming)
      return 'Depositing...';
    return 'Deposit 1 USDC';
  }
  return selectedUser
    ? `Send ChooChoo to @${selectedUser.username}`
    : 'Send ChooChoo';
};
```

### Disabled State Logic

```tsx
const isButtonDisabled =
  loading ||
  !selectedUser ||
  deposit.isLoading ||
  depositHook.isApproving ||
  depositHook.isDepositing ||
  depositHook.isConfirming ||
  isSwitching;
```

This ensures a smooth user experience while maintaining all existing functionality and adding the required deposit integration.
