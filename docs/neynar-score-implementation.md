# Neynar Score Anti-Bot Protection Implementation Guide

## Overview

This document outlines the steps to implement Neynar score-based anti-bot protection for the ChooChoo app. The Neynar score is a user reputation metric that helps identify legitimate Farcaster users vs. bots.

## Prerequisites

- Neynar API key (already configured in `NEYNAR_API_KEY` environment variable)
- Understanding of the train orchestration flow
- Access to test the changes thoroughly before deploying

## Implementation Steps

### 1. Create Neynar Score Service

Create a new service file to handle Neynar score checks:

**File:** `app/src/lib/services/neynar-score.ts`

```typescript
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

// Adjust this threshold based on your needs (0.5-0.6 is typical)
export const MIN_NEYNAR_SCORE = 0.55;

export interface NeynarScoreCheck {
  score: number;
  meetsMinimum: boolean;
}

interface NeynarUser {
  fid: number;
  username: string;
  score?: number;
}

export async function checkNeynarScore(fid: number): Promise<NeynarScoreCheck> {
  if (!NEYNAR_API_KEY) {
    throw new Error('NEYNAR_API_KEY environment variable is required');
  }

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      {
        headers: {
          accept: 'application/json',
          'x-api-key': NEYNAR_API_KEY,
        },
      }
    );

    if (!response.ok) {
      console.error(`[neynar-score] Failed to fetch user data: ${response.status}`);
      throw new Error('Failed to fetch Neynar user data');
    }

    const data = await response.json();
    const user = data?.users?.[0] as NeynarUser | undefined;

    if (!user) {
      throw new Error(`User with FID ${fid} not found`);
    }

    // Use the main 'score' field (not experimental.neynar_user_score which is deprecated)
    const score = user.score ?? 0;
    const meetsMinimum = score >= MIN_NEYNAR_SCORE;

    console.log(
      `[neynar-score] User ${user.username} (FID: ${fid}) has score: ${score} (minimum: ${MIN_NEYNAR_SCORE})`
    );

    return {
      score,
      meetsMinimum,
    };
  } catch (error) {
    console.error(`[neynar-score] Failed to check score for FID ${fid}:`, error);
    throw new Error(
      `Failed to check Neynar score: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
```

### 2. Update Train Orchestrator

Modify the orchestrator to check Neynar scores for all non-admin train movements.

**File:** `app/src/lib/train-orchestrator.ts`

#### 2a. Add Import

```typescript
import { checkNeynarScore, MIN_NEYNAR_SCORE } from '@/lib/services/neynar-score';
```

#### 2b. Update `orchestrateManualSend` Function

Add a `skipNeynarScoreCheck` parameter for admin bypass:

```typescript
export async function orchestrateManualSend(
  currentHolderFid: number,
  targetFid: number,
  skipNeynarScoreCheck = false // New parameter
) {
  // ... existing lock acquisition code ...

  try {
    // ... existing code to get nextTokenId and fetch user data ...

    // Add Neynar score check (unless admin bypass)
    if (!skipNeynarScoreCheck) {
      const targetScoreCheck = await checkNeynarScore(targetFid);
      if (!targetScoreCheck.meetsMinimum) {
        throw new Error(
          `Target user must have a Neynar score of at least ${MIN_NEYNAR_SCORE} to receive ChooChoo (current score: ${targetScoreCheck.score})`
        );
      }
    } else {
      console.log('[orchestrateManualSend] Skipping Neynar score check (admin send)');
    }

    // ... rest of the orchestration logic ...
  } catch (error) {
    // ... existing error handling ...
  } finally {
    // ... existing lock release ...
  }
}
```

#### 2c. Update `orchestrateRandomSend` Function

Add score check after winner selection:

```typescript
export async function orchestrateRandomSend(castHash: string) {
  // ... existing code ...

  try {
    // ... existing winner selection code ...

    // Check winner's Neynar score
    const winnerScoreCheck = await checkNeynarScore(winnerData.winner.fid);
    if (!winnerScoreCheck.meetsMinimum) {
      throw new Error(
        `Selected winner does not meet the minimum Neynar score requirement (score: ${winnerScoreCheck.score})`
      );
    }

    // ... rest of the orchestration logic ...
  } catch (error) {
    // ... existing error handling ...
  }
}
```

#### 2d. Update `orchestrateYoink` Function

Add score check after eligibility checks:

```typescript
export async function orchestrateYoink(userFid: number, targetAddress: string) {
  // ... existing code ...

  try {
    // ... existing eligibility checks (hasDeposited, etc.) ...

    // Check yoinker's Neynar score
    const yoinkScoreCheck = await checkNeynarScore(userFid);
    if (!yoinkScoreCheck.meetsMinimum) {
      throw new Error(
        `You must have a Neynar score of at least ${MIN_NEYNAR_SCORE} to yoink ChooChoo (current score: ${yoinkScoreCheck.score})`
      );
    }

    // ... rest of the orchestration logic ...
  } catch (error) {
    // ... existing error handling ...
  }
}
```

### 3. Update Winner Selection API

Modify the winner selection to skip users who don't meet the score requirement.

**File:** `app/src/app/api/internal/select-winner/route.ts`

```typescript
import { checkNeynarScore, MIN_NEYNAR_SCORE } from '@/lib/services/neynar-score';

// In the winner selection loop:
let skippedForScore = 0;

while (candidates.length > 0) {
  const candidateIndex = Math.floor(Math.random() * candidates.length);
  const [candidate] = candidates.splice(candidateIndex, 1);

  try {
    // Check Neynar score
    const scoreCheck = await checkNeynarScore(candidate.fid);
    if (scoreCheck.meetsMinimum) {
      winner = candidate;
      break;
    }

    skippedForScore += 1;
    console.log(
      `[select-winner] Skipping ${candidate.username} (FID: ${candidate.fid}) - Neynar score too low (${scoreCheck.score}, minimum: ${MIN_NEYNAR_SCORE})`
    );
  } catch (error) {
    skippedForScore += 1;
    console.warn(
      `[select-winner] Failed to verify Neynar score for ${candidate.username}:`,
      error
    );
  }
}

if (!winner) {
  console.warn(
    `[select-winner] No repliers met the minimum Neynar score requirement. Skipped ${skippedForScore} candidates.`
  );
  return NextResponse.json(
    {
      success: false,
      error: 'No eligible repliers meet the minimum Neynar score requirement',
    },
    { status: 400 }
  );
}
```

### 4. Update Admin Send Route

Pass the `skipNeynarScoreCheck` flag for admin sends.

**File:** `app/src/app/api/admin/send-train/route.ts`

```typescript
// In the POST handler:
const result = await orchestrateManualSend(
  currentHolderFid,
  targetFid,
  true // Skip Neynar score check for admin sends
);
```

### 5. Update Frontend UI

Update the deposit button to inform users about the Neynar score requirement.

**File:** `app/src/components/ui/DepositUsdcButton.tsx`

```typescript
import { MIN_NEYNAR_SCORE } from '@/lib/services/neynar-score';

// In the component:
<Typography variant="body">
  {satisfied
    ? 'You have deposited enough USDC to proceed.'
    : `Deposit ${DEPOSIT_COST_USDC} USDC to participate. You must have a Neynar score of at least ${MIN_NEYNAR_SCORE} to receive ChooChoo.`}
</Typography>
```

### 6. Hide Yoink Button When Paused

**File:** `app/src/components/pages/HomePage.tsx`

```typescript
// Wrap the Yoink countdown/button section:
{!isPaused && (
  <div className="mt-4 flex justify-center">
    {/* Yoink countdown/button code */}
  </div>
)}
```

**File:** `app/src/components/ui/Footer.tsx`

```typescript
// Add isPaused prop and conditionally render:
{!isPaused && (
  <Button onClick={() => setActiveTab('yoink')}>
    <Typography variant="small">Yoink</Typography>
  </Button>
)}
```

## Testing Checklist

Before deploying, test the following scenarios:

### Unit Tests

1. **Neynar Score Service**
   - [ ] Returns correct score for valid FID
   - [ ] Throws error for invalid FID
   - [ ] Handles API failures gracefully
   - [ ] Correctly evaluates `meetsMinimum` based on threshold

2. **Orchestrator Functions**
   - [ ] Manual send rejects users below threshold
   - [ ] Manual send allows users above threshold
   - [ ] Admin send bypasses score check
   - [ ] Random send skips low-score winners
   - [ ] Yoink rejects low-score users

### Integration Tests

1. **Admin Send**
   - [ ] Can send to any user (bypasses score check)
   - [ ] Transaction completes successfully
   - [ ] Redis state updates correctly

2. **Random Send**
   - [ ] Selects winner with sufficient score
   - [ ] Skips users with low scores
   - [ ] Falls back to next candidate if needed
   - [ ] Fails gracefully if no eligible users

3. **Yoink**
   - [ ] Blocks users with low scores
   - [ ] Allows users with sufficient scores
   - [ ] Error messages are clear

### End-to-End Tests

1. **User Flow**
   - [ ] Deposit USDC works
   - [ ] Yoink button hidden when paused
   - [ ] Error messages display correctly
   - [ ] Train movements complete successfully

2. **Edge Cases**
   - [ ] Neynar API timeout handling
   - [ ] Network errors during score check
   - [ ] User with exactly threshold score
   - [ ] User with no score (defaults to 0)

## Rollback Plan

If issues occur after deployment:

1. **Immediate Rollback**
   ```bash
   git revert <commit-hash>
   git push
   ```

2. **Quick Fix Alternative**
   - Set `MIN_NEYNAR_SCORE = 0` to effectively disable the check
   - This allows all users through while you debug

3. **Gradual Rollout**
   - Start with a low threshold (0.3)
   - Monitor for false positives
   - Gradually increase to desired level (0.55)

## Monitoring

After deployment, monitor:

1. **Logs**
   - Check for Neynar API errors
   - Monitor score check failures
   - Watch for timeout issues

2. **Metrics**
   - Track percentage of users blocked
   - Monitor train movement success rate
   - Check for increased error rates

3. **User Feedback**
   - Watch for complaints about being blocked
   - Monitor support channels
   - Track legitimate users affected

## Configuration

### Adjusting the Threshold

The threshold is set in `app/src/lib/services/neynar-score.ts`:

```typescript
export const MIN_NEYNAR_SCORE = 0.55; // Adjust this value
```

**Recommended thresholds:**
- `0.3-0.4`: Very permissive (blocks only obvious bots)
- `0.5-0.6`: Balanced (recommended)
- `0.7+`: Strict (may block some legitimate new users)

### Environment Variables

Ensure these are set:
- `NEYNAR_API_KEY`: Your Neynar API key
- `USE_MAINNET`: `true` for production

## Common Issues & Solutions

### Issue: Transaction not found on-chain

**Symptoms:** Error message "Transaction not found on-chain"

**Causes:**
1. Wrong network configuration
2. Transaction never broadcast
3. RPC node lag

**Solutions:**
1. Verify `USE_MAINNET` environment variable
2. Check RPC URL is correct
3. Add retry logic with exponential backoff
4. Verify admin wallet has sufficient gas

### Issue: All users being blocked

**Symptoms:** No one can receive ChooChoo

**Causes:**
1. Threshold set too high
2. Neynar API returning incorrect scores
3. Using deprecated score field

**Solutions:**
1. Lower `MIN_NEYNAR_SCORE` temporarily
2. Verify API response format
3. Ensure using `user.score` not `experimental.neynar_user_score`

### Issue: Admin sends failing

**Symptoms:** Admin can't send even with bypass

**Causes:**
1. `skipNeynarScoreCheck` not passed correctly
2. Other validation failing before score check

**Solutions:**
1. Verify admin route passes `true` for skip parameter
2. Check logs for actual error
3. Test admin wallet permissions on contract

## Additional Resources

- [Neynar API Documentation](https://docs.neynar.com/)
- [Neynar User Score Explanation](https://docs.neynar.com/docs/user-score)
- ChooChoo Contract: `CHOOCHOO_TRAIN_ADDRESS`

## Support

If you encounter issues:
1. Check logs for detailed error messages
2. Verify all environment variables are set
3. Test on testnet first
4. Reach out to Neynar support for API issues
