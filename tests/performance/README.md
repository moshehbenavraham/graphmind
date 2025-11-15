# Performance Testing - Answer Generation

This directory contains performance and load testing scripts for Feature 009 (Answer Generation with LLM).

## Tests Included

- **T263**: Load testing with 100 concurrent requests
- **T264**: P95 latency <2s for uncached requests
- **T265**: P95 latency <100ms for cached requests

## Running the Load Test

### Prerequisites

1. **Start local development server**:
   ```bash
   npm run dev
   # Or: npx wrangler dev
   ```

2. **Create test user and get JWT token**:
   ```bash
   # Register test user
   curl -X POST http://localhost:8787/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "testpass123"}'

   # Login to get JWT token
   curl -X POST http://localhost:8787/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "testpass123"}'

   # Copy the JWT token from response
   ```

3. **Populate test data** (optional but recommended):
   - Create several voice notes with entities and relationships
   - Ensures meaningful test results

### Run Load Test

```bash
# Set environment variables
export API_ENDPOINT="http://localhost:8787"
export TEST_JWT_TOKEN="your-jwt-token-here"

# Run load test
node tests/performance/answer-generation-load-test.js
```

## Expected Output

```
🚀 Answer Generation Load Test Starting...

Configuration:
  - Concurrent requests: 100
  - Unique queries: 30
  - Target uncached p95: <2000ms
  - Target cached p95: <100ms

📦 Phase 1: Priming cache...
   ✅ Primed 30 queries

🔥 Phase 2: Load testing with 100 concurrent requests...
   ✅ Completed 100 requests

📊 Performance Report:

Summary:
  - Total Requests: 130
  - Total Errors: 0
  - Error Rate: 0.00%
  - Duration: 45230ms
  - Throughput: 2.87 req/s

Latency (All Requests):
  - P50: 850ms
  - P95: 1850ms
  - P99: 1950ms
  - Avg: 892.15ms
  - Min: 25ms
  - Max: 2100ms

Latency (Uncached Requests - 70 requests):
  - P50: 1450ms
  - P95: 1850ms ✅
  - P99: 1950ms
  - Avg: 1478.23ms

Latency (Cached Requests - 60 requests):
  - P50: 45ms
  - P95: 85ms ✅
  - P99: 95ms
  - Avg: 52.18ms

Cache Hit Rate: 46.15%

🎯 Validation Results:
  - Uncached P95 < 2s: ✅ PASS
  - Cached P95 < 100ms: ✅ PASS

✅ All performance targets met!
```

## Configuration

Edit `answer-generation-load-test.js` to customize:

```javascript
const TEST_CONFIG = {
  concurrency: 100,           // Number of concurrent requests
  uniqueQueries: 30,          // Number of unique queries (affects cache hit rate)
  targetUncachedP95: 2000,    // Target p95 latency for uncached (ms)
  targetCachedP95: 100,       // Target p95 latency for cached (ms)
  apiEndpoint: '...',         // API endpoint URL
  jwtToken: '...'             // Test JWT token
};
```

## Test Queries

The load test includes 30 diverse queries covering:
- **Entity descriptions** ("Who is Sarah?")
- **Relationship queries** ("What projects is Sarah working on?")
- **Temporal queries** ("What did I do yesterday?")
- **Count queries** ("How many projects involve Python?")
- **List queries** ("List all my active projects")
- **Empty results** ("Who is John Doe?")
- **Complex queries** (multi-faceted questions)

## Troubleshooting

### High Error Rate

**Cause**: API endpoint unavailable or authentication failed
**Fix**: Verify `wrangler dev` is running and JWT token is valid

### Uncached P95 > 2s

**Cause**: LLM inference slow or Workers AI service degraded
**Fix**:
- Check Workers AI status
- Optimize prompt length further
- Reduce max_tokens if needed

### Cached P95 > 100ms

**Cause**: KV cache slow or high network latency
**Fix**:
- Verify KV namespace configured correctly
- Check network latency to local dev server
- Use production environment for accurate KV performance

### Low Cache Hit Rate (<30%)

**Cause**: Too many unique queries or cache eviction
**Fix**:
- Increase `uniqueQueries` ratio to `concurrency`
- Check cache TTL (should be 3600s = 1 hour)
- Verify cache invalidation not too aggressive

## Integration with CI/CD

Add to `.github/workflows/performance-test.yml`:

```yaml
name: Performance Test

on:
  push:
    branches: [main]
  pull_request:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Start Wrangler dev server
        run: npx wrangler dev &
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Wait for server
        run: sleep 10

      - name: Run load test
        run: node tests/performance/answer-generation-load-test.js
        env:
          API_ENDPOINT: http://localhost:8787
          TEST_JWT_TOKEN: ${{ secrets.TEST_JWT_TOKEN }}

      - name: Upload results
        uses: actions/upload-artifact@v2
        with:
          name: performance-results
          path: performance-report.json
```

## Next Steps

After load testing passes:
1. Run comprehensive test suite (50+ queries with expected answers)
2. Test prompt with 30+ diverse queries for quality
3. Deploy to production
4. Monitor real-world performance metrics
