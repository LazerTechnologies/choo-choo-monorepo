# Yoink Timer Notifications

This document explains the yoink timer notification system that alerts users when ChooChoo becomes available for yoinking.

## Overview

The yoink notification system automatically sends notifications to all users when the yoink timer expires, letting them know that ChooChoo can now be yoinked from the current holder.

## Components

### 1. Notification Template

A new notification template `yoinkAvailable` has been added to `/app/src/lib/notifications.ts`:

```typescript
yoinkAvailable: (currentHolderUsername: string) => ({
  title: '⏰ YOINK Time!',
  body: `The yoink timer has expired! ChooChoo can now be yoinked from @${currentHolderUsername}. First come, first served!`,
  targetUrl: `${process.env.NEXT_PUBLIC_URL}/yoink`,
  targetFids: [], // Send to all users
});
```

### 2. Yoink Availability Check API

**Endpoint**: `POST /api/check-yoink-availability`

This internal API endpoint:

- Checks if yoink is currently available using the contract service
- Fetches the current holder information
- Sends notifications if yoink is available and no notification has been sent yet
- Uses Redis to track notification state and prevent spam

**Authentication**: Protected by `INTERNAL_SECRET`

### 3. Scheduler Service

**File**: `/app/src/lib/scheduler.ts`

A simple in-memory scheduler that runs scheduled tasks using `setInterval`. Since Railway doesn't have built-in cron jobs, this runs as part of the Next.js application process.

**Features**:

- Runs yoink availability checks every 5 minutes
- Tracks job status (last run time, errors)
- Automatic initialization on application startup
- Graceful shutdown handling

### 4. Health Check Integration

The scheduler is automatically initialized when the health check endpoint (`/api/health`) is called, ensuring it starts running when the application deploys on Railway.

## How It Works

1. **Application Startup**: The scheduler initializes automatically when the health check is called
2. **Periodic Checks**: Every 5 minutes, the scheduler calls the yoink availability check API
3. **Yoink Detection**: The API checks if yoink is available using the smart contract
4. **Notification Sending**: If yoink is available and no notification has been sent for this availability window, a notification is sent to all users
5. **Spam Prevention**: Redis tracks when notifications are sent to prevent duplicate notifications for the same yoink availability period

## Redis Keys

- `yoink_notification_sent`: Tracks whether a notification has been sent for the current yoink availability window
  - Set to `'true'` when notification is sent
  - Expires automatically after yoink timer + 1 hour buffer
  - Cleared when yoink becomes unavailable again

## API Endpoints

### Admin/Testing Endpoints

- `POST /api/admin/trigger-yoink-check`: Manually trigger a yoink availability check (admin only)
- `GET /api/scheduler-status`: Check the status of all scheduled jobs (internal)
- `POST /api/init-scheduler`: Initialize the scheduler (internal)

## Deployment Notes

### Railway Compatibility

Since Railway doesn't have built-in cron jobs like Vercel, this system uses:

- In-memory scheduling with `setInterval`
- Automatic initialization via health checks
- Single process architecture (no separate worker processes needed)

### Environment Variables

No additional environment variables are required. The system uses existing variables:

- `INTERNAL_SECRET`: For API authentication
- `NEXT_PUBLIC_URL`: For notification target URLs

## Testing

Run the test suite to verify the notification system:

```bash
npm test -- test/lib/yoink-notifications.test.ts
```

The tests cover:

- Scheduler initialization and shutdown
- Job status tracking
- API response handling
- Notification template validation

## Monitoring

Monitor the system using:

1. **Health Check**: `GET /api/health` shows scheduler status
2. **Scheduler Status**: `GET /api/scheduler-status` (with auth) shows detailed job status
3. **Application Logs**: Check Railway logs for scheduler activity

## Troubleshooting

### Notifications Not Sending

1. Check if scheduler is running: `GET /api/health`
2. Verify yoink is actually available: Check contract state
3. Check Redis for notification tracking key
4. Review application logs for errors

### Duplicate Notifications

The system should prevent duplicates, but if they occur:

1. Check Redis key expiration
2. Verify notification tracking logic
3. Check for multiple application instances

### Scheduler Not Starting

1. Ensure health check endpoint is being called
2. Check for JavaScript errors in logs
3. Verify environment variables are set
4. Try manual initialization: `POST /api/init-scheduler`
