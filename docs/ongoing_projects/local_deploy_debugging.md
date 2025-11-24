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

## Update: Additional Attempts (2025-11-24)

### 8. Fixed deploy-local.sh Process Killing

**Problem Identified:** Script was not killing `workerd` processes, causing port conflicts.

**Changes Made (commit f6ff387, efcc627):**
- Added `pkill -9 -f "workerd"` to process kill list
- Added port cleanup using `lsof -ti :8787 | xargs kill -9` for ports 8787, 5173, 3001
- Added port availability check before starting wrangler
- Added verification step to ensure all processes are killed

**Result:** Successfully prevents "Address already in use" errors, but seed data still fails.

### 9. Enforced Fixed Ports

**Problem Identified:** Wrangler was starting on random ports (e.g., 39849 instead of 8787).

**Changes Made (commit f8f1c01):**
- Added `--port 8787` flag to wrangler dev command in deploy-local.sh
- Added `server.port: 5173` and `strictPort: true` to vite.config.js
- REST API already using fixed port 3001

**Result:** Ports now locked correctly, but seed data still fails.

### 10. Simplified Error Handling

**Approach:** Stripped away all complex JSON parsing to get raw error messages.

**Changes Made:**
```javascript
// SIMPLIFIED - Remove complex parsing
let response;
try {
  response = await poolStub.fetch('http://internal/execute-batch', {...});
} catch (fetchError) {
  throw new Error(`FETCH_ERROR: ${fetchError.message}`);
}

if (!response.ok) {
  const errorText = await response.text().catch(e => 'ERROR_READING_BODY');
  throw new Error(`POOL_ERROR_${response.status}: ${errorText}`);
}
```

**Result:** Still shows generic "Internal Server Error" without FETCH_ERROR or POOL_ERROR prefix.

### 11. Added Version Markers

**Approach:** Added version markers to confirm code is running.

**Changes Made:**
```javascript
export async function handleSeedData(request, env) {
  try {
    console.log('[SeedData v2.0] Function entry point - CODE_UPDATED_20251124');
    // ...
  } catch (error) {
    return errorResponse(
      '[CODE_v2.0] Failed to add seed data: ' + error.message,
      'SERVER_ERROR',
      500,
      { trace_id: traceId }
    );
  }
}
```

**Result:** Error message does NOT contain `[CODE_v2.0]` prefix, suggesting either:
- Wrangler not loading updated code despite restarts
- Browser caching old API responses
- Multiple wrangler instances running simultaneously

### 12. Multiple Wrangler Restarts

**Attempts:**
- Killed all wrangler and workerd processes multiple times
- Verified bundle contains updated code (`grep "CODE_v2.0" .wrangler/tmp/*/index.js` returns 1)
- Confirmed wrangler listening on port 8787
- Health endpoint returns 200 OK
- Multiple full deploy-local.sh runs

**Result:** Frontend still receives generic "Internal Server Error" without any custom error markers.

---

## Final Status: UNRESOLVED

### What Was Accomplished

1. **deploy-local.sh improvements:**
   - Fixed process killing (now includes workerd)
   - Added port cleanup (8787, 5173, 3001)
   - Added port availability checks
   - Enforced fixed ports via CLI flags

2. **Error handling improvements:**
   - Added detailed error parsing throughout seed-data.js
   - Added version markers for code verification
   - Simplified error messages to avoid parsing complexity
   - Added extensive console logging

3. **Configuration improvements:**
   - Locked frontend to port 5173 (strictPort)
   - Locked API to port 8787 (--port flag)
   - Ensured single wrangler instance

### What Remains Unknown

**The root cause is still unidentified.** Despite all improvements, the error remains:
```
Failed to add seed data: Failed to add seed data: Internal Server Error
```

**Possible causes:**
1. **Code not loading:** Despite bundle verification, runtime may not be executing updated code
2. **Error occurs before handler:** Error may be thrown at framework level before reaching custom handlers
3. **Browser caching:** Frontend may be caching old error responses
4. **Durable Object issue:** Connection Pool Durable Object may be failing silently
5. **FalkorDB connection issue:** Connection to FalkorDB may be failing without proper error reporting

### Files Modified (Committed)

- `scripts/deploy-local.sh` - Process killing and port enforcement (commits f6ff387, efcc627, f8f1c01)
- `src/frontend/vite.config.js` - Port locking (commit f8f1c01)
- `src/workers/api/seed-data.js` - Simplified error handling (not committed)

---

## Conclusion

After extensive debugging efforts spanning multiple sessions, the "Add Test Data" functionality remains broken with no visibility into the actual error. The issue appears to be a fundamental problem with either:
- Code deployment/loading mechanism
- Durable Object communication
- Error propagation through the Workers runtime
- FalkorDB connection from Workers environment

**Recommendation:** This issue requires a different debugging approach, potentially:
1. Testing seed data functionality in production (not local dev)
2. Using wrangler tail for real-time log streaming
3. Adding logging at the Workers runtime level
4. Testing Connection Pool Durable Object independently
5. Bypassing Durable Object and connecting directly to FalkorDB REST API
