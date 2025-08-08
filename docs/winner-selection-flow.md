# Winner Selection Flow Documentation

## Overview

The ChooChoo app supports two methods for selecting the next passenger:

1. **Manual Selection** - Current holder manually picks a specific user
2. **Chance Mode** - Community can pick a random reactor after a 30-minute timer

This document explains the complete flow, Redis state management, UI components, and testing procedures.

## Redis Keys

The winner selection system uses 4 primary Redis keys to manage state:

### `useRandomWinner` (string: "true" | "false")

- **Purpose**: Determines if chance mode is active
- **Set by**: `/api/enable-random-winner` endpoint when user confirms chance mode
- **Read by**: `WinnerSelectionWidget`, `PublicChanceWidget`
- **Default**: `"false"` (or missing = false)

### `winnerSelectionStart` (string: ISO timestamp)

- **Purpose**: Timestamp when chance mode was enabled (for 30min countdown)
- **Set by**: `/api/enable-random-winner` endpoint
- **Read by**: `PublicChanceWidget` for countdown calculation
- **Format**: ISO string (e.g., `"2024-01-15T14:30:00.000Z"`)
- **Default**: `null` (or missing)

### `isPublicSendEnabled` (string: "true" | "false")

- **Purpose**: Whether the public random pick button is enabled
- **Set by**:
  - `/api/enable-random-winner` sets to `"false"` initially
  - Auto-enabled client-side when 30min timer expires
  - Can be manually set via `/api/redis` for testing
- **Read by**: `PublicChanceWidget`
- **Default**: `"false"` (or missing = false)

### `current-cast-hash` (string: cast hash)

- **Purpose**: Hash of the announcement cast created when chance mode is enabled
- **Set by**: `/api/enable-random-winner` endpoint when creating announcement cast
- **Read by**: `PublicChanceWidget` to display the cast
- **Format**: Hex string (e.g., `"0x104fa3f438bc2e0ad32e7b5c6c90243e7728bae7"`)
- **Default**: `null` (or missing)

## State Definitions

### Initial State

```
useRandomWinner: false (or missing)
winnerSelectionStart: null (or missing)
isPublicSendEnabled: false (or missing)
current-cast-hash: null (or missing)
```

**UI Behavior**: Shows `WinnerSelectionWidget` with Send/Chance tabs for current holder

### Chance Mode Just Confirmed

```
useRandomWinner: true
winnerSelectionStart: <30 minutes in future>
isPublicSendEnabled: false
current-cast-hash: <announcement cast hash>
```

**UI Behavior**: Shows `PublicChanceWidget` with countdown and disabled random pick button

### Chance Mode - Timer Expired

```
useRandomWinner: true
winnerSelectionStart: <30 minutes in past>
isPublicSendEnabled: true
current-cast-hash: <announcement cast hash>
```

**UI Behavior**: Shows `PublicChanceWidget` with enabled random pick button for everyone

### Manual Send Mode

```
useRandomWinner: false
winnerSelectionStart: null
isPublicSendEnabled: false
current-cast-hash: null
```

**UI Behavior**: Same as Initial State - manual selection only

## UI Components

### WinnerSelectionWidget

- **Location**: `app/src/components/ui/WinnerSelectionWidget.tsx`
- **Visibility**: Only current token holder after they've sent their announcement cast
- **Purpose**: Let current holder choose between manual selection or chance mode

#### Behavior:

1. **Renders when**: `useRandomWinner` is `false` (or missing)
2. **Disappears when**: User confirms chance mode (`useRandomWinner` becomes `true`)
3. **Contains**:
   - Send tab: Username input + manual send button
   - Chance tab: Description + confirm button + confirmation dialog

#### Key Functions:

- `confirmEnableChance()`: Calls `/api/enable-random-winner`, sets local state, closes dialog, triggers UI refresh
- `handleManualSend()`: Calls `/api/user-send-train` with selected user FID

### PublicChanceWidget

- **Location**: `app/src/components/ui/PublicChanceWidget.tsx`
- **Visibility**: Everyone (when chance mode is active)
- **Purpose**: Show countdown and provide public random pick functionality

#### Behavior:

1. **Renders when**: `useRandomWinner` is `true`
2. **Returns null when**: `useRandomWinner` is `false`
3. **Contains**:
   - Announcement cast display (from `current-cast-hash`)
   - Countdown timer (until `winnerSelectionStart` + 30min)
   - Random pick button (enabled when `isPublicSendEnabled` is `true`)

#### Key Functions:

- `fetchState()`: Polls Redis every 30s + listens for `choo-random-enabled` event
- `handlePublicRandomSend()`: Calls `/api/send-train` when button is enabled

### CastDisplayWidget

- **Location**: `app/src/components/ui/CastDisplayWidget.tsx`
- **Purpose**: Display Farcaster cast from hash
- **Used by**: `PublicChanceWidget` to show announcement cast
- **Styling**: Purple card with clickable cast content (opens on Warpcast)

## API Endpoints

### `/api/enable-random-winner` (POST)

- **Purpose**: Enable chance mode and create announcement cast
- **Body**: `{ username: string }`
- **Actions**:
  1. Creates announcement cast on Farcaster
  2. Sets `useRandomWinner: "true"`
  3. Sets `winnerSelectionStart: <current time + 30min>`
  4. Sets `isPublicSendEnabled: "false"`
  5. Sets `current-cast-hash: <cast hash>`
- **Response**: `{ success: boolean, winnerSelectionStart: string }`

### `/api/user-send-train` (POST)

- **Purpose**: Manual send to specific user
- **Body**: `{ targetFid: number }`
- **Actions**: Transfers token, clears random mode state, updates current holder

### `/api/send-train` (POST)

- **Purpose**: Random send to reactor from announcement cast
- **Body**: Empty (uses `current-cast-hash` from Redis)
- **Actions**: Picks random reactor, transfers token, clears random mode state

### `/api/redis` (GET/POST)

- **Purpose**: Direct Redis key management (admin/testing)
- **GET**: `?action=read&key=<keyname>`
- **POST**: `{ action: "write|delete", key: string, value?: string }`

## UI Flow Diagram

```
Current Holder Has ChooChoo
           ↓
    WinnerSelectionWidget
      (Send | Chance tabs)
           ↓
    ┌─────────────────┬─────────────────┐
    │   Send Tab      │   Chance Tab    │
    │                 │                 │
    │ Username Input  │ Confirm Button  │
    │ Manual Send     │      ↓          │
    │      ↓          │ Confirmation    │
    │ /api/user-      │    Dialog       │
    │ send-train      │      ↓          │
    │                 │ /api/enable-    │
    │                 │ random-winner   │
    └─────────────────┴─────────────────┘
                           ↓
                  Widget disappears
                  useRandomWinner = true
                           ↓
                  PublicChanceWidget
                   (for everyone)
                     ↓        ↓
              Countdown    Cast Display
               Timer      (announcement)
                ↓
         Timer Expires (30min)
         isPublicSendEnabled = true
                ↓
         Random Pick Button Enabled
                ↓
         Anyone can click to call
            /api/send-train
                ↓
         Random reactor selected
         Token transferred
         State reset to Initial
```

## Event System

### Custom Events

- **`choo-random-enabled`**: Dispatched when chance mode is confirmed
  - **Triggered by**: `WinnerSelectionWidget.confirmEnableChance()`
  - **Listened by**: `PublicChanceWidget` for immediate state refresh
  - **Purpose**: Avoid waiting for 30s polling interval

### State Synchronization

1. User confirms chance mode → API call → Redis update
2. `WinnerSelectionWidget` updates local state → dispatches event → disappears
3. `PublicChanceWidget` catches event → fetches fresh Redis state → appears with countdown
4. Timer counts down client-side → enables button when expired

## Testing States

The admin panel (`/admin`) includes a "Redis State Testing" card with buttons to instantly switch between states:

### Test Buttons:

1. **Initial State**: Reset all keys for fresh start
2. **Chance Mode Just Confirmed**: 30min countdown active
3. **Chance Mode - Timer Expired**: Public button enabled
4. **Manual Send Mode**: Manual selection only

### Test Cast Hash:

For testing, the system uses: `0x104fa3f438bc2e0ad32e7b5c6c90243e7728bae7`

### Admin Testing Workflow:

1. Go to `/admin` (admin FID required)
2. Click any state button in "Redis State Testing"
3. UI updates immediately (no page refresh)
4. Test the flow in that state
5. Switch to another state to test transitions

## Sound Effects

### Train Whistle Behavior:

- **Triggered by**: Toast messages with priority ≤ `MessagePriority.TOAST`
- **Suppressed when**: Using `MessagePriority.USER_CONTEXT` or higher
- **Implementation**: `MarqueeHeader` listens for `newToastAdded` and plays sound

### Silent Toasts:

Success messages in winner selection use `MessagePriority.USER_CONTEXT` to avoid unwanted whistle sounds during state transitions.

## Error Handling

### Network Failures:

- API calls have try/catch with user-friendly error toasts
- State fetching failures are logged but don't break UI
- Redis read failures default to `false`/`null` values

### Invalid States:

- Missing Redis keys are treated as default values
- Malformed timestamps are ignored (countdown won't show)
- Invalid cast hashes result in "Cast not found" display

### Race Conditions:

- Local state updates happen optimistically
- Event dispatching refreshes other components immediately
- 200ms delay before router.refresh() allows Redis writes to settle

## Performance Considerations

### Polling:

- `PublicChanceWidget` polls Redis every 30 seconds
- Countdown timer updates every 1 second (client-side calculation)
- Event system reduces need for frequent polling

### Memory:

- Components unmount/return null when not needed
- Event listeners are properly cleaned up in useEffect returns
- Intervals are cleared on component unmount

### Network:

- Parallel Redis reads for efficiency (`Promise.all`)
- Minimal API calls (only when user takes action)
- Cast data cached until component unmounts

---

This documentation should be updated when the winner selection system is modified.
