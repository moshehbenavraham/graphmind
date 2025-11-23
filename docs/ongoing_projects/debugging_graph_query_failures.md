# Debugging Graph Query Failures

**Issue:** The natural language query "Who works at GraphMind?" returns "No results found".
**Date:** 2025-11-21
**Status:** 🔴 ONGOING (Last Updated: 2025-11-23 21:55 UTC)

## Symptoms
- Frontend displays "No results found".
- Response metadata:
  - `template_used`: "relationship_query"
  - `entity_count`: 0 (in response results)
  - `message`: "No results found"
- Logs show successful WebSocket connection and audio processing.

## Investigation History

### Attempt 1: Data Verification
- **Hypothesis:** The "GraphMind" project or "WORKS_ON" relationships were missing from the database.
- **Action:** Created `debug_graphs.js` to inspect FalkorDB content.
- **Result:** Confirmed that `GraphMind` (Project) and `Bob Smith` (Person) with `WORKS_ON` relationship exist in the graph `user_cdb473b8-c8ab-4904-aabf-61f3922e5016_graph`.
- **Conclusion:** Data exists. The issue is in query generation or execution.

### Attempt 2: Entity Resolution Context
- **Hypothesis:** `generateCypherQuery` was using `userNamespace` (e.g., `user_..._graph`) instead of `userId` (UUID) when calling `resolveEntity`. This caused the lookup in `entity_cache` (which uses UUID) to fail, defaulting "GraphMind" to type `Person`.
- **Action:**
    - Updated `generateCypherQuery` signature to accept `userId`.
    - Updated `QuerySessionManager.js` to pass `userId`.
    - Updated helper functions in `cypher-generator.js` to propagate `userId`.
- **Result:** Failed.

### Attempt 3: UserId Formatting & Namespace Generation
- **Hypothesis:**
    1.  `userId` format mismatch: The UUID in `entity_cache` might have dashes, while the one passed from the session might not (or vice versa).
    2.  Namespace mismatch: `QuerySessionManager` had a local `getUserNamespace` function that replaced dashes with underscores, while the canonical `generateGraphName` (and the actual graph) uses dashes.
- **Action:**
    - Updated `resolveEntity` in `cypher-generator.js` to normalize `userId` (remove dashes) before comparison in SQL.
    - Updated `QuerySessionManager.js` to use the canonical `generateGraphName` from `src/lib/falkordb/namespace.js`.
- **Result:** Failed (per user report).

## Current Analysis
The query is still failing despite fixing the entity resolution and namespace generation.

**Potential Causes:**
1.  **Graph Name Mismatch:** Even with `generateGraphName`, is it generating the *exact* same name as the one where data resides?
    -   Data is in: `user_cdb473b8-c8ab-4904-aabf-61f3922e5016_graph`
    -   We need to verify what `generateGraphName(userId)` produces for the current user.
2.  **Cypher Query Logic:** The generated Cypher might be syntactically correct but logically wrong for the data structure.
    -   Expected: `MATCH (target:Person)-[r:WORKS_ON]->(source:Project {name: 'GraphMind'}) ...`
    -   If `resolveEntity` *still* fails, it generates: `MATCH (target:Person)-[r:WORKS_ON]->(source:Person {name: 'GraphMind'}) ...` -> Returns 0 results.
3.  **Entity Cache Empty/Stale:** If the `entity_cache` in D1 is empty or doesn't contain "GraphMind" for *this specific user*, resolution will fail.
    -   We verified D1 has data, but is it for the *same user ID* that is currently logged in?
4.  **Token/Auth Issue:** Is the `userId` extracted from the token the same as the one used for seeding?

## Next Steps

### ✅ COMPLETED: Comprehensive Logging Implementation (2025-11-23)

Added comprehensive debug logging across the entire query pipeline to diagnose the issue:

**Files Modified:**
- `src/durable-objects/QuerySessionManager.js`: WebSocket connection, query generation, query execution
- `src/services/cypher-generator.js`: Cypher generation and entity resolution
- `src/durable-objects/FalkorDBConnectionPool.js`: Query execution and namespace management
- `src/lib/falkordb/namespace.js`: Graph name generation

**Logging Coverage:**
1. ✅ **userId Flow Tracking:**
   - Extracted userId from WebSocket URL params
   - userId format validation (length, dashes)
   - userId propagation through all layers

2. ✅ **Namespace Generation:**
   - Input userId to `generateGraphName`
   - UUID validation process
   - Generated graphName output
   - Namespace cache lookups

3. ✅ **Entity Resolution:**
   - Input entity name ("GraphMind")
   - D1 query SQL and parameters
   - D1 query results (all candidates)
   - Fuzzy matching scores
   - Final resolved entity (name, type, id)

4. ✅ **Cypher Query Generation:**
   - Selected template
   - Extracted entities
   - Generated Cypher query
   - Query parameters

5. ✅ **Query Execution:**
   - Exact Cypher sent to FalkorDB
   - Graph name used
   - Query results (count, preview, statistics)

**How to Use:**
1. Run `npx wrangler dev` to start local development server
2. Execute the query "Who works at GraphMind?" via the frontend
3. Run `npx wrangler tail` in another terminal to see real-time logs
4. Analyze logs to identify where the issue occurs

**Expected Findings:**
- Verify userId matches seeded user: `cdb473b8-c8ab-4904-aabf-61f3922e5016`
- Verify graphName matches: `user_cdb473b8-c8ab-4904-aabf-61f3922e5016_graph`
- Verify "GraphMind" resolves to type `Project` (NOT `Person`)
- Verify generated Cypher uses correct entity type

### Attempt 4: ❌ FAILED - Updated_at Column Fix (2025-11-23)

**Hypothesis:** Session crash after successful query execution due to non-existent `updated_at` column

**Initial Analysis:**
Previous debugging doc claimed the query pipeline was working perfectly and that removing `updated_at` from the UPDATE statement would fix the issue.

**Action Taken:**
1. Removed `updated_at = CURRENT_TIMESTAMP` from `src/lib/db/voice-queries.js` (line 27)
2. Committed fix: `a54c840`
3. Deployed: Version `345d19d6-3441-4b5f-9596-5b396bc40ac0`

**Result:** ❌ STILL FAILING

Query "Who works on GraphMind?" still returns 0 results with same symptoms:
```json
{
  "entities": [],
  "relationships": [],
  "metadata": {
    "execution_time_ms": 193,
    "entity_count": 0,
    "relationship_count": 0,
    "cached": false,
    "template_used": "relationship_query"
  }
}
```

**Critical Discovery:**
- `voice_queries` table in D1 is **COMPLETELY EMPTY** (0 rows)
- Queries are NOT being saved to D1 at all
- This means the crash is happening BEFORE the INSERT, not during the UPDATE
- The previous "resolution" was incorrect

**Data Verification:**
✅ **entity_cache table** (11 entities for user `cdb473b8-c8ab-4904-aabf-61f3922e5016`):
- Alice Johnson (Person)
- Bob Smith (Person)
- Carol White (Person)
- Cloudflare Workers (Technology)
- FalkorDB (Technology)
- **GraphMind (Project)** ← Correct type!
- Knowledge Graph (Topic)
- Mobile App (Project)
- React (Technology)
- User Interface (Topic)
- Voice AI (Topic)

**Conclusion:**
The `updated_at` fix was necessary but NOT sufficient. The real bug is earlier in the execution pipeline, causing queries to crash before they're even saved to D1.

### Attempt 5: 🔄 IN PROGRESS - Persistent Logging System (2025-11-23)

**Problem:**
- Cloudflare `wrangler tail` logs are ephemeral and disappear after execution
- Cannot debug production issues without real-time monitoring
- No historical log data to review crashes

**Solution:**
Built persistent logging system that saves all logs to D1:

**Files Created/Modified:**
1. `migrations/0006_debug_logs.sql`: New `debug_logs` table in D1
   - Stores: timestamp, level, component, message, metadata (JSON)
   - Indexes: timestamp, level, component, user_id, session_id, query_id

2. `src/lib/logger.js`: New persistent logger utility (duplicate, needs consolidation)

3. `src/utils/logger.js`: Updated existing Logger class
   - Added D1 persistence via `_saveToD1()` method
   - Fire-and-forget async logging (never blocks app)
   - Backward compatible with existing code

4. `src/durable-objects/QuerySessionManager.js`: Pass `env` to logger

**Deployed:**
- Commit: `c7fc62a`
- Version: `346af1d5-1369-4245-91d4-123da3cc584f`
- Migration applied to production D1

**How to Use:**
```bash
# Query logs from D1 (replace with actual query filters)
npx wrangler d1 execute graphmind-db --remote --command "
  SELECT timestamp, level, component, message,
         SUBSTR(CAST(metadata AS TEXT), 1, 200) as metadata_preview
  FROM debug_logs
  WHERE session_id = 'sess_xxx' OR query_id = 'query_xxx'
  ORDER BY timestamp DESC
  LIMIT 100;
"
```

**Status:** ✅ Deployed, awaiting test query execution

### Next Steps

**Immediate Actions:**
1. ✅ Run query "Who works on GraphMind?" in production frontend
2. ✅ Query `debug_logs` table in D1 to see full execution trace
3. 🔄 Identify exact crash point and error message
4. 🔄 Fix the real bug
5. 🔄 Test and verify fix works

**Expected Debug Log Coverage:**
- WebSocket connection (userId extraction, namespace generation)
- Entity resolution (D1 query, fuzzy matching, resolved type)
- Cypher generation (template selection, query construction)
- FalkorDB execution (query sent, results received)
- Result formatting and delivery
- **Error point** (where the crash actually happens)

### Attempt 6: ✅ FIXED - LLM-Generated Cypher Parameter Bug (2025-11-24)

**Root Cause Identified:**
- D1 logs revealed FalkorDB error: "Missing parameters"
- LLM was generating: `MATCH (p:Person {name: $param})` with empty `parameters: {}`
- Template queries worked fine (e.g., `relationship_query` with `{"source_name": "GraphMind"}`)

**Bug Location:**
- `src/services/cypher-generator.js:417` - `callLLMModel()` always returns `parameters: {}`
- Lines 450-452: LLM prompt instructs to use `$param` syntax but code doesn't extract values

**Fix Applied:**
1. Modified LLM prompt (lines 450-452):
   - Changed: "Use parameterized queries with $param syntax when possible"
   - To: "Use LITERAL values in queries (NOT $param placeholders)"
2. Updated example queries to remove trailing semicolons (LLM was inconsistent)
3. Deployed: Version `6bcf9e30-a8ff-47c5-9bc6-5032598de1c0`

**Why This Works:**
- `cypher-validator.js` already sanitizes literal values
- Simpler than extracting parameters from LLM-generated Cypher
- Consistent with how template queries work (they build literals inline)

**Files Modified:**
- `src/services/cypher-generator.js` (lines 445-475)

**Expected Result:**
- LLM will now generate: `MATCH (p:Person {name: 'GraphMind'})`
- No parameter placeholder mismatch
- FalkorDB will execute successfully

### Outstanding Questions

1. **Why is `voice_queries` table empty?**
   - Is the INSERT query failing silently?
   - Is there a crash before the INSERT even runs?

2. **Does TTS synthesis still fail?**
   - Previous logs showed "TTS synthesis failed" after successful query
   - Need to verify if this is a separate bug

3. **Is entity resolution working correctly?**
   - entity_cache has correct data (GraphMind = Project)
   - But are LLM-generated queries using correct entity types?
