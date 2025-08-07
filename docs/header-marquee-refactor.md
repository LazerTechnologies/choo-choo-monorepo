# Header Marquee Refactor Guide

## Overview

Transform the existing Header component into a train station-style marquee that displays scrolling messages including toast notifications mixed with humorous train-related announcements. This creates an immersive "train station" atmosphere while maintaining all notification functionality.

## Design Concept

### Visual Design

- **Position**: Fixed top header (keep existing positioning)
- **Style**: Train station departure board aesthetic with purple theme
- **Animation**: Continuous horizontal scroll using existing Marquee component
- **Priority System**: Emergency toast notifications interrupt normal flow

### Message Types

1. **Standard Messages**: Always-scrolling train humor/announcements
2. **Toast Notifications**: Urgent messages that temporarily interrupt the flow
3. **User Context**: Subtle user info integrated into scrolling messages

## Components to Modify/Create

### 1. Header.tsx → MarqueeHeader.tsx

**Location**: `app/src/components/ui/Header.tsx` → `app/src/components/ui/MarqueeHeader.tsx`

**Key Changes**:

- Remove user dropdown functionality (move to different component if needed)
- Replace profile picture display with marquee integration
- Maintain fixed positioning and purple theme
- Integrate with new MarqueeToastProvider

### 2. Create MarqueeToastProvider

**New File**: `app/src/providers/MarqueeToastProvider.tsx`

**Purpose**:

- Replace/extend existing toast system
- Manage message queue and prioritization
- Handle toast-to-marquee message conversion
- Control scroll cycles for urgent messages

### 3. Enhanced Marquee Component

**Extend**: `app/src/components/base/Marquee.tsx`

**New Features**:

- Dynamic message injection
- Scroll cycle counting
- Priority message handling
- Seamless transitions between message sets

## Implementation Strategy

### Message Management System

#### Standard Message Pool

inside of `/app/src/lib/constants.ts`:

```typescript
const TRAIN_STATION_MESSAGES = [
  '🚂 Next departure: Platform 9¾',
  '⛔ Mind the gap',
  '🍾 Reminder: No sex in the champagne room',
  '🎫 All aboard the ChooChoo express!',
  '🚃 The 4:20 express is now boarding on platform... uh... platform? lol',
  '📢 The conductor has been found, thank you',
  '🎵 Now playing: Thomas the Tank Engine ASMR',
  '🚂 Choo choo mfer!',
  '⏰ Delays expected due to cows on the tracks',
];
```

#### Toast Integration Pattern

```typescript
interface MarqueeMessage {
  id: string;
  content: string;
  type: 'standard' | 'toast' | 'user-context';
  priority: number;
  scrollCycles?: number; // For toast messages
  expiresAt?: number;
}

const handleToast = (toastMessage: string) => {
  const urgentMessage = {
    id: generateId(),
    content: `🚨🚨 ${toastMessage} 🚨🚨`,
    type: 'toast',
    priority: 1,
    scrollCycles: 2,
    expiresAt: Date.now() + 10000, // 10 seconds max
  };

  injectMessage(urgentMessage);
};
```

### Queue Management System

#### Message Queue Logic

1. **Default State**: Continuous rotation of standard train messages
2. **Toast Injection**: New toast message inserted at next position in queue
3. **Cycle Counting**: Track how many times toast message has scrolled
4. **Cleanup**: Remove toast message after specified cycles or timeout
5. **Recovery**: Return to standard message rotation

#### Priority System

```typescript
enum MessagePriority {
  EMERGENCY = 0, // Immediate injection (errors, critical alerts)
  TOAST = 1, // Normal toast notifications
  USER_CONTEXT = 2, // User info, achievements
  STANDARD = 3, // Default train humor
}
```

### User Context Integration

#### Subtle User Information

Instead of dropdown, integrate user info into marquee flow:

```typescript
const generateUserContextMessages = (user) => [
  `👋 Welcome aboard, ${user.displayName}!`,
  `🆔 Passenger ${user.username} (FID: ${user.fid})`,
  `⭐ Neynar Score: ${user.score}/10 (not bad!)`,
  `🎫 Current ticket holder: ${user.displayName}`,
];
```

## Technical Implementation Details

### 1. State Management

**Use Context/Provider Pattern**:

```typescript
interface MarqueeContextType {
  messages: MarqueeMessage[];
  addToastMessage: (message: string, priority?: number) => void;
  addUserContext: (user: User) => void;
  clearToasts: () => void;
}
```

### 2. Animation Control

**Enhanced Marquee Logic**:

- **Seamless Injection**: Insert new messages without stopping animation
- **Cycle Detection**: Track when specific messages complete full scroll
- **Dynamic Speed**: Potentially slow down for important messages
- **Smooth Transitions**: No jarring stops when switching message sets

### 3. Message Lifecycle

```typescript
const messageLifecycle = {
  // 1. Message Creation
  createMessage: (content, type, priority) => MarqueeMessage,

  // 2. Queue Injection
  injectMessage: (message) => void,

  // 3. Scroll Tracking
  trackScrollCycle: (messageId) => void,

  // 4. Expiration Check
  checkExpiration: (message) => boolean,

  // 5. Cleanup
  removeMessage: (messageId) => void
};
```

### 4. Toast System Migration

**Replace Existing Toast Hooks**:

```typescript
// Old: useToast()
// New: useMarqueeToast()

const useMarqueeToast = () => {
  const { addToastMessage } = useMarqueeContext();

  return {
    toast: ({ description, priority = 1 }) => {
      addToastMessage(description, priority);
    },
  };
};
```

## Integration Points

### 1. Home.tsx Updates

- Import MarqueeHeader instead of Header
- Wrap app in MarqueeToastProvider
- Remove toast container (now handled by marquee)

### 2. Existing Toast Usage

**Components to Update**:

- `CastingWidget.tsx` - Success/error messages
- `AdminPage.tsx` - Admin action feedback
- `YoinkPage.tsx` - Yoink status updates
- Any other components using `useToast()`

### 3. User Profile Access

**Alternative Solutions**:

- **Option A**: Profile button in footer/sidebar
- **Option B**: Profile info in marquee rotation
- **Option C**: Click/tap marquee to show user dropdown
- **Option D**: Remove profile access entirely (mini-app context sufficient)

## Visual Design Specifications

### Styling Approach

```typescript
const marqueeHeaderStyles = {
  background: 'linear-gradient(90deg, #a855f7, #9333ea, #a855f7)',
  border: '2px solid white',
  fontFamily: 'monospace', // Train station board aesthetic
  fontSize: '14px',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};
```

### Responsive Behavior

- **Mobile**: Smaller text, faster scroll speed
- **Desktop**: Larger text, readable scroll speed
- **Toast Priority**: Pause/slow scroll for emergency messages

### Animation Enhancements

- **Entry Animation**: New messages slide in smoothly
- **Priority Flash**: Emergency messages might flash/pulse
- **Scroll Speed**: Variable speed based on message importance
- **Smooth Cycles**: No jarring transitions between message sets

## Testing Strategy

### 1. Message Flow Testing

- Standard message rotation works continuously
- Toast injection doesn't break animation
- Cycle counting accurately tracks scrolls
- Messages expire correctly
- Queue returns to standard rotation

### 2. Performance Testing

- Smooth animation with dynamic message changes
- No memory leaks from expired messages
- Efficient DOM updates
- Responsive design across devices

### 3. User Experience Testing

- Toast messages are noticeable but not disruptive
- Humor messages maintain app personality
- User context information accessible
- Emergency messages get appropriate attention

## Migration Steps

### Phase 1: Component Creation

1. Create MarqueeToastProvider
2. Enhance base Marquee component
3. Create MarqueeHeader component
4. Set up message queue system

### Phase 2: Integration

1. Replace Header with MarqueeHeader in Home.tsx
2. Wrap app in MarqueeToastProvider
3. Update useToast hook to useMarqueeToast
4. Test basic functionality

### Phase 3: Enhancement

1. Add train station messages
2. Implement priority system
3. Add user context integration
4. Fine-tune animations and timing

### Phase 4: Polish

1. Add responsive design
2. Optimize performance
3. Add accessibility features
4. Test across all components

## Configuration Options

### Customizable Settings

```typescript
interface MarqueeConfig {
  scrollSpeed: number;
  standardMessages: string[];
  toastScrollCycles: number;
  maxToastAge: number;
  priorityDelayMs: number;
  userContextFrequency: number;
}
```

This approach transforms the header into an entertaining, functional train station marquee that maintains all notification functionality while adding personality and immersion to the app experience.
