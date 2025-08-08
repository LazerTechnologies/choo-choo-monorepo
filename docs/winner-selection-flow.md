# Winner Selection Flow Documentation

## Overview

The ChooChoo app supports two methods for selecting the next passenger:

1. **Manual Selection** - Current holder manually picks a specific user
2. **Chance Mode** - Community can pick a random reactor after a 30-minute timer

This document explains the complete flow, Redis state management, UI components, and testing procedures.

## Workflow State System

The winner selection system uses a **single Redis key** containing a complete workflow state as JSON:

### `workflowState` (JSON object)

- **Key**: `workflowState`
- **Purpose**: Single source of truth for the entire selection workflow
- **Format**: JSON string containing `WorkflowData` object
- **Updated by**: `/api/workflow-state`, webhook endpoints, train movement endpoints
- **Read by**: `useWorkflowState` hook, all UI components

#### WorkflowData Structure:

```typescript
{
  state: WorkflowState,              // Current workflow state (enum)
  winnerSelectionStart: string|null, // ISO timestamp when chance mode started
  currentCastHash: string|null       // Hash of announcement cast
}
```

## Workflow States (Enum)

### `NOT_CASTED`

```json
{
  "state": "NOT_CASTED",
  "winnerSelectionStart": null,
  "currentCastHash": null
}
```

**UI Behavior**: Shows `CastingWidget` to current holder only

### `CASTED`

```json
{
  "state": "CASTED",
  "winnerSelectionStart": null,
  "currentCastHash": null
}
```

**UI Behavior**: Shows `WinnerSelectionWidget` with Send/Chance tabs to current holder only

### `CHANCE_ACTIVE`

```json
{
  "state": "CHANCE_ACTIVE",
  "winnerSelectionStart": "2024-01-15T14:30:00.000Z",
  "currentCastHash": "0x104fa3f438bc2e0ad32e7b5c6c90243e7728bae7"
}
```

**UI Behavior**: Shows `PublicChanceWidget` with countdown + `CastDisplayWidget` to everyone

### `CHANCE_EXPIRED`

```json
{
  "state": "CHANCE_EXPIRED",
  "winnerSelectionStart": "2024-01-15T14:00:00.000Z",
  "currentCastHash": "0x104fa3f438bc2e0ad32e7b5c6c90243e7728bae7"
}
```

**UI Behavior**: Shows `PublicChanceWidget` with enabled random button + `CastDisplayWidget` to everyone

### `MANUAL_SEND`

```json
{
  "state": "MANUAL_SEND",
  "winnerSelectionStart": null,
  "currentCastHash": null
}
```

**UI Behavior**: Shows loading state during manual transfer

## UI Components

### CastingWidget

- **Location**: `app/src/components/ui/CastingWidget.tsx`
- **Visibility**: Current holder only in `NOT_CASTED` state
- **Purpose**: Let current holder send their announcement cast

#### Behavior:

1. **Renders when**: Workflow state is `NOT_CASTED` and user is current holder
2. **Transitions to**: `CASTED` state when cast is detected by webhook
3. **Contains**: Cast preview + "Send Cast" button

#### Key Functions:

- `handlePostCast()`: Opens Warpcast for casting
- Updates workflow to `CASTED` when webhook detects cast

### WinnerSelectionWidget

- **Location**: `app/src/components/ui/WinnerSelectionWidget.tsx`
- **Visibility**: Current holder only in `CASTED` state
- **Purpose**: Let current holder choose between manual selection or chance mode

#### Behavior:

1. **Renders when**: Workflow state is `CASTED` and user is current holder
2. **Transitions to**: `MANUAL_SEND` or `CHANCE_ACTIVE` based on user choice
3. **Contains**:
   - Send tab: Username input + manual send button
   - Chance tab: Description + confirm button + confirmation dialog

#### Key Functions:

- `handleManualSend()`: Updates to `MANUAL_SEND`, calls `/api/user-send-train`
- `confirmEnableChance()`: Updates to `CHANCE_ACTIVE`, calls `/api/enable-random-winner`

### PublicChanceWidget

- **Location**: `app/src/components/ui/PublicChanceWidget.tsx`
- **Visibility**: Everyone in `CHANCE_ACTIVE` or `CHANCE_EXPIRED` states
- **Purpose**: Show countdown and provide public random pick functionality

#### Behavior:

1. **Renders when**: Workflow state is `CHANCE_ACTIVE` or `CHANCE_EXPIRED`
2. **Auto-transitions**: From `CHANCE_ACTIVE` to `CHANCE_EXPIRED` when timer expires
3. **Contains**:
   - Countdown timer (in `CHANCE_ACTIVE` state)
   - Random pick button (enabled in `CHANCE_EXPIRED` state)

#### Key Functions:

- `handlePublicRandomSend()`: Calls `/api/send-train` when button is enabled
- Auto-updates workflow state when 30min timer expires

### CastDisplayWidget

- **Location**: `app/src/components/ui/CastDisplayWidget.tsx`
- **Purpose**: Display Farcaster cast from hash
- **Used by**: `HomePage` displays below `PublicChanceWidget` in chance states
- **Styling**: Purple card with clickable cast content (opens on Warpcast)

## API Endpoints

### `/api/workflow-state` (GET/POST)

- **Purpose**: Centralized workflow state management
- **GET**: Returns current `WorkflowData` from Redis
- **POST**: Updates workflow state with new `WorkflowData`
- **Body**: `{ state: WorkflowState, winnerSelectionStart?: string|null, currentCastHash?: string|null }`

### `/api/webhook/cast-detection` (POST)

- **Purpose**: Webhook handler for Neynar cast detection
- **Actions**: Updates workflow to `CASTED` when current holder posts announcement cast
- **Updates**: `workflowState` with cast hash

### `/api/enable-random-winner` (POST)

- **Purpose**: Enable chance mode and create announcement cast
- **Body**: `{ username: string }`
- **Actions**:
  1. Creates announcement cast on Farcaster
  2. Updates workflow to `CHANCE_ACTIVE` with cast hash and timer
- **Response**: `{ success: boolean, winnerSelectionStart: string, castHash: string|null }`

### `/api/user-send-train` (POST)

- **Purpose**: Manual send to specific user
- **Body**: `{ targetFid: number }`
- **Actions**: Transfers token, resets workflow to `NOT_CASTED`

### `/api/send-train` (POST)

- **Purpose**: Random send to reactor from announcement cast
- **Body**: Empty (reads cast hash from workflow state)
- **Actions**: Picks random reactor, transfers token, resets workflow to `NOT_CASTED`

### `/api/admin-send-train` (POST)

- **Purpose**: Admin-only manual token transfer
- **Actions**: Transfers token, resets workflow to `NOT_CASTED`

### `/api/cast-status` (GET)

- **Purpose**: Check if user has casted (for polling)
- **Params**: `?fid=<user_fid>`
- **Returns**: `{ hasCurrentUserCasted: boolean, currentCastHash: string|null }`

## State Transition Flow

```
NOT_CASTED (Initial)
    ↓ [Cast detected by webhook]
CASTED (Selection Mode)
    ↓                    ↓
[Manual Send]        [Chance Mode]
    ↓                    ↓
MANUAL_SEND         CHANCE_ACTIVE
    ↓                    ↓ [30min timer expires]
[Transfer complete] CHANCE_EXPIRED
    ↓                    ↓ [Random send triggered]
NOT_CASTED ←————————————————————
(New holder, cycle repeats)
```

## UI Flow Diagram

```
Current Holder Receives ChooChoo
           ↓
       NOT_CASTED
           ↓
   CastingWidget (Current Holder Only)
    "Send announcement cast"
           ↓ [Webhook detects cast]
        CASTED
           ↓
   WinnerSelectionWidget (Current Holder Only)
      (Send | Chance tabs)
           ↓
    ┌─────────────────┬─────────────────┐
    │   Send Tab      │   Chance Tab    │
    │                 │                 │
    │ Username Input  │ Confirm Button  │
    │ Manual Send     │      ↓          │
    │      ↓          │ Confirmation    │
    │   MANUAL_SEND   │    Dialog       │
    │      ↓          │      ↓          │
    │ /api/user-      │ CHANCE_ACTIVE   │
    │ send-train      │      ↓          │
    └─────────────────┤ /api/enable-    │
                      │ random-winner   │
                      └─────────────────┘
                             ↓
                    PublicChanceWidget
                     (visible to everyone)
                           ↓
                    CastDisplayWidget
                   (announcement cast below)
                           ↓
                  Timer Countdown (30min)
                           ↓
                    CHANCE_EXPIRED
                   (button enabled for all)
                           ↓
                 Anyone clicks random send
                      /api/send-train
                           ↓
                 Random reactor selected
                  Token transferred
                        ↓
                    NOT_CASTED
                 (New holder begins)
```

## Event System

### Custom Events

- **`workflow-state-changed`**: Dispatched when workflow state changes
  - **Triggered by**: Any workflow state update
  - **Listened by**: `useWorkflowState` hook for immediate refresh
  - **Purpose**: Real-time UI synchronization

### State Synchronization

1. User action triggers API call
2. API updates workflow state in Redis
3. API dispatches `workflow-state-changed` event
4. Components using `useWorkflowState` refresh immediately
5. UI updates based on new workflow state

## Testing with Admin Panel

The admin panel (`/admin`) includes a "Workflow State Testing" card with buttons to instantly switch between states:

### Test States Available:

1. **Not Casted (Initial State)**: Current holder hasn't sent announcement cast
2. **Casted (Selection Mode)**: Current holder can choose manual or chance mode
3. **Chance Mode - Active Countdown**: 30min countdown active, public sending disabled
4. **Chance Mode - Timer Expired**: Timer expired, public sending enabled
5. **Manual Send Mode**: Train is currently being sent manually

### Test Cast Hash:

For testing, the system uses: `0x104fa3f438bc2e0ad32e7b5c6c90243e7728bae7`

### Admin Testing Workflow:

1. Go to `/admin` (admin FID required)
2. Click any state button in "Workflow State Testing"
3. UI updates immediately via `workflow-state-changed` event
4. Test the UI flow in that state
5. Switch to another state to test transitions

## Redis Cleanup

### Current Keys (Keep):

- `workflowState`: Single JSON workflow state ✅
- `current-holder`: Current ChooChoo holder data ✅
- `app-paused`: Maintenance mode flag ✅

### Legacy Keys (Safe to Delete):

- `hasCurrentUserCasted` ❌
- `useRandomWinner` ❌
- `isPublicSendEnabled` ❌
- `winnerSelectionStart` ❌
- `current-cast-hash` ❌
- `workflow-state` ❌ (old individual state key)

## Performance Considerations

### Simplified State Management:

- Single Redis key eliminates multi-key synchronization issues
- Atomic updates prevent race conditions
- JSON parsing is minimal overhead for small workflow objects

### Real-time Updates:

- Event system provides instant UI updates
- No polling needed for state changes
- `useWorkflowState` hook centralizes state management

### Memory Efficiency:

- Components only render in appropriate workflow states
- Clean component unmounting when state changes
- Minimal re-renders due to centralized state

---

This documentation reflects the current clean workflow state system using enum-based state management and a single Redis key for atomic operations.
