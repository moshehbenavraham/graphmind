# Debugging Graph Query Failures

**Issue:** The natural language query "Who works at GraphMind?" returns "No results found".
**Date:** 2025-11-21
**Status:** ✅ RESOLVED (2025-11-23)

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

### ✅ RESOLUTION (2025-11-23)

**Root Cause:** Session crash after successful query execution due to non-existent `updated_at` column

**What Actually Happened:**
The comprehensive logging revealed the truth - the query pipeline was working perfectly:
1. ✅ Entity resolution resolved "GraphMind" to type `Project`
2. ✅ Cypher query was generated correctly
3. ✅ FalkorDB returned 2 results (Bob Smith and Carol White)

**The Real Bug:**
After successfully executing the query and receiving results from FalkorDB, the code crashed when trying to save the answer to D1:

```javascript
// BROKEN CODE in src/lib/db/voice-queries.js
UPDATE voice_queries
SET answer = ?,
    sources = ?,
    latency_ms = ?,
    updated_at = CURRENT_TIMESTAMP  // ❌ Column doesn't exist!
WHERE query_id = ? AND user_id = ?
```

**Database Schema Reality:**
- Table `voice_queries` has columns: `query_id`, `user_id`, `question`, `answer`, `created_at`, etc.
- **NO `updated_at` column exists**

**Impact:**
- Query executed successfully and FalkorDB returned 2 rows
- Session crashed with error: `D1_ERROR: no such column: updated_at: SQLITE_ERROR`
- Crash occurred BEFORE results were sent to frontend via WebSocket
- Frontend received empty results and displayed "No results found"

**Production Logs Evidence:**
```
[FalkorDB] Query executed { results: 2 }
"raw_results_preview":[
  {"target":{"name":"Bob Smith","role":"CTO"}},
  {"target":{"name":"Carol White","role":"Designer"}}
]
(error) Failed to update query answer: D1_ERROR: no such column: updated_at
(log) Session cleaned up (crashed before sending results)
```

**The Fix:**
```javascript
// FIXED CODE in src/lib/db/voice-queries.js
UPDATE voice_queries
SET answer = ?,
    sources = ?,
    latency_ms = ?
WHERE query_id = ? AND user_id = ?
```

**Deployed Versions:**
1. Version 6d8cb77c-0e24-4ae9-9d91-86104ae404b7: Fixed `entity_id` bug in cypher-generator.js (red herring)
2. Version 47fd7538-91eb-4963-a2fc-50967d492642: Fixed actual bug - removed `updated_at` from voice-queries.js ✅

**Verification:**
Query "Who works on GraphMind?" now returns:
- Bob Smith (CTO)
- Carol White (Designer)

**Lessons Learned:**
- Comprehensive logging was essential to find the real bug
- The issue appeared to be in query generation but was actually in result delivery
- Silent SQL errors can cause misleading symptoms
- Always verify database schema matches code expectations
