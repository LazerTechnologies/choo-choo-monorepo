## USDC Deposit Refactor Plan

This plan introduces a 1 USDC fee to manually send the train and to yoink it. The smart contract will accept USDC deposits tagged with a Farcaster FID, and the app will require a successful deposit before allowing manual-send or yoink actions. Admin actions (nextStop/yoink) remain executed by the backend admin wallet; deposits are user-initiated and on-chain.

### Goals

- Require at least 1 USDC deposit tied to an FID before:
  - Manual send (current holder choosing a target FID)
  - Yoink (eligible public action)
- Allow anyone to deposit USDC to the contract, providing their FID.
- Expose contract events for deposits including FID and amount for backend consumption.
- Add admin-only ERC20 withdrawal function and configurable USDC token address (mutable, default Base Mainnet: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`).
- Update backend APIs to enforce deposit requirement using on-chain checks or cached proofs.
- Update frontend to guide users through wallet connect, USDC approval, deposit, and then the action.

---

### Smart Contract: `contracts/src/ChooChooTrain.sol`

- [x] Add storage:
  - [ ] update `address public usdc;` initialized to Base Mainnet USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` in constructor
  - [x] `mapping(uint256 => uint256) public fidToUsdcDeposited;` (cumulative amount in smallest units)
  - [x] `uint256 public constant USDC_DECIMALS = 6;`
  - [x] `uint256 public depositCost = 1 * 10**USDC_DECIMALS;` (mutable via admin/owner setter)
- [x] Events:
  - [x] `event UsdcDeposited(address indexed from, uint256 indexed fid, uint256 amount);`
  - [x] `event UsdcWithdrawn(address indexed to, address indexed token, uint256 amount);`
  - [x] `event UsdcAddressUpdated(address indexed previous, address indexed current);`
  - [x] `event DepositCostUpdated(uint256 previous, uint256 current);`
- [x] Functions:
  - [x] `function setUsdc(address newUsdc) external onlyRole(DEFAULT_ADMIN_ROLE);` (update token address, emit event, validate nonzero)
  - [x] `function setDepositCost(uint256 newCost) external onlyRole(DEFAULT_ADMIN_ROLE);` (emit event)
  - [x] `function depositUSDC(uint256 fid, uint256 amount) external;`
    - [x] Requirements: `fid > 0`, `amount >= depositCost`
    - [x] Pull USDC via `IERC20(usdc).transferFrom(msg.sender, address(this), amount)`
    - [x] Increment `fidToUsdcDeposited[fid] += amount`
    - [x] Emit `UsdcDeposited(msg.sender, fid, amount)`
  - [x] `function withdrawERC20(address token, address to) external onlyAdmin;`
    - [x] Transfer entire balance to `to`, revert on zero balance, emit `UsdcWithdrawn(to, token, amount)`
  - [x] View helpers:
    - [x] `function getRequiredDeposit() external view returns (uint256)`
    - [x] `function getUsdcBalance() external view returns (uint256)`

### Contract Tests: `contracts/test/ChooChooTrain.t.sol`

- [x] Add USDC mock: prefer simple IERC20-compatible mock with 6 decimals.
- [x] New tests:
  - [x] `testDepositUsdcAtLeastOne()` ensures `depositUSDC` reverts if `amount < depositCost`, succeeds otherwise.
  - [x] `testDepositRecordsByFidAndEmitsEvent()` asserts mapping updated and event emitted with fid and amount.
  - [x] `testAnyUserCanDeposit()` multiple addresses depositing.
  - [x] `testWithdrawByAdmin()` only admin can withdraw USDC/any ERC20, non-admin reverts.
  - [x] `testSetUsdcAndSetDepositCostByAdmin()` mutate and verify values/events.
  - [x] Ensure existing flows unaffected: nextStop/yoink logic unchanged.

### Deployment Script `contracts/script/ChooChooTrain.s.sol`

- [ ] update deployment script with new constructor variables

---

### Backend Changes (Next.js API)

General:

- [x] Extend `app/src/lib/services/contract.ts` with read helpers:
  - [x] `getDepositCost(): Promise<bigint>`
  - [x] `getFidDeposited(fid: number): Promise<bigint>`
  - [x] `getUsdcAddress(): Promise<Address>`
  - [x] `getUsdcBalance(): Promise<bigint>`
  - [x] `hasDepositedEnough(fid: number): Promise<boolean>` (helper function)
- [x] Add deposit verification strategy:
  - Option A (recommended): Read on-chain `fidToUsdcDeposited[fid]` and compare against `depositCost`. No caching needed.

Endpoints to update:

- [x] `app/src/app/api/user-send-train/route.ts`
  - [x] Before orchestration, require `fidToUsdcDeposited[currentUserFid] >= depositCost`. If not met, respond 402-like error.
  - [x] Success path unchanged.
- [x] `app/src/app/api/yoink/route.ts`
  - [x] Require `fidToUsdcDeposited[userFid] >= depositCost` before allowing yoink.
  - [x] Extend body to include `userFid` (already present). Enforce check.
- [x] `app/src/app/api/send-train/route.ts` (public random):
  - [x] No deposit required (unchanged) per requirement; confirmed.
- [x] Add `GET /api/deposit-status?fid=...` returning `{ required, deposited, satisfied }` for UI polling.

New deposit endpoint:

- [x] `GET /api/deposit-config` for canonical values (usdcAddress, depositCost, etc.)
- [x] Client-only deposit flow using ABIs (no server-side deposit endpoint needed)

---

### Frontend Changes

Providers / Wallet:

- [x] Ensure Wagmi configured for Base/Base Sepolia; already present. Add USDC chain info to UI.
- [x] Add a lightweight wallet connect flow (keeps Shadcn/Radix styling):
  - [x] Create `ConnectWalletDialog` using `base/Dialog` listing connectors (order: `farcasterFrame` → Coinbase Wallet → MetaMask).
  - [x] Use Wagmi `useConnect()` to trigger connector; show inline errors for rejected requests.
  - [x] Use `useSwitchChain()` to auto switch to Base when on wrong network; show fallback CTA if user cancels.
  - [x] Expose a `ConnectWalletButton` that opens the dialog and reflects states (connecting, wrong network, connected).
  - [x] In action buttons (manual send, yoink), if not connected: label “Connect wallet” and open `ConnectWalletDialog` when clicked.
  - [x] In deposit flows, silently handle switching to the proper network when chain mismatch, user shouldn't have to manually switch network. use custom hook if required

Optional Polish:

- [x] Handle deep links for mobile wallets (MetaMask/Coinbase) where applicable; avoid blocking modals.

Deposit UI/flow:

- [x] Create reusable `DepositUsdcButton` client component:
  - [x] Props: `fid: number`, `onDeposited?: () => void`, `className?`
  - [x] Reads `usdcAddress`, `depositCost` from `/api/deposit-config`.
  - [x] Steps:
    - [x] If not connected → “Connect wallet”.
    - [x] If connected, show “Approve USDC” if allowance < cost → call `usdc.approve(contract, cost)`.
    - [x] Then show “Deposit 1 USDC” → call `contract.depositUSDC(fid, cost)`.
    - [x] Poll receipt; on success, trigger `onDeposited`.
  - [x] Display helpful errors (insufficient USDC, wrong network, approval denied).

Manual Send (`app/src/components/ui/UserNextStopWidget.tsx`):

- [x] Add pre-check to determine if deposit satisfied for current user FID.
- [x] UI states:
  - [x] Not connected → button “Connect wallet”.
  - [x] Connected but not deposited → render `DepositUsdcButton` prior to “Send ChooChoo”.
  - [x] After deposit success → enable existing manual send submission.
- [x] Add loading/status to reflect deposit progress.

Yoink Page (`app/src/components/pages/YoinkPage.tsx`):

- [x] Add deposit requirement similar to manual send:
  - [x] Not connected → “Connect wallet”.
  - [x] Connected but not deposited → show `DepositUsdcButton` with user FID.
  - [x] After deposit success and cooldown available → enable “Yoink ChooChoo!”.
- [ ] Update `useYoinkFlow` to pass `userFid` in request body and to surface deposit errors.

Hooks / Utils:

- [x] New hook `useDepositStatus(fid)`:
  - [x] Reads deposit config and status via API.
  - [x] Returns `{ satisfied, deposited, required, isLoading, error, refresh }`.
- [x] New hook `useDepositUsdc(fid)` orchestrating approve+deposit transactions.

Types and ABI:

- [x] Update `app/src/abi/ChooChooTrain.abi.json` with new contract functions/events.
- [x] Use viem’s erc20.

UX Copy:

- [x] Update copy to explain 1 USDC requirement on relevant pages.

---

### Data and State

- [ ] Optionally cache deposit satisfaction in Redis keyed by FID with TTL to reduce RPC calls.
- [ ] Ensure backend-only actions (admin orchestrations) stay gated by deposit verification and do not require wallet in backend.
- [ ] Consider rate-limiting deposit endpoint if added.

---

### Edge Cases / Error Handling

- [ ] User approves but doesn’t finalize deposit → keep prompting to deposit.
- [ ] User deposits >1 USDC → accept and mark satisfied; surplus remains on contract.
- [ ] Multiple deposits from different wallets for same FID → cumulative in mapping.
- [ ] Wrong network → show network switch prompt.
- [ ] USDC address change → client reads from contract to avoid mismatch.

---

### QA Checklist

- [x] Contract compiles and tests pass.
- [ ] Deposit emits `UsdcDeposited` with correct fid and amount.
- [ ] Admin withdrawal restricted and functional.
- [ ] Manual send fails without deposit; succeeds after deposit.
- [ ] Yoink fails without deposit; succeeds after deposit and cooldown.
- [ ] Frontend deposit flow works on Base Sepolia with test USDC.
- [ ] ABI and env vars updated in both server and client.

---

### Rollout Steps

- [ ] Deploy contract update to Base Sepolia.
- [ ] Update `NEXT_PUBLIC_CHOOCHOO_TRAIN_ADDRESS` and ABI in app.
- [ ] Run contract tests and basic E2E flows in staging.
- [ ] Announce change and update docs.
