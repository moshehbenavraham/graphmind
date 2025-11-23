# GraphMind Documentation Changelog

All notable changes to the GraphMind documentation will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Previous Changelogs: `docs/previous_changelogs/`

---
Begin Changelog Entries Here - We do not use "unreleased" so all entries should have a version
---

## [1.11.10] - 2025-11-23

### Fixed

- **Critical Session Crash Bug** (`src/lib/db/voice-queries.js`)
  - Fixed session crash occurring after successful query execution
  - Root cause: UPDATE statement tried to set non-existent `updated_at` column in `voice_queries` table
  - Impact: Queries executed successfully and FalkorDB returned results, but session crashed BEFORE sending results to frontend
  - Symptom: Frontend displayed "No results found" despite data existing and query working correctly
  - Debug process: Comprehensive logging revealed query pipeline was working perfectly - issue was in result delivery
  - Fix: Removed `updated_at` from UPDATE statement in `updateQueryAnswer()` function
  - Deployment: Version 47fd7538-91eb-4963-a2fc-50967d492642

- **Minor Schema Mismatch** (`src/services/cypher-generator.js`)
  - Removed references to non-existent `entity_id` column in `entity_cache` queries
  - This was identified during debugging but was not the root cause of the query failure
  - Deployment: Version 6d8cb77c-0e24-4ae9-9d91-86104ae404b7

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
| 1.11.10 | 2025-11-23   | Comprehensive debug logging for query pipeline |
| 1.11.9  | 2025-11-21   | FalkorDB data persistence fix |
