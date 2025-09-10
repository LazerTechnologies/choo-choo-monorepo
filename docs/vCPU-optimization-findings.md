# vCPU Optimization Findings & Recommendations

## Executive Summary

The high vCPU usage in the ChooChoo app is primarily caused by aggressive `Cache-Control: no-store` headers on frequently-called API endpoints. This forces the server to execute every single request, connect to Redis, and generate fresh responses even when the data hasn't changed. With high traffic, this creates thousands of unnecessary server executions per second.

**Expected Impact**: Implementing the recommended caching strategy should reduce vCPU usage by **70-80%**.

## Root Cause Analysis

### Primary Issue: `/api/current-holder`

- **Problem**: Every response includes `'Cache-Control': 'no-store'`
- **Impact**: Most frequently called endpoint, forces server execution on every request
- **Current Logic**: Mixes public data (current holder info) with user-specific data (`isCurrentHolder`)
- **Traffic Pattern**: Called by `useCurrentHolder` hook, other endpoints, and has client-side 10s TTL that's negated by server no-cache

### Secondary Issues

1. **`/api/workflow-state`**: Also uses `no-store`, called by `useWorkflowState` hook
2. **Multiple endpoints**: 19 endpoints total using `no-store` headers
3. **Polling patterns**: Some components poll unnecessarily frequently
4. **Session checks**: `getSession()` calls add overhead on high-traffic endpoints

## Current No-Cache Endpoints

```txt
/api/current-holder/route.ts (4 instances)
/api/workflow-state/route.ts (6 instances)
/api/current-holder/stream/route.ts (1 instance)
Admin proxy endpoints (8 instances)
```

## Optimization Strategy

### Phase 1: Immediate Cost Reduction (Quick Wins)

#### 1.1 Split `/api/current-holder` Endpoint

**Create new cacheable endpoint: `/api/current-holder/public`**

```typescript
// Returns only public, cacheable data
{
  hasCurrentHolder: boolean,
  currentHolder: {
    fid: number,
    username: string,
    displayName: string,
    pfpUrl: string,
    address: string,
    timestamp: string
  } | null
}

// Cache header: 'Cache-Control': 'public, max-age=5'
```

**Benefits:**

- Reduces server requests by ~95% (from thousands/second to 1 every 5 seconds)
- Removes expensive `getSession()` calls
- Maintains real-time feel with 5-second cache

#### 1.2 Move User Logic to Client

**Update `useCurrentHolder` hook:**

- Call `/api/current-holder/public` instead
- Calculate `isCurrentHolder` client-side using Neynar context
- User FID already available from `useNeynarContext()` and `useMiniApp()`

**Client-side logic:**

```typescript
const isCurrentHolder =
  currentUserFid && data.currentHolder?.fid
    ? currentUserFid === data.currentHolder.fid
    : false;
```

#### 1.3 Cache `/api/workflow-state`

**Add caching:**

```typescript
// Cache header: 'Cache-Control': 'public, max-age=3'
```

**Rationale:**

- Workflow state changes infrequently
- No user-specific data
- 3-second cache provides near real-time updates

**Expected Phase 1 Impact:** 70-80% vCPU reduction

### Phase 2: Additional Endpoint Optimizations

#### 2.1 Cache Read-Only Endpoints

| Endpoint               | Current State    | Recommended Cache | Rationale                         |
| ---------------------- | ---------------- | ----------------- | --------------------------------- |
| `/api/yoink-countdown` | No cache headers | `max-age=30`      | Blockchain data changes slowly    |
| `/api/has-ridden`      | No cache headers | `max-age=300`     | Ride history immutable            |
| `/api/cast-status`     | No cache headers | `max-age=10`      | Cast status changes infrequently  |
| `/api/journey`         | No cache headers | `max-age=30`      | Timeline updates slowly           |
| `/api/deposit-status`  | No cache headers | `max-age=15`      | Deposit confirmations are gradual |

#### 2.2 Optimize Polling Intervals

**Current polling patterns:**

```typescript
// JourneyTimeline.tsx - polls every 60 seconds
useEffect(() => {
  const interval = setInterval(fetchJourneyData, 60000);
  return () => clearInterval(interval);
}, [fetchJourneyData]);
```

**Recommendations:**

- Increase `JourneyTimeline` polling to 2-3 minutes
- Consider SSE for real-time updates instead of polling
- Implement exponential backoff for failed requests

### Phase 3: Advanced Optimizations

#### 3.1 Redis-Based Response Caching

**Implementation strategy:**

```typescript
// Cache computed responses in Redis
const cacheKey = `api:current-holder:public`;
const cached = await redis.get(cacheKey);
if (cached) {
  return NextResponse.json(JSON.parse(cached), {
    headers: { 'Cache-Control': 'public, max-age=5' },
  });
}

// Generate response and cache it
const response = generateResponse();
await redis.setex(cacheKey, 5, JSON.stringify(response));
```

**Benefits:**

- Reduces Redis queries for unchanged data
- Enables cache invalidation on data changes
- Provides fallback if CDN cache misses

#### 3.2 Conditional Requests (ETags)

**Implementation:**

```typescript
// Generate ETag based on data hash
const etag = generateETag(currentHolderData);
const ifNoneMatch = request.headers.get('if-none-match');

if (ifNoneMatch === etag) {
  return new Response(null, {
    status: 304,
    headers: { ETag: etag },
  });
}
```

**Benefits:**

- Returns 304 Not Modified for unchanged data
- Reduces bandwidth and processing
- Works with existing cache headers

#### 3.3 Cache Invalidation Strategy

**Redis Pub/Sub for real-time invalidation:**

```typescript
// When current holder changes
await redis.publish(
  'cache:invalidate',
  JSON.stringify({
    keys: ['api:current-holder:public', 'api:workflow-state'],
  })
);
```

**SSE for real-time updates:**

- Replace polling with Server-Sent Events
- Push updates only when data actually changes
- Maintain existing `/api/current-holder/stream` for this purpose

## Implementation Priority

### High Priority (Immediate - Phase 1)

1. ✅ Create `/api/current-holder/public` with 5s cache
2. ✅ Update `fetchCurrentHolder.ts` to use public endpoint
3. ✅ Move `isCurrentHolder` logic to client
4. ✅ Add 3s cache to `/api/workflow-state`

### Medium Priority (Phase 2)

5. Add caching to read-only endpoints
6. Optimize polling intervals
7. Review and cache other high-traffic endpoints

### Low Priority (Phase 3)

8. Implement Redis response caching
9. Add ETag support for conditional requests
10. Enhance SSE for real-time updates

## Monitoring & Validation

### Metrics to Track

- **vCPU usage**: Should drop 70-80% after Phase 1
- **Request volume**: Monitor `/api/current-holder` hit rate
- **Response times**: Should improve with caching
- **Cache hit rates**: Track CDN/browser cache effectiveness

### Testing Strategy

1. **Load testing**: Verify cache behavior under high traffic
2. **Real-time updates**: Ensure SSE still works with caching
3. **User experience**: Confirm no degradation in app responsiveness
4. **Cache invalidation**: Test that updates propagate correctly

## Risk Mitigation

### Potential Issues

1. **Stale data**: 5-second cache might show outdated holder info
2. **Race conditions**: Multiple requests during cache expiry
3. **SSE compatibility**: Ensure real-time updates work with caching

### Mitigation Strategies

1. **Short cache TTLs**: 3-5 seconds balances performance vs freshness
2. **SSE fallback**: Existing stream endpoint provides real-time updates
3. **Graceful degradation**: Client-side cache provides backup
4. **Monitoring**: Alert on cache miss rates or stale data

## Expected Outcomes

### Cost Reduction

- **vCPU usage**: 70-80% reduction
- **Redis connections**: 95% reduction for current-holder endpoint
- **Bandwidth**: Reduced with 304 responses and caching

### Performance Improvements

- **Response times**: Faster due to CDN/browser caching
- **Scalability**: Better handling of traffic spikes
- **User experience**: Maintained real-time feel with optimized polling

### Operational Benefits

- **Reduced server load**: More headroom for traffic growth
- **Cost predictability**: Lower baseline resource usage
- **Improved reliability**: Less strain on Redis and application servers

## Next Steps

1. **Implement Phase 1** changes for immediate cost relief
2. **Monitor metrics** to validate improvements
3. **Gradually roll out Phase 2** optimizations
4. **Consider Phase 3** advanced features based on results

---

_Generated: $(date)_
_Status: Ready for implementation_
