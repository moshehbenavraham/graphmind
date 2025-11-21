# Debugging Graph Query Failures

**Issue:** The natural language query "Who works at GraphMind?" returns "No results found".
**Date:** 2025-11-21
**Status:** Ongoing

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
1.  **Log Everything:** Add aggressive logging in `QuerySessionManager` and `cypher-generator` to see:
    -   Exact `userId` being used.
    -   Exact `userNamespace` being generated.
    -   Exact Cypher query being generated.
    -   Result of `resolveEntity`.
2.  **Verify User ID:** Check if the logged-in user ID matches the seeded user ID (`cdb473b8...`).
3.  **Inspect Generated Cypher:** The logs in the frontend don't show the generated Cypher. We need server-side logs (via `wrangler tail`) to see what's actually being executed.
