# Cast-Yourself Flow Implementation Guide

## Overview

Replace the managed signers flow with a simpler "cast yourself" approach where users post casts directly in Warpcast, and the app detects the cast via webhook/polling to update the state.

## Benefits

- Eliminates signer approval complexity
- More reliable (no 403 errors)
- Better UX (users stay in familiar Warpcast)
- Simpler codebase
- No managed signer Redis storage needed

## Components to Modify

### 1. CastingWidget.tsx

**Location**: `app/src/components/ui/CastingWidget.tsx`

**Changes Needed**:

- Remove all signer management logic (`useSignerManager`, `hasApprovedSigner`, etc.)
- Replace "Send Cast" button with "Post Cast" button that opens Warpcast
- Add polling mechanism to check if user has posted the cast
- Show different states: "Post Cast" → "Waiting for cast..." → "Cast detected!"

**New Flow**:

```typescript
const handlePostCast = () => {
  const castText = encodeURIComponent(
    CHOOCHOO_CAST_TEMPLATES.USER_NEW_PASSENGER_CAST()
  );
  const warpcastUrl = `https://warpcast.com/~/compose?text=${castText}&embeds[]=https://choo-choo-app.com`;
  window.open(warpcastUrl, '_blank');

  // Start polling for the cast
  startPollingForCast();
};
```

### 2. Remove Signer Management Files

**Files to Delete**:

- `app/src/hooks/useSignerManager.ts`
- `app/src/components/ui/SignerApprovalModal.tsx`
- `app/src/app/api/signer/` (entire directory)

**Files to Update**:

- Remove signer functions from `app/src/lib/kv.ts`

### 3. Create Cast Detection System

#### Option A: Webhook Approach (Recommended)

**New File**: `app/src/app/api/webhook/cast-detection/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { CHOOCHOO_CAST_TEMPLATES } from '@/lib/constants';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Neynar webhook payload for new casts
    if (body.type === 'cast.published') {
      const cast = body.data;
      const castText = cast.text;
      const authorFid = cast.author.fid;

      // Check if this matches our template
      const expectedText = CHOOCHOO_CAST_TEMPLATES.USER_NEW_PASSENGER_CAST();
      if (castText.includes("I'm riding @choochoo!")) {
        // Check if author is current holder
        const currentHolder = await getCurrentHolder();
        if (currentHolder?.fid === authorFid) {
          // Update the active cast hash
          await setCastHash(cast.hash);

          // Mark user as having casted
          await axios.post('/api/user-casted-status', {
            hasCurrentUserCasted: true,
          });

          console.log(`Cast detected from current holder: ${cast.hash}`);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
```

#### Option B: Polling Approach (Fallback)

**New File**: `app/src/app/api/check-user-cast/route.ts`

```typescript
import neynarClient from '@/lib/neynarClient';
import { NextResponse } from 'next/server';
import { CHOOCHOO_CAST_TEMPLATES } from '@/lib/constants';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get('fid');

  if (!fid) {
    return NextResponse.json({ error: 'FID required' }, { status: 400 });
  }

  try {
    // Get user's recent casts (last 25)
    const casts = await neynarClient.fetchCastsForUser({
      fid: parseInt(fid),
      limit: 25,
    });

    const expectedText = CHOOCHOO_CAST_TEMPLATES.USER_NEW_PASSENGER_CAST();

    // Look for matching cast in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const cast of casts.casts) {
      const castTime = new Date(cast.timestamp);
      if (
        castTime > oneHourAgo &&
        cast.text.includes("I'm riding @choochoo!")
      ) {
        return NextResponse.json({
          found: true,
          castHash: cast.hash,
          cast: cast,
        });
      }
    }

    return NextResponse.json({ found: false });
  } catch (error) {
    console.error('Error checking user cast:', error);
    return NextResponse.json(
      { error: 'Failed to check cast' },
      { status: 500 }
    );
  }
}
```

### 4. Update CastingWidget Implementation

**New CastingWidget Logic**:

```typescript
export function CastingWidget({ onCastSent }: CastingWidgetProps) {
  const { context } = useMiniApp();
  const { isCurrentHolder, loading } = useCurrentHolder();
  const { toast } = useToast();
  const [isWaitingForCast, setIsWaitingForCast] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  const currentUserFid = context?.user?.fid;

  const handlePostCast = () => {
    const castText = encodeURIComponent(
      CHOOCHOO_CAST_TEMPLATES.USER_NEW_PASSENGER_CAST()
    );
    const warpcastUrl = `https://warpcast.com/~/compose?text=${castText}`;

    // Open Warpcast
    window.open(warpcastUrl, '_blank');

    // Start polling
    setIsWaitingForCast(true);
    startPolling();

    toast({
      description: 'Cast template opened in Warpcast. Post it and return here!',
    });
  };

  const startPolling = () => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/check-user-cast?fid=${currentUserFid}`
        );
        const data = await response.json();

        if (data.found) {
          // Cast detected!
          clearInterval(interval);
          setIsWaitingForCast(false);

          // Update cast hash
          await axios.post('/api/user-casted-status', {
            hasCurrentUserCasted: true,
          });

          toast({
            description: 'Cast detected! Thank you for posting.',
          });

          onCastSent?.();
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds

    setPollInterval(interval);

    // Stop polling after 10 minutes
    setTimeout(() => {
      clearInterval(interval);
      setIsWaitingForCast(false);
    }, 10 * 60 * 1000);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  if (!currentUserFid || loading || !isCurrentHolder) {
    return null;
  }

  return (
    <Card className="p-4 !bg-purple-500 !border-white">
      <div className="space-y-4">
        {/* User info display */}
        <div className="flex items-center gap-3">
          {context?.user?.pfpUrl && (
            <Image
              src={context.user.pfpUrl}
              width={40}
              height={40}
              alt="User Profile Picture"
              className="rounded-full"
            />
          )}
          <div>
            <Typography variant="body" className="font-semibold !text-white">
              {context?.user?.displayName || 'Current Holder'}
            </Typography>
            <Typography variant="small" className="!text-white">
              @{context?.user?.username || 'unknown'}
            </Typography>
          </div>
        </div>

        {/* Cast preview */}
        <div className="bg-purple-700 p-3 rounded-lg border border-white">
          <Typography
            variant="body"
            className="!text-white whitespace-pre-line"
          >
            {CHOOCHOO_CAST_TEMPLATES.USER_NEW_PASSENGER_CAST()}
          </Typography>
        </div>

        {isWaitingForCast && (
          <div className="bg-blue-100 border border-blue-400 p-3 rounded-lg">
            <Typography variant="small" className="!text-blue-800 text-center">
              🔄 Waiting for your cast... Post in Warpcast and return here.
            </Typography>
          </div>
        )}

        {/* Action button */}
        <div className="flex justify-center">
          <Button
            onClick={handlePostCast}
            disabled={isWaitingForCast}
            className="!text-white hover:!text-white !bg-purple-500 !border-2 !border-white px-8 py-2"
          >
            {isWaitingForCast ? 'Waiting for Cast...' : 'Post Cast in Warpcast'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

### 5. Webhook Configuration

**Neynar Webhook Setup**:

1. Configure webhook URL: `https://your-app.com/api/webhook/cast-detection`
2. Subscribe to event: `cast.published`
3. Add webhook secret validation (recommended)

**Webhook Validation** (optional but recommended):

```typescript
import crypto from 'crypto';

function validateWebhook(
  body: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return signature === `sha256=${expectedSignature}`;
}
```

### 6. Environment Variables

**Add to `.env.local`**:

```bash
NEYNAR_WEBHOOK_SECRET=your_webhook_secret_here
```

### 7. Remove Unused Code

**From Header.tsx**:

- Remove any signer-related imports
- Remove NeynarAuthButton (already done)

**From kv.ts**:

- Remove signer management functions:
  - `SignerInfo` interface
  - `setSignerInfo`
  - `getSignerInfo`
  - `updateSignerStatus`
  - `SIGNER_KEYS`

### 8. Testing the Flow

**Test Steps**:

1. Current holder sees "Post Cast in Warpcast" button
2. Click button → Warpcast opens with pre-filled cast
3. User posts cast in Warpcast
4. App shows "Waiting for cast..." state
5. Webhook/polling detects cast
6. App updates to show success and enables next flow

**Manual Testing**:

- Test webhook with ngrok for local development
- Test polling fallback if webhook fails
- Test timeout scenarios (10 minute limit)
- Test with actual Warpcast posting

## Implementation Priority

1. **Phase 1**: Remove signer management, update CastingWidget with basic flow
2. **Phase 2**: Add polling mechanism for cast detection
3. **Phase 3**: Implement webhook for real-time detection
4. **Phase 4**: Add robust error handling and timeout management

## Notes for Implementation

- Keep the same `onCastSent` callback for parent components
- Maintain the same visual styling and user info display
- Use the existing toast system for user feedback
- Preserve the current holder check logic
- The cast template should remain exactly the same
- Consider adding an embed URL to the cast for app attribution

This approach will be much more reliable and provide a better user experience while reducing code complexity significantly.
