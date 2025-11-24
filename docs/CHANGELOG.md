# GraphMind Documentation Changelog

All notable changes to the GraphMind documentation will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Previous Changelogs: `docs/previous_changelogs/`

---
Begin Changelog Entries Here - We do not use "unreleased" so all entries should have a version
---

## [1.11.13] - 2025-11-24

### Changed
- **Deployment Automation**
  - Updated `scripts/deploy-local.sh` to auto-confirm database migrations using `yes | ...`.
  - Prevents deployment from hanging on "continue?" prompts.

### Fixed
- **FalkorDB Client** (`src/lib/falkordb/rest-client.js`)
  - Fixed URL construction bug where port was dropped if protocol was present.
  - Improved handling of `http://` vs `https://` prefixes.

### Known Issues
- **Local Connection Failure**
  - "Add Test Data" continues to fail with `PING failed: Network connection lost`.
  - Connection between Worker and local REST API remains unstable in some environments.

## [1.11.12] - 2025-11-24

### Fixed

- **Local Development Environment Configuration**
  - Fixed critical issue where local frontend was connecting to production backend
  - Updated `scripts/deploy-local.sh` to enforce `VITE_API_BASE_URL="http://localhost:8787"`
  - Added safety check in `src/frontend/utils/api.js` to warn when localhost connects to production
  - Ensures local code changes are actually tested during development

- **Local Database Initialization**
  - Identified and fixed missing D1 database schema in local environment
  - Documented migration requirement in `docs/ongoing_projects/local_deploy_checklist.md`

- **API Error Handling**
  - Improved error logging in `src/workers/api/seed-data.js` and `src/frontend/utils/api.js`
  - Added `X-Code-Version` headers to responses for version verification
  - Added raw response body logging for non-JSON errors

### Added

- **Debugging Documentation**
  - Created `docs/ongoing_projects/local_deploy_debugging.md` tracking the "Add Test Data" failure investigation
  - Created `docs/ongoing_projects/local_deploy_checklist.md` for environment setup verification

## [1.11.11] - 2025-11-23

### Added

- **Persistent D1 Logging System** (Production Debugging Infrastructure)
  - Created `debug_logs` table in D1 for permanent log storage
  - Migration: `migrations/0006_debug_logs.sql`
  - Schema: timestamp, level, component, message, metadata (JSON), user_id, session_id, query_id, request_id
  - Indexes: timestamp DESC, level, component, user_id, session_id, query_id (for efficient filtering)

- **Updated Logger Class** (`src/utils/logger.js`)
  - Added D1 persistence via `_saveToD1()` method
  - Fire-and-forget async logging (never blocks app execution)
  - Dual logging: console output + D1 storage
  - Backward compatible with existing `createLogger()` calls

- **New Logger Utility** (`src/lib/logger.js`)
  - Alternative persistent logger implementation (duplicate, needs consolidation)
  - Includes `queryLogs()` and `cleanupOldLogs()` helper functions

### Changed

- **QuerySessionManager Logger** (`src/durable-objects/QuerySessionManager.js`)
  - Now passes `env` parameter to `createLogger()` to enable D1 persistence
  - All session logs now saved to `debug_logs` table

### Purpose

**Solves Critical Production Debugging Problem:**
- Previous logging via `wrangler tail` was ephemeral and disappeared after execution
- No way to debug production issues without real-time monitoring
- Historical log data now permanently available in D1 for post-mortem analysis

**Deployment:**
- Commit: `c7fc62a`
- Version: `346af1d5-1369-4245-91d4-123da3cc584f`

**Query Logs Example:**
```bash
npx wrangler d1 execute graphmind-db --remote --command "
  SELECT timestamp, level, component, message
  FROM debug_logs
  WHERE session_id = 'sess_xxx'
  ORDER BY timestamp DESC LIMIT 100;
"
```

## [1.11.10] - 2025-11-23

### Fixed

- **Partial Fix: Updated_at Column Bug** (`src/lib/db/voice-queries.js`)
  - ⚠️ **NOTE: This fix was necessary but NOT sufficient - query still fails**
  - Removed `updated_at = CURRENT_TIMESTAMP` from UPDATE statement
  - Column doesn't exist in `voice_queries` table schema
  - Fix: Removed reference in `updateQueryAnswer()` function
  - Deployment: Version `345d19d6-3441-4b5f-9596-5b396bc40ac0`
  - **Status:** Query "Who works on GraphMind?" still returns 0 results
  - **Investigation:** Ongoing in `docs/ongoing_projects/debugging_graph_query_failures.md`

### Critical Discovery

- **voice_queries Table is Empty**
  - Investigation revealed D1 `voice_queries` table has 0 rows
  - Queries are NOT being saved to database at all
  - Crash is happening BEFORE INSERT statement, not during UPDATE
  - Previous hypothesis about `updated_at` causing crash was incorrect
  - **Real bug location:** Unknown - requires D1 persistent logs to diagnose

### Added

- **Comprehensive Debug Logging for Query Pipeline**
  - Added detailed logging to `QuerySessionManager.js`:
    - WebSocket connection establishment with extracted userId and generated namespace
    - Cypher query generation inputs (question, userId, userNamespace)
    - Generated Cypher query details (cypher, parameters, entities, template)
    - Query execution request details (userId, namespace, config)
    - Query execution results (execution time, results count, statistics, raw results preview)

  - Added detailed logging to `cypher-generator.js`:
    - Function entry logging for `generateCypherQuery` with all input parameters
    - Template selection results with entity details
    - Entity resolution logging in `resolveEntity`:
      - Input entity name and userId validation
      - D1 query SQL and parameters
      - D1 query results (count and preview)
      - Fuzzy matching scores and decisions
      - Final resolved entity (name, type, id) for both exact and fuzzy matches
      - Fallback logging when no match found

  - Added detailed logging to `FalkorDBConnectionPool.js`:
    - Incoming query execution requests with userId validation
    - Namespace retrieval process (cache hit/miss, generation)
    - Query execution with exact Cypher and parameters

  - Added detailed logging to `namespace.js`:
    - Graph name generation inputs with userId validation
    - UUID validation process (original, cleaned, test results)
    - Graph name construction details
    - Graph name validation results

### Changed

- **Enhanced Error Diagnostics**
  - All logging includes userId format validation (length, has dashes)
  - Entity resolution logs now include all D1 query candidates
  - Fuzzy matching logs include similarity scores and distance calculations
  - Query execution logs include full parameter sets for debugging

### Purpose

These logging enhancements support debugging the graph query failure issue documented in `docs/ongoing_projects/debugging_graph_query_failures.md`, where the query "Who works at GraphMind?" returns no results despite data existing in FalkorDB. The comprehensive logging will reveal:
- Exact userId flowing through the system
- Exact userNamespace/graphName being generated
- Entity resolution results for "GraphMind" (should resolve to type `Project`, not `Person`)
- Exact Cypher query being executed against FalkorDB

## [1.11.9] - 2025-11-21

### Fixed

- **FalkorDB Data Persistence**
  - Fixed critical bug where FalkorDB data was lost on container restart
  - Root cause: Volume was mounted to `/data` but FalkorDB stores data in `/var/lib/falkordb/data`
  - Root cause: Default save thresholds (1hr minimum) meant data wasn't saved before restarts

### Changed

- **FalkorDB Docker Configuration** (`scripts/start-tunnel-services.sh`, `scripts/deploy-prod.sh`)
  - Updated volume mount path from `/data` to `/var/lib/falkordb/data`
  - Added persistence configuration after container startup:
    - RDB snapshots: Every 60 seconds if 1+ key changed (`CONFIG SET save "60 1"`)
    - AOF (Append-Only File): Enabled for durability (`CONFIG SET appendonly yes`)

- **Documentation** (`CLAUDE.md`)
  - Updated FalkorDB Docker command with correct volume mount path



---
END Changelog Entries Here - All Changelog entries should be above here
---

## Version History Summary

See Previous Changelogs for More Details: `docs/previous_changelogs/`

We keep here a brief history (5 entries + the entries in this file) in the form of | Version | Release Date | Key Features |

| Version | Release Date | Key Features |
|---------|--------------|--------------|
| 1.11.12 | 2025-11-24   | Fix local dev environment connecting to prod, D1 init |
| 1.11.11 | 2025-11-23   | Persistent D1 logging system for production debugging |
| 1.11.10 | 2025-11-23   | Partial fix: removed updated_at column (query still fails) |
| 1.11.9  | 2025-11-21   | FalkorDB data persistence fix |
