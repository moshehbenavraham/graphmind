# Security Deployment Checklist

**Feature**: Security Hardening (Spec 012 + 013)
**Version**: 1.0.0
**Last Updated**: 2025-11-24

---

## Overview

This checklist ensures safe deployment of the security hardening features to production. All three critical security fixes must be deployed together:

1. **Cypher Injection Prevention** (CVSS 9.1) - Query parameterization
2. **Authentication & CORS** (CVSS 8.6) - API key + origin restrictions
3. **Performance Optimization** (CVSS 7.5) - Indexed user_id_normalized column

**Deployment Strategy**: All-at-once (not incremental)
**Rollback Plan**: See ROLLBACK.md
**Estimated Duration**: 30-45 minutes

---

## Pre-Deployment Validation

### 1. Environment Preparation

- [ ] **Generate Production API Key**
  ```bash
  openssl rand -hex 32
  ```
  - Save key securely (password manager, NOT in code)
  - Key length: exactly 64 characters (32 bytes hex-encoded)

- [ ] **Verify Cloudflare Account Access**
  ```bash
  npx wrangler whoami
  ```
  - Should show correct account ID
  - Should have Workers deployment permissions

- [ ] **Verify D1 Database Access**
  ```bash
  npx wrangler d1 list
  ```
  - Should show "graphmind-db" in production environment

- [ ] **Verify FalkorDB Connection**
  - Test connection from Workers environment
  - Confirm host/port configuration
  - Verify credentials (if using cloud/VPS deployment)

### 2. Backup Current State

- [ ] **Backup D1 Database**
  ```bash
  npx wrangler d1 export graphmind-db --env production --output graphmind-backup-$(date +%Y%m%d).sql
  ```
  - Verify backup file exists and has data
  - Store backup securely (off-server)

- [ ] **Document Current Deployment**
  ```bash
  npx wrangler deployments list --env production
  ```
  - Note current deployment ID for potential rollback
  - Save deployment timestamp

- [ ] **Save Current Environment Variables**
  ```bash
  npx wrangler secret list --env production > secrets-backup.txt
  ```

### 3. Local Testing Complete

- [ ] **Security Tests Passing**
  ```bash
  node tests/security/injection-tests.js
  node tests/security/auth-tests.js
  ```
  - Injection tests: 13/13 passing
  - Auth tests: At least 12/14 passing

- [ ] **Performance Benchmarks Met**
  ```bash
  node tests/performance/entity-resolution-benchmark.js
  ```
  - 10,000 entities: <100ms (p95)
  - All targets within spec

- [ ] **Local E2E Test Working**
  - Start: REST API, Wrangler dev
  - Test: curl http://localhost:8787/api/health/falkordb
  - Result: Returns 200 with {"status":"healthy"}

---

## Database Migration

### 1. Review Migration

- [ ] **Review Migration SQL**
  ```bash
  cat migrations/0007_add_normalized_user_id.sql
  ```
  - Adds: user_id_normalized column
  - Creates: idx_entity_cache_user_normalized index
  - Updates: Populates existing rows

### 2. Test Migration Locally

- [ ] **Apply Migration to Local D1**
  ```bash
  npx wrangler d1 migrations apply graphmind-db --local
  ```
  - Verify: No errors
  - Verify: Column exists
  ```bash
  npx wrangler d1 execute graphmind-db --local --command="PRAGMA table_info(entity_cache);" | grep user_id_normalized
  ```

### 3. Apply Migration to Production

- [ ] **Apply Migration**
  ```bash
  npx wrangler d1 migrations apply graphmind-db --env production
  ```
  - Monitor for errors
  - Expected duration: <10 seconds

- [ ] **Verify Migration Success**
  ```bash
  npx wrangler d1 execute graphmind-db --env production --command="SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='entity_cache';"
  ```
  - Should include: idx_entity_cache_user_normalized

- [ ] **Verify Data Integrity**
  ```bash
  npx wrangler d1 execute graphmind-db --env production --command="SELECT COUNT(*) as total, COUNT(user_id_normalized) as populated FROM entity_cache;"
  ```
  - total should equal populated (all rows updated)

---

## Secret Configuration

### 1. Set Production API Key

- [ ] **Configure Wrangler Secret**
  ```bash
  echo "<YOUR_PRODUCTION_API_KEY>" | npx wrangler secret put FALKORDB_REST_API_KEY --env production
  ```
  - Use key generated in Pre-Deployment step
  - DO NOT commit key to Git

- [ ] **Verify Secret Set**
  ```bash
  npx wrangler secret list --env production
  ```
  - Should show: FALKORDB_REST_API_KEY

### 2. Configure REST API Server

- [ ] **Update Production REST API**
  - Set environment variable: FALKORDB_REST_API_KEY=<YOUR_PRODUCTION_API_KEY>
  - Verify ALLOWED_ORIGINS includes production domain
  - Restart REST API server

- [ ] **Test REST API Authentication**
  ```bash
  # Without auth (should fail)
  curl -X POST https://your-rest-api.com/api/graph/test/query -d '{"query":"MATCH (n) RETURN n LIMIT 1","params":{}}'
  # Expected: 401 Unauthorized

  # With auth (should succeed)
  curl -X POST https://your-rest-api.com/api/graph/test/query \
    -H "Authorization: Bearer <YOUR_PRODUCTION_API_KEY>" \
    -d '{"query":"MATCH (n) RETURN n LIMIT 1","params":{}}'
  # Expected: 200 OK
  ```

---

## Deployment Execution

### 1. Deploy Workers

- [ ] **Deploy to Production**
  ```bash
  npx wrangler deploy --env production
  ```
  - Monitor deployment progress
  - Note deployment ID

- [ ] **Verify Deployment**
  ```bash
  npx wrangler deployments list --env production
  ```
  - Latest deployment should be your new version
  - Status should be "active"

### 2. Initial Health Check

- [ ] **Test Health Endpoint**
  ```bash
  curl https://your-workers-url.workers.dev/api/health
  ```
  - Expected: 200 OK
  ```bash
  curl https://your-workers-url.workers.dev/api/health/falkordb
  ```
  - Expected: {"status":"healthy", "latency_ms":<number>}

### 3. Smoke Tests

- [ ] **Test Unauthenticated Request (should fail)**
  ```bash
  curl -X POST https://your-rest-api.com/api/graph/test/query \
    -H "Content-Type: application/json" \
    -d '{"query":"MATCH (n) RETURN n LIMIT 1","params":{}}'
  ```
  - Expected: 401 Unauthorized

- [ ] **Test Injection Payload (should return empty)**
  ```bash
  curl -X POST https://your-rest-api.com/api/graph/test/query \
    -H "Authorization: Bearer <YOUR_PRODUCTION_API_KEY>" \
    -H "Content-Type: application/json" \
    -d '{"query":"MATCH (p:Person {name: $name}) RETURN p","params":{"name":"Alice\\\" OR 1=1 //"}}'
  ```
  - Expected: 200 OK with empty results (no data leak)

- [ ] **Test Valid Query (should succeed)**
  ```bash
  curl -X POST https://your-rest-api.com/api/graph/test/query \
    -H "Authorization: Bearer <YOUR_PRODUCTION_API_KEY>" \
    -H "Content-Type: application/json" \
    -d '{"query":"MATCH (p:Person) RETURN p LIMIT 1","params":{}}'
  ```
  - Expected: 200 OK with results

---

## Post-Deployment Validation

### 1. Monitoring (First 15 Minutes)

- [ ] **Watch Error Logs**
  ```bash
  npx wrangler tail --env production
  ```
  - Monitor for authentication errors
  - Monitor for query errors
  - Expected: No new error patterns

- [ ] **Check Error Rate**
  - Cloudflare Dashboard → Workers → graphmind-api → Metrics
  - Error rate should be <1%
  - No spike in errors after deployment

### 2. Performance Validation

- [ ] **Test Query Performance**
  - Execute test queries via frontend or API
  - Measure response times
  - Expected: <5s for voice queries, <100ms for entity resolution

- [ ] **Monitor Cold Start Times**
  - First request latency should be <3s
  - Subsequent requests should be <1s

### 3. Security Verification

- [ ] **Verify Cross-Origin Restrictions**
  - Test request from unauthorized origin
  - Expected: CORS blocks request

- [ ] **Verify User Isolation**
  - Create test users
  - Query as User A
  - Verify cannot access User B data

### 4. Functional Testing

- [ ] **Test Voice Note Creation**
  - Record voice note
  - Verify transcription
  - Verify entities extracted
  - Verify stored in FalkorDB

- [ ] **Test Voice Query**
  - Ask question via voice
  - Verify answer generated
  - Verify correct data returned
  - Verify latency <5s

---

## Rollback Criteria

If ANY of the following occur, execute rollback (see ROLLBACK.md):

- [ ] **Error rate >5% in first 30 minutes**
- [ ] **Authentication failures for legitimate users**
- [ ] **Query performance >2x slower than baseline**
- [ ] **Data leakage detected (injection successful)**
- [ ] **Service unavailable or crashing**

---

## Success Criteria

Deployment is considered successful when ALL of the following are true:

- [x] Database migration applied successfully
- [x] Secrets configured correctly
- [x] Workers deployed without errors
- [x] Health checks return 200
- [x] Smoke tests pass (auth, injection, valid query)
- [x] Error rate <1% after 15 minutes
- [x] Performance within targets
- [x] No unauthorized data access
- [x] User workflows functioning normally

---

## Post-Deployment Actions

### 1. Documentation

- [ ] **Update CHANGELOG.md**
  - Document deployed version
  - List security fixes
  - Note breaking changes (none expected)

- [ ] **Notify Team**
  - Announce successful deployment
  - Share monitoring dashboard link
  - Note any known issues

### 2. Monitoring Setup

- [ ] **Set up Alerts**
  - Error rate threshold: >2%
  - Response time threshold: >5s for voice queries
  - Authentication failure rate: >5%

- [ ] **Enable Detailed Logging (First 24 Hours)**
  - Log all authentication attempts
  - Log query execution times
  - Monitor for anomalies

### 3. Follow-Up Tasks

- [ ] **Remove Backup Files After 7 Days**
  - Keep for rollback capability
  - Delete once stability confirmed

- [ ] **Review Performance Data After 24 Hours**
  - Compare to pre-deployment baseline
  - Identify optimization opportunities

- [ ] **Address Any Minor Issues**
  - Fix edge cases discovered in production
  - Update tests based on production learnings

---

## Notes

- Deployment should be during low-traffic period
- Have rollback plan ready before starting
- Monitor continuously for first hour
- Be prepared to rollback within 15 minutes if needed

---

## API Key Rotation Procedure

This section documents how to rotate the `FALKORDB_REST_API_KEY` for security hygiene or in case of key compromise.

### When to Rotate Keys

- **Scheduled**: Every 90 days (quarterly)
- **Immediate**: If key may have been exposed (logs, screenshots, code commits)
- **Immediate**: If employee with key access leaves organization
- **Immediate**: After any security incident

### Rotation Steps (Zero-Downtime)

#### 1. Generate New Key

```bash
# Generate a new 32-byte API key (64 hex characters)
openssl rand -hex 32 > /tmp/new-api-key.txt
cat /tmp/new-api-key.txt
```

Save the new key securely in a password manager.

#### 2. Update REST API Server to Accept Both Keys

Temporarily configure the REST API to accept both old and new keys:

```bash
# On the server running scripts/falkordb-rest-api.js
# Option 1: Set both keys in environment (comma-separated)
export FALKORDB_REST_API_KEY="<new-key>,<old-key>"

# Option 2: Or update .env to have both (during transition only)
FALKORDB_REST_API_KEY=<new-key>,<old-key>
```

Restart the REST API server.

#### 3. Update Cloudflare Workers Secret

```bash
# Set the new key in Workers
cat /tmp/new-api-key.txt | npx wrangler secret put FALKORDB_REST_API_KEY --env production

# Verify the secret was updated
npx wrangler secret list --env production
```

The Workers deployment automatically picks up the new secret.

#### 4. Test New Key

```bash
# Test that Workers can connect with the new key
curl https://graphmind-api.your-domain.workers.dev/api/health/falkordb

# Expected: 200 OK with healthy status
```

#### 5. Finalize Rotation

Once verified:

```bash
# Remove the old key from REST API server
export FALKORDB_REST_API_KEY="<new-key-only>"

# Or update .env
FALKORDB_REST_API_KEY=<new-key-only>
```

Restart the REST API server.

#### 6. Verify and Cleanup

```bash
# Verify old key no longer works (from external system)
curl -X POST https://your-rest-api.com/api/graph/test/query \
  -H "Authorization: Bearer <OLD_KEY>" \
  -d '{"query":"MATCH (n) RETURN n LIMIT 1","params":{}}'
# Expected: 403 Forbidden

# Cleanup temporary files
rm /tmp/new-api-key.txt

# Document rotation in ops log
echo "$(date): FALKORDB_REST_API_KEY rotated" >> /var/log/graphmind-ops.log
```

### Emergency Rotation (Key Compromise)

If the key may have been compromised, perform immediate rotation:

1. **Generate new key immediately** (Step 1 above)
2. **Update REST API with new key ONLY** (skip dual-key phase)
3. **Update Workers secret immediately** (Step 3 above)
4. **Monitor for unauthorized access attempts** in logs
5. **Review logs for suspicious activity** during exposure window

### Key Storage Best Practices

- Store keys in a password manager (1Password, Bitwarden)
- Never commit keys to Git (use `wrangler secret` for Workers)
- Never log keys (ensure logging doesn't include auth headers)
- Limit key access to operations personnel only
- Document who has access to keys

### Rotation Schedule

| Quarter | Rotation Date | Status |
|---------|---------------|--------|
| Q1 2025 | March 1 | Pending |
| Q2 2025 | June 1 | Pending |
| Q3 2025 | September 1 | Pending |
| Q4 2025 | December 1 | Pending |

---

## References

- Security Audit: docs/graph-query-audit.md
- Rollback Procedures: docs/deployment/ROLLBACK.md
- Security Testing: docs/deployment/SECURITY_TESTING.md
- Infrastructure Audit: docs/infrastructure/infrastructure-audit.md
- Spec 012: specs/012-security-hardening/
- Spec 013: specs/013-security-validation/
