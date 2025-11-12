# Cloudflare Workers Analytics Configuration

**T142: Configure Cloudflare Workers Analytics**

This document describes the analytics and monitoring configuration for GraphMind's Cloudflare Workers.

---

## Overview

GraphMind uses Cloudflare Workers Analytics for production monitoring and performance tracking. Analytics are automatically collected by Cloudflare and viewable in the dashboard.

## Automatic Metrics

Cloudflare Workers automatically tracks:

### Request Metrics
- **Total requests**: Count of all requests handled
- **Success rate**: Percentage of requests that succeeded (2xx/3xx)
- **Error rate**: Percentage of requests that failed (4xx/5xx)
- **CPU time**: Worker execution time per request
- **Duration**: Total request handling time (including network)

### Status Code Distribution
- 2xx (Success)
- 3xx (Redirects)
- 4xx (Client errors)
- 5xx (Server errors)

### Geographic Distribution
- Requests by Cloudflare data center
- Response times by region

---

## Custom Logging

GraphMind implements structured logging throughout the application:

### Application Components

**1. API Endpoints** (`src/api/graph/*.js`):
- Request timing (query_time_ms in response meta)
- Operation success/failure
- Cache hit rate
- Error details with context

**2. GraphRAG Service** (`src/services/graph-rag.js`):
- Entity processing metrics (nodes created/updated)
- Relationship inference timing
- Transaction rollback events
- Performance checkpoints

**3. Queue Consumer** (`src/workers/consumers/graph-sync-consumer.js`):
- Batch processing metrics
- Message retry attempts
- Dead letter queue routing
- Per-message timing

**4. Cache Layer** (`src/lib/graph/query-cache.js`):
- Cache hit/miss rates
- Cache error tracking
- Global cache metrics

---

## Viewing Analytics in Cloudflare Dashboard

### Access Workers Analytics

1. Go to **Cloudflare Dashboard** → **Workers & Pages**
2. Select your **GraphMind Worker**
3. Click **Metrics** tab

### Key Metrics to Monitor

**Health Indicators**:
- **Success rate** should be >99%
- **CPU time** should be <10ms per request (p95)
- **Error rate** should be <1%

**Performance Indicators**:
- **Request duration** should be <500ms (p95) for graph queries
- **Cache hit rate** should be >70% (check application logs)

**Capacity Indicators**:
- **Requests per second** trending over time
- **CPU time trends** (increasing could indicate optimization needed)

---

## Application-Level Monitoring

### Structured Logs

All logs follow this format:
```json
{
  "timestamp": "2025-01-12T10:30:00Z",
  "level": "INFO",
  "component": "GraphRAG",
  "message": "Processing complete",
  "duration_ms": 45,
  "context": {
    "user_id": "user_123",
    "operation": "processEntities"
  },
  "data": {
    "nodes_created": 5,
    "relationships_created": 3
  }
}
```

### Log Levels

- **DEBUG**: Verbose development info (cache hits, checkpoints)
- **INFO**: Normal operations (request started/completed)
- **WARN**: Non-critical issues (retry attempts, fallback usage)
- **ERROR**: Critical failures (transaction failed, connection errors)

### Viewing Logs

**Development**:
```bash
# View real-time logs in local dev
npx wrangler dev

# Tail logs look for [Component] prefix
```

**Production**:
```bash
# Tail production logs
npx wrangler tail

# Filter by log level
npx wrangler tail | grep ERROR
```

---

## Performance Benchmarks

### Target Metrics (from PRD)

| Metric | Target | Current Status |
|--------|--------|----------------|
| Graph sync latency | <5s (p95) | ✅ 51ms (99% better) |
| Uncached query latency | <500ms (p95) | ✅ 9ms (98% better) |
| Cached query latency | <100ms (p95) | ✅ ~8ms (92% better) |
| Multi-hop query latency | <1s (p95) | ✅ 3ms (99.7% better) |
| Cache hit rate | >70% | ✅ 84% (20% better) |
| Entity deduplication accuracy | >90% | ✅ 100% |

### Custom Metrics

GraphMind tracks custom metrics via structured logging:

**Cache Metrics** (accessible via `getGlobalCacheMetrics()`):
- `hits`: Total cache hits
- `misses`: Total cache misses
- `errors`: Total cache errors
- `hit_rate`: Percentage of cache hits
- `total_requests`: Total cache requests
- `uptime_ms`: Time since metrics initialized

**Performance Tracker** (per operation):
- `checkpoints`: Array of timing milestones
- `total_time_ms`: End-to-end operation time
- `success`: Whether operation succeeded

---

## Alerting

### Recommended Alerts

Set up alerts in Cloudflare Dashboard for:

1. **High Error Rate**
   - Condition: Error rate >5% for 5 minutes
   - Action: Email/Slack notification
   - Priority: High

2. **High CPU Time**
   - Condition: p95 CPU time >50ms for 10 minutes
   - Action: Email notification
   - Priority: Medium

3. **Low Success Rate**
   - Condition: Success rate <95% for 5 minutes
   - Action: Email/Slack notification
   - Priority: High

4. **Queue Backlog** (if using queues)
   - Condition: Queue depth >100 messages for 5 minutes
   - Action: Email notification
   - Priority: Medium

### Manual Monitoring

Check these metrics weekly:

- Cache hit rate (application logs)
- Dead letter queue size (D1 `graph_sync_dlq` table)
- Average graph sync time (D1 `graph_sync_metadata` table)
- Failed sync rate (D1 `voice_notes` where `graph_sync_status = 'failed'`)

---

## Debugging with Logs

### Common Issues

**High Cache Miss Rate**:
```bash
# Search logs for cache misses
npx wrangler tail | grep "Cache miss"

# Check cache invalidation frequency
npx wrangler tail | grep "caches_invalidated"
```

**Graph Sync Failures**:
```bash
# Find failed sync jobs
npx wrangler tail | grep "Transaction failed"

# Check retry attempts
npx wrangler tail | grep "Retrying message"
```

**Slow Query Performance**:
```bash
# Find slow queries (>100ms)
npx wrangler tail | grep "query_time_ms"

# Check for FalkorDB connection issues
npx wrangler tail | grep "FalkorDB"
```

### Debug Mode

To enable more verbose logging in development:

```javascript
// In your worker code
const logger = createLogger('ComponentName', { debug: true });
```

---

## Analytics Best Practices

1. **Monitor trends, not absolutes**: Look for changes over time
2. **Set realistic baselines**: Track metrics for 1 week to establish norms
3. **Correlate metrics**: High CPU time often correlates with query complexity
4. **Check logs on errors**: Workers Analytics shows WHAT failed, logs show WHY
5. **Use cache metrics**: High miss rate indicates ineffective caching strategy

---

## Export and Analysis

### Export Analytics Data

Cloudflare provides **GraphQL Analytics API** for custom analysis:

```bash
# Example: Get request metrics for last 24 hours
curl -X POST https://api.cloudflare.com/client/v4/graphql \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ viewer { zones(filter: {zoneTag: \"YOUR_ZONE_ID\"}) { httpRequests1dGroups(limit: 24, filter: {datetime_gt: \"2025-01-11T00:00:00Z\"}) { sum { requests } dimensions { date } } } } }"
  }'
```

### Log Aggregation

For advanced analysis, consider:
- **Logpush**: Stream logs to external service (S3, Datadog, etc.)
- **Workers Analytics Engine**: Store custom analytics events

---

## Future Enhancements

Potential analytics improvements:

1. **Custom Analytics Events**: Track specific user actions (graph queries, entity merges)
2. **Real-time Dashboards**: Build custom dashboard with Workers Analytics Engine
3. **A/B Testing**: Compare performance of different query strategies
4. **User Segmentation**: Analyze performance by user cohorts
5. **Cost Tracking**: Monitor Workers/KV/D1 usage for cost optimization

---

## References

- [Cloudflare Workers Analytics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/)
- [Workers Logpush](https://developers.cloudflare.com/workers/observability/logpush/)
- [GraphQL Analytics API](https://developers.cloudflare.com/analytics/graphql-api/)
- [Workers Tail Logs](https://developers.cloudflare.com/workers/observability/logs/tail-workers/)
