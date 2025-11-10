# Update Redis State Script

Interactive CLI script to update Redis state values.

## Usage

```bash
# Using npm script (recommended)
npm run update-redis <REDIS_URL>

# Or directly with tsx
npx tsx scripts/update-redis-state.ts <REDIS_URL>

# Example
npm run update-redis redis://localhost:6379
npm run update-redis redis://default:password@host:port
```

## What It Does

Allows you to interactively update:
1. **current-holder** - Current train holder data
2. **current-token-id** - Latest minted token ID tracker
3. **last-moved-timestamp** - Last train movement timestamp

## Example Session

```
🔌 Connecting to Redis...
✅ Connected to Redis

📋 Which value do you want to set?
─────────────────────────────────
1. current-holder
2. current-token-id
3. last-moved-timestamp
4. Exit

Enter choice (1-4): 1

📝 Updating Current Holder
─────────────────────────────
Enter FID (number): 12345
Enter username: alice
Enter display name (or press Enter to use username): Alice
Enter PFP URL (or press Enter for empty): https://...
Enter address (0x...): 0xf0465138C7e5A41Cb97Fa6838E81BeAb549789de
Enter timestamp (ISO format, or press Enter for current time):

✅ Current holder updated successfully!
{
  "fid": 12345,
  "username": "alice",
  "displayName": "Alice",
  "pfpUrl": "https://...",
  "address": "0xf0465138C7e5A41Cb97Fa6838E81BeAb549789de",
  "timestamp": "2025-11-10T03:00:00.000Z"
}

Would you like to do another? (y/n): n

👋 Goodbye!
```

## Requirements

- Node.js
- `tsx` (installed automatically via npx)
- Redis connection URL

## Use Cases

- Recovering from failed mints (when transaction succeeded but Redis wasn't updated)
- Manual state corrections
- Testing state changes
- Emergency state fixes
