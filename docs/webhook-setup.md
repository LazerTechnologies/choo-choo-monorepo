# Webhook Setup for Cast Detection

## Overview

The ChooChoo app now uses webhooks for real-time cast detection, providing a much smoother user experience compared to the previous signer management system.

## Neynar Webhook Configuration

### 1. Webhook URL

Configure your Neynar webhook to point to:

```
https://your-app-domain.com/api/webhook/cast-detection
```

### 2. Event Subscription

Subscribe to the following event:

- `cast.created`

### 3. Environment Variables

Add to your `.env.local`:

```bash
# Webhook configuration from Neynar developer portal
WEBHOOK_ID=your_webhook_id_here
NEYNAR_WEBHOOK_SECRET=your_webhook_secret_here

# Make sure this is set for the webhook to mark users as having casted
NEXT_PUBLIC_APP_URL=https://your-app-domain.com
```

### 4. Webhook Secret (Recommended)

For security, set up webhook signature validation:

1. Get your `WEBHOOK_ID` and webhook secret from your Neynar developer portal
2. Add them to your environment variables as `WEBHOOK_ID` and `NEYNAR_WEBHOOK_SECRET`
3. The webhook endpoint will automatically validate signatures when `NEYNAR_WEBHOOK_SECRET` is set

## How It Works

### Cast Detection Flow

1. **User Action**: Current holder clicks "Post Cast in Warpcast"
2. **Warpcast Opens**: Pre-filled cast template opens in Warpcast
3. **User Posts**: User posts the cast in Warpcast
4. **Webhook Triggered**: Neynar sends `cast.created` webhook to `/api/webhook/cast-detection`
5. **Cast Detected**: App detects cast from current holder and updates status
6. **User Notified**: App shows success message and enables next flow

### Webhook-Only Detection

The app uses a webhook-only approach for maximum reliability:

- **Webhook Detection**: Real-time `cast.created` events from Neynar
- **Status Polling**: Lightweight polling (every 3 seconds) to check webhook-updated status
- **Timeout**: 5 minutes for user to complete cast

## Benefits

- ✅ **No signer approval needed** - Users stay in familiar Warpcast
- ✅ **Real-time detection** - Webhook provides instant feedback
- ✅ **Webhook-only reliability** - No complex fallback logic, just webhook detection
- ✅ **Better UX** - Clear messaging and faster flow
- ✅ **Simpler codebase** - No complex signer management

## Testing

### Local Development with ngrok

For local testing with webhooks:

1. Install ngrok: `npm install -g ngrok`
2. Start your local server: `npm run dev`
3. Expose it: `ngrok http 3000`
4. Use the ngrok URL for webhook configuration: `https://abc123.ngrok.io/api/webhook/cast-detection`

### Manual Testing Steps

1. Ensure current holder sees "Post Cast in Warpcast" button
2. Click button → Warpcast should open with pre-filled cast
3. Post cast in Warpcast
4. Return to app → Should show "Cast detected!" within seconds
5. WinnerSelectionWidget should appear for next flow

## Monitoring

Check your application logs for webhook activity:

- `✅ Cast detected from current holder via webhook: {hash}`
- `ℹ️ ChooChoo cast detected but not from current holder: FID {fid}`
- Webhook validation errors (if signature validation is enabled)

## Troubleshooting

### Webhook Not Working

- Check webhook URL configuration in Neynar portal
- Verify webhook secret matches environment variable
- Check application logs for webhook errors
- Test webhook endpoint directly with curl

### Status Not Updating

- Webhook might be failing silently
- Check webhook URL configuration and network connectivity
- Verify webhook payload structure matches expected format
- Check webhook secret validation

### No Cast Detection

- Ensure cast contains the exact text: "I'm riding @choochoo!"
- Verify user is the current token holder
- Check that FID matches between cast author and current holder
