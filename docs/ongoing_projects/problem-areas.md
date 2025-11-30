# GraphMind Problem Areas

## Session: 2025-11-30 - Critical Bugfix Session

### Status: RESOLVED

All critical issues from Feature 012 (Security Hardening) integration have been fixed.

### Issues Fixed

1. **FalkorDB REST API Authentication (15+ files)**
   - Missing `apiKey: env.FALKORDB_REST_API_KEY` in config objects
   - Error: "PING failed: Health check failed: Unauthorized"
   - Fixed in: graph-rag.js, search-entities.js, get-graph.js, get-stats.js, all CRUD endpoints

2. **Seed Data Missing user_id (`src/workers/api/seed-data.js`)**
   - Nodes created without `user_id` property
   - Search queries filtered by user_id returned empty
   - Fixed: Added `user_id: $user_id` to all CREATE statements

3. **Response Parser Format Mismatch (3 files)**
   - Code assumed array format `[node, types]` but REST API returns object `{n, types}`
   - Fixed in: search-entities.js, get-graph.js, get-stats.js
   - Added dual format handling for both array and object responses

4. **Stats FalkorDB String Parsing (`src/api/graph/get-stats.js`)**
   - FalkorDB returns complex types as strings: `"[{type: Task, count: 3}]"`
   - Added `parseFalkorDBArray()` helper to convert to proper JSON

5. **CSS Duplicate Key (`src/frontend/design-system/voice/BrutalWaveform.jsx`)**
   - Duplicate `imageRendering` property in JSX style object
   - Fixed: Removed duplicate, kept `crisp-edges`

### Validation Results

All endpoints tested and working:
- Health check: OK
- Entity search: Returns correct user_id filtered results
- Graph stats: Proper entity_breakdown object and most_connected array
- Get graph: Returns nodes without errors
- FalkorDB health: Pool healthy with 6 connections

---

## Session: 2025-11-30 - Feature 015 Entity Role Bug Fix (PREVIOUS)

### Problem 1: Voice Query Returns "I don't have any information" - RESOLVED

**Root Causes Found & Fixed:**
1. Falsy value bug in result-formatter.js (node ID 0 treated as false)
2. REST API format mismatch (src_node/dest_node vs src/dst)
3. Stale KV cache serving old wrong answers

### Problem 2: TTS Synthesis Failure - STILL OPEN

**Status:** Not fully investigated - appears to be Workers AI TTS service issue.
**Location:** Likely in `src/durable-objects/query-session-manager.js`
