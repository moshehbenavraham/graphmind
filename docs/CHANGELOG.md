# GraphMind Documentation Changelog

All notable changes to the GraphMind documentation will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Previous Changelogs: `docs/previous_changelogs/`

---
Begin Changelog Entries Here - We do not use "unreleased" so all entries should have a version
---

## [0.3.4] - 2025-11-24

### Added

**GraphRAG 2.0 Vector Search Verification**
- Verified complete GraphRAG 2.0 vector-first retrieval pipeline
- Backfilled 61 nodes with 768-dimension embeddings (6 Person, 4 Project, 51 Topic)
- Vector search operational with cosine similarity scoring
- Admin JWT authentication for backfill endpoint

### Fixed

**REST API Data Parser** (`scripts/falkordb-rest-api.js`)
- Added `extractValue()` function to parse FalkorDB's `[type, value]` format
- Added `extractColumnName()` for column headers in `[[type, name], ...]` format
- Fixed `parseFalkorDBResult()` to return clean column names and extracted values

**FalkorDB Parameter Handling** (`scripts/falkordb-rest-api.js`)
- Changed from `--params JSON` format to `CYPHER key=value` prefix format
- FalkorDB requires params in `CYPHER id=0 embedding=[...] MATCH...` syntax
- Fixed "Missing parameters" errors when executing parameterized queries

**REST API Port Configuration** (`scripts/falkordb-rest-api.js`)
- Added `FALKORDB_REDIS_PORT` env var for direct Redis connection (default 6380)
- Separated from `FALKORDB_PORT` which Workers use for REST API (3001)
- Fixed "Unknown RESP type 72 'H'" error caused by HTTP/Redis protocol mismatch

**Auth Middleware Admin Role** (`src/middleware/auth.js`)
- Added extraction of `role` and `is_admin` from JWT claims
- Fixed 403 Forbidden errors when accessing admin endpoints with valid admin JWT

**Backfill Endpoint** (`src/workers/api/admin/backfill-embeddings.js`)
- Fixed `userId` to use authenticated user's ID instead of `crypto.randomUUID()`
- Changed embedding storage to use `vecf32($embedding)` for vector index compatibility
- Fixed "Node null has no text to embed" errors from incorrect data parsing

### Technical Details

**Files Modified:**
- `scripts/falkordb-rest-api.js` - Lines 152-188 (CYPHER params), Lines 211-310 (data parser)
- `src/middleware/auth.js` - Lines 109-115 (role extraction)
- `src/workers/api/admin/backfill-embeddings.js` - Lines 105, 153, 167 (userId and vecf32)

**Vector Index Requirements:**
- Embeddings must be stored as `vecf32()` type, not raw arrays
- Indexes must be created BEFORE or rebuilt AFTER data population
- Query format: `CALL db.idx.vector.queryNodes('Label', 'embedding', K, vecf32($vector))`

## [0.3.3] - 2025-11-24

### Fixed

**FalkorDB Configuration for Local Development**
- Fixed "FALKORDB_HOST is not configured" error when adding seed data in local development
- Root cause: Wrangler ignores `.env` when `.dev.vars` exists, but `.dev.vars` was incomplete
- Added missing environment variables to `.dev.vars`: `FALKORDB_HOST`, `FALKORDB_PORT`, `FALKORDB_USER`, `BCRYPT_COST`, `ANSWER_CACHE_TTL`, `ANSWER_MAX_TOKENS`, `LLM_TEMPERATURE`
- Workers now properly receive all required environment variables via `env` object

**FalkorDB Port Configuration Mismatch**
- Fixed "POOL_ERROR_500: PING failed: Network connection lost" error when connecting to FalkorDB
- Corrected port configuration from 6380 to 3001 in both `.dev.vars` and `.env`
- Workers now connect to REST API wrapper (port 3001) instead of attempting HTTP requests directly to FalkorDB Docker (port 6380 with Redis protocol)
- Architecture: Worker → REST API wrapper (3001) → FalkorDB Docker (6380)

### Changed

- `.dev.vars` now contains complete set of environment variables for local Worker development
- `.dev.vars` `FALKORDB_PORT` changed from 6380 to 3001 (REST API wrapper port)
- `.env` `FALKORDB_PORT` changed from 6380 to 3001 for consistency
- Added architecture documentation comments in both `.dev.vars` and `.env` explaining the connection flow

### Technical Details

**Files Modified:**
- `.dev.vars` - Complete rewrite: Added all missing environment variables and corrected FALKORDB_PORT
- `.env` - Lines 28-36: Updated FALKORDB_PORT and added documentation comments

**Environment Variables Added to `.dev.vars`:**
- `FALKORDB_HOST=localhost`
- `FALKORDB_PORT=3001` (changed from 6380)
- `FALKORDB_USER=default`
- `BCRYPT_COST=12`
- `ANSWER_CACHE_TTL=3600`
- `ANSWER_MAX_TOKENS=200`
- `LLM_TEMPERATURE=0.7`

**Architecture Clarification:**
- FalkorDB Docker: Port 6380 (Redis protocol) - internal use only
- REST API wrapper: Port 3001 (HTTP) - Worker connection endpoint
- Workers use HTTP REST client and must connect to port 3001, not 6380

## [0.3.2] - 2025-11-24

### Fixed

**Frontend Authentication Error Handling**
- Fixed login error messages not displaying when attempting to log in with invalid credentials
- Modified `src/frontend/utils/api.js` to skip 401 auto-redirect for `/api/auth/login` and `/api/auth/register` endpoints
- 401 errors from authentication endpoints now properly display error messages instead of triggering redirect loop
- Users now see "Invalid email or password" message when login fails

**JWT Token Generation in Registration**
- Fixed "Registration completed but token generation failed" error during user registration
- Added `JWT_SECRET` to `.dev.vars` file for local development (Wrangler doesn't read from `.env`)
- Registration now successfully generates JWT tokens and logs users in immediately after account creation

**Local Development Data Persistence**
- Fixed data loss issue where `deploy-local.sh` destroyed all data on every run
- Modified `scripts/deploy-local.sh` to preserve `.wrangler/state/` directory containing D1 local database
- Changed FalkorDB container management from destroy/recreate to stop/start for persistence
- Added `redis.conf` with proper persistence settings (RDB snapshots + AOF) for new FalkorDB containers
- User accounts and graph data now persist across local development restarts

**Deployment Script Numbering**
- Fixed incorrect "[9/8]" step numbering in `scripts/deploy-local.sh` health checks section
- Removed numbering from health checks phase (post-deployment validation)

### Changed

- `.dev.vars` now includes `JWT_SECRET` for local development
- `deploy-local.sh` now restarts existing FalkorDB containers instead of recreating them
- D1 local database in `.wrangler/state/` directory is preserved during cleanup operations
- FalkorDB containers now start with `redis.conf` for persistent configuration

### Technical Details

**Files Modified:**
- `scripts/deploy-local.sh` - Lines 74-84 (D1 persistence), Lines 91-127 (FalkorDB persistence), Line 188 (numbering fix)
- `src/frontend/utils/api.js` - Lines 59-68 (401 handling for auth endpoints)
- `.dev.vars` - Added JWT_SECRET environment variable

**Persistence Configuration:**
- FalkorDB: RDB snapshots (60s/1 change, 300s/10 changes, 3600s/1 change)
- FalkorDB: AOF enabled with everysec fsync
- D1: SQLite database preserved in `.wrangler/state/v3/d1/`

## [0.3.1] - 2025-11-24

### Fixed

**FalkorDB REST API Authentication Issues**
- Fixed health check failures in deployment scripts due to missing authentication headers
- Updated `scripts/deploy-prod.sh` to include `Authorization: Bearer` header with `FALKORDB_REST_API_KEY` in all health checks
- Updated `scripts/deploy-local.sh` with same authentication fixes
- Updated `scripts/start-tunnel-services.sh` to use authenticated health checks
- Increased wait time from 3s to 5s for REST API initialization
- Health checks now properly validate against authenticated `/health` endpoint

**Seed Data API Key Missing**
- Fixed `buildFalkorConfig()` in `src/workers/api/seed-data.js` to include `apiKey` parameter
- Added `const apiKey = env.FALKORDB_REST_API_KEY` (line 31)
- Updated return statement to include `apiKey` in config object (line 42)
- Fixed "POOL_ERROR_500: Unauthorized" errors when adding test data to knowledge graph
- Seed data operations now properly authenticate with FalkorDB REST API

**Cypher Query Parameterization**
- Fixed LLM prompt in `src/services/cypher-generator.js` to generate parameterized queries instead of literal values
- Changed instruction from "Use LITERAL values in queries (NOT $param placeholders)" to "Use $param placeholders for all entity names and values (REQUIRED for parameterization)"
- Updated all example queries to use `$param` syntax (e.g., `{name: $project_name}` instead of `{name: 'GraphMind'}`)
- Added `extractParametersFromQuery()` function to extract parameter values from generated queries and match with detected entities
- Fixed "Missing parameters" errors when executing LLM-generated queries
- Queries now properly use FalkorDB's parameterization system

### Changed

- Deployment scripts now require `FALKORDB_REST_API_KEY` environment variable for health checks
- LLM Cypher generation now returns proper `parameters` object instead of empty `{}`

### Technical Details

**Files Modified:**
- `scripts/deploy-prod.sh` - Lines 126-129, 208-212
- `scripts/deploy-local.sh` - Lines 125-128, 198-202
- `scripts/start-tunnel-services.sh` - Lines 65-68
- `src/workers/api/seed-data.js` - Lines 27-42
- `src/services/cypher-generator.js` - Lines 413-483 (added parameter extraction), Lines 445-474 (updated LLM prompt)



---
END Changelog Entries Here - All Changelog entries should be above here
---

## Version History Summary

See Previous Changelogs for More Details: `docs/previous_changelogs/`

We keep here a brief history (5 entries + the entries in this file) in the form of | Version | Release Date | Key Features |

| Version | Release Date | Key Features |
|---------|--------------|--------------|
