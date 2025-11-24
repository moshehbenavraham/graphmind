# Local Deployment Debugging Guide

**Current Status:** 🟢 RESOLVED (as of 2025-11-24)

This guide consolidates debugging steps for local deployment issues. For historical context and detailed version changes, see `docs/CHANGELOG.md`.

## Common Issues & Solutions

### 1. Connection Failed ("PING failed: Network connection lost")
**Symptoms:** 
- "Add Test Data" button fails.
- Worker logs show `POOL_ERROR_500` or connection timeouts.

**Root Cause:** 
- **Environment Variable Conflict:** Local processes inheriting Production `FALKORDB_HOST` from `.env`.
- **URL Construction:** `rest-client.js` dropping ports when protocol is present.

**Solution:**
- **ALWAYS** use `scripts/deploy-local.sh` to start the environment.
- It explicitly overrides environment variables:
  - REST API: `FALKORDB_HOST="localhost"`, `FALKORDB_PORT="6380"`
  - Worker: `FALKORDB_HOST="http://127.0.0.1"`, `FALKORDB_PORT="3001"`
- Do not run `wrangler dev` directly without setting these overrides.

### 2. Authentication Failed ("Login temporarily unavailable")
**Symptoms:** 
- Login or Registration fails.
- Logs show `SQLITE_ERROR: no such table: users`.

**Root Cause:** 
- Local D1 database in `.wrangler/` was cleared (e.g., by clean script) but migrations were not re-applied.

**Solution:**
- Apply local migrations: `npx wrangler d1 migrations apply graphmind-db --local`.
- `scripts/deploy-local.sh` now includes this step automatically (using `yes | ...` to bypass prompts).

### 3. Generic "Internal Server Error"
**Symptoms:** 
- UI shows generic error with no details.

**Solution:**
- Improved error handling in `src/workers/api/seed-data.js` now logs full error bodies.
- Check the terminal running `wrangler dev` for detailed JSON error output.

## Verification Checklist

To verify a healthy local environment:
1. **Run Deployment:** Execute `scripts/deploy-local.sh`.
2. **Verify Migrations:** Register a new user at `http://localhost:5173/register`.
3. **Verify Connectivity:** Click "Add Test Data" in the Dashboard. Success means the Worker can talk to the local FalkorDB via the REST wrapper.
