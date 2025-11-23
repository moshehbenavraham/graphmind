# Local Deploy Debugging - Add Test Data Failure

**Date:** 2025-11-24
**Status:** ❌ UNRESOLVED
**Issue:** "Add Test Data" button fails with generic "Internal Server Error" after running `deploy-local.sh`

---

## Problem Summary

After running `scripts/deploy-local.sh` to set up the local development environment, clicking the "Add Test Data" button in the frontend fails with:

```
Failed to add seed data: Failed to add seed data: Internal Server Error
```

The error message is duplicated and generic, providing no useful debugging information about the actual failure.

---

## Investigation Steps Taken

### 1. Code Flow Analysis

Traced the complete flow from button click to database:

1. **Frontend Button** (`src/frontend/pages/DashboardPage.jsx:178-187`)
   - Calls `handleSeedData()` on line 18-44
   - Makes POST request to `/api/seed-data` with 20-second timeout

2. **API Client** (`src/frontend/utils/api.js:195-233`)
   - POST to `/api/seed-data`
   - Includes JWT auth token
   - Has error handling that displays returned error message

3. **Route Handler** (`src/index.js:228-234`)
   - Routes to `handleSeedData()` worker

4. **Seed Data Handler** (`src/workers/api/seed-data.js`)
   - Line 310-333: Authenticates user via JWT
   - Line 336-344: Checks for existing data
   - Line 347-348: Calls `addSeedData(env, userId)`
   - Line 213-225: Executes batch operations via Durable Object

5. **Connection Pool** (`src/durable-objects/FalkorDBConnectionPool.js`)
   - Line 222-272: `/execute-batch` handler
   - Line 646-698: `executeBatchGraphUpdate()` executes 3 Cypher queries sequentially

### 2. Root Cause Analysis

**Primary Issue:** Poor error handling in `seed-data.js` was swallowing actual error details.

**Original Bug (Line 227-229):**
```javascript
if (!response.ok) {
  throw new Error(`Failed to add seed data: ${response.statusText}`);
}
```

This only used `response.statusText` (generic "Internal Server Error") instead of parsing the actual error from the Connection Pool's JSON response body.

**Secondary Issue:** Response body consumption bug
- When trying to parse errors, first attempted `response.json()`
- If that failed, tried `response.text()` - but body was already consumed
- This caused all error parsing to fail silently

### 3. Environment Details

**FalkorDB Configuration:**
- deploy-local.sh connects to `falkordb-tunnel.aiwithapex.com:443` (HTTPS)
- NOT using localhost:6380 as expected
- Connection pool shows successful connections via REST API
- Logs show: "Connected successfully via REST API"

**Services Status:**
- ✅ FalkorDB Docker container running on port 6380
- ✅ REST API wrapper running on port 3001
- ✅ Wrangler dev server running on port 8787
- ✅ Frontend Vite server running on port 5173
- ✅ Connection pool created 5 connections successfully

**Log Files:**
- `/tmp/wrangler-dev.log` - Basic startup info only
- `/tmp/wrangler-logs.txt` - Contains connection pool logs
- `/home/aiwithapex/.config/.wrangler/logs/wrangler-2025-11-23_22-44-03_269.log` - Current session

---

## Changes Made

### Error Handling Improvements in `src/workers/api/seed-data.js`

#### 1. Fixed batch execute error handling (Lines 241-263)

**Before:**
```javascript
if (!response.ok) {
  throw new Error(`Failed to add seed data: ${response.statusText}`);
}
```

**After:**
```javascript
if (!response.ok) {
  let errorMessage = response.statusText;
  try {
    // Get response as text first to avoid body consumption issues
    const errorText = await response.text();
    console.error('[SeedData] Batch execute error response:', errorText);

    // Try to parse as JSON
    try {
      const errorBody = JSON.parse(errorText);
      errorMessage = errorBody?.error || errorBody?.originalMessage || errorBody?.message || errorText || response.statusText;
      console.error('[SeedData] Parsed error body:', errorBody);
    } catch (jsonError) {
      // Not JSON, use raw text
      errorMessage = errorText || response.statusText;
      console.error('[SeedData] Error response is not JSON, using raw text');
    }
  } catch (textError) {
    console.error('[SeedData] Failed to read error response:', textError.message);
  }
  throw new Error(`Failed to add seed data: ${errorMessage}`);
}
```

#### 2. Fixed count query error handling (Lines 277-299)

Applied same pattern to the node count query error handling.

#### 3. Fixed check existing data error handling (Lines 95-123)

Applied same pattern to the initial data check query.

### Key Improvements

1. **Read response as text first** - Avoids body consumption issues
2. **Parse text as JSON** - Extract structured error details
3. **Fallback to raw text** - If not JSON, use the text directly
4. **Extensive logging** - `console.error()` at each step for debugging
5. **Multiple error field checks** - Try `error`, `originalMessage`, `message` fields

---

## Current Status: Still Failing

After all improvements, the error message remains:
```
Failed to add seed data: Failed to add seed data: Internal Server Error
```

### Why This Is Still Happening

**Theory 1: Wrangler not reloading**
- Changes were made after deploy-local.sh started wrangler
- Hot reload may not be working properly
- Console.error logs aren't appearing in wrangler logs

**Theory 2: Error before reaching error handlers**
- Error might be thrown during fetch itself (network level)
- Durable Object binding issue
- Connection timeout before response

**Theory 3: Console logs not visible**
- Wrangler logs go to `~/.config/.wrangler/logs/` directory
- Debug logs might be filtered out
- Need to check live logs, not just static log files

---

## What We Know

### ✅ Confirmed Working
- FalkorDB Docker container is running
- REST API wrapper is responding
- Connection pool successfully creates 5 connections
- Wrangler dev server is responding to requests
- Frontend can communicate with backend
- JWT authentication is working (no 401 errors)

### ❌ Unknown/Failing
- What the actual error is from Connection Pool
- Why error response isn't being parsed
- Whether Cypher queries are malformed
- Whether FalkorDB is actually accessible from Workers
- Why console.error logs don't appear in standard wrangler logs

---

## Next Steps to Debug

### 1. Verify Code Reload
```bash
# Restart wrangler to force reload
pkill -f "wrangler dev"
cd /home/aiwithapex/projects/graphmind
npx wrangler dev
```

### 2. Check Live Logs
```bash
# Watch wrangler logs in real-time
tail -f ~/.config/.wrangler/logs/wrangler-*.log | grep -i "seed\|error"

# Or use wrangler tail
npx wrangler tail
```

### 3. Test Connection Pool Directly
```bash
# Test if connection pool is accessible
curl -X POST http://localhost:8787/api/test/init-pool \
  -H "Content-Type: application/json"
```

### 4. Test FalkorDB Connection
```bash
# Test if FalkorDB is accessible via REST API
curl http://localhost:3001/health

# Test direct connection
docker exec falkordb-local redis-cli PING
```

### 5. Add More Logging

Add logging BEFORE the fetch call in `seed-data.js`:

```javascript
console.log('[SeedData] About to call execute-batch with config:', {
  host: config.host,
  port: config.port,
  operationCount: 3
});

const response = await poolStub.fetch('http://internal/execute-batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    config,
    userId,
    operations: [
      { cypher: query1, params: {} },
      { cypher: query2, params: {} },
      { cypher: query3, params: {} }
    ]
  })
});

console.log('[SeedData] Got response:', {
  ok: response.ok,
  status: response.status,
  statusText: response.statusText
});
```

### 6. Test with Simpler Query

Replace the seed data queries with a simple test:

```javascript
operations: [
  { cypher: 'RETURN 1 as test', params: {} }
]
```

If this works, the issue is with the Cypher queries themselves.

### 7. Check D1 Debug Logs

If persistent logging is enabled:

```bash
npx wrangler d1 execute graphmind-db --local --command "
  SELECT timestamp, level, component, message
  FROM debug_logs
  WHERE component LIKE '%Seed%' OR component LIKE '%ConnectionPool%'
  ORDER BY timestamp DESC
  LIMIT 50;
"
```

---

## Related Files Modified

- `src/workers/api/seed-data.js` - Improved error handling (3 locations)
- Lines changed: 95-123, 241-263, 277-299

---

## Notes

- The error message "Failed to add seed data: Failed to add seed data:" shows the error is being thrown twice (once by my error handler, once wrapped by the outer handler)
- Wrangler hot reload appears to be working (saw reload events in logs)
- Connection pool successfully connects to FalkorDB tunnel at startup
- No console.error output visible in logs suggests either:
  - Code didn't reload
  - Error happens before reaching our error handlers
  - Logs are being filtered/redirected

---

## Conclusion

Despite extensive error handling improvements, the root cause remains unknown due to lack of visibility into the actual error. The error is being caught and re-thrown, but the underlying issue from the Connection Pool is not surfacing.

**Recommendation:** Restart wrangler completely and watch live logs while clicking the button to see the actual error output.
