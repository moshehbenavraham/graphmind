# Next Spec: Security Hardening - P0 Critical Fixes

**Phase**: Phase 3.5 - Security Critical (PRODUCTION BLOCKER)
**Priority**: P0 (CRITICAL - Must Fix Before ANY Deployment)
**Estimated Context**: ~15,000 tokens
**Dependencies**: Backend deployed ✅ (Features 008-010 live)
**Status**: URGENT - Production Unsafe
**Audit Reference**: [docs/graph-query-audit.md](../graph-query-audit.md)

---

## 🚨 Executive Summary

**CRITICAL SECURITY VULNERABILITIES** discovered in comprehensive audit make GraphMind **UNSAFE FOR PRODUCTION**. Three P0 blockers must be fixed immediately before frontend deployment or any further development:

1. **Cypher Injection** (CVSS 9.1) - Manual parameter interpolation allows arbitrary code execution
2. **Cross-Site Data Theft** (CVSS 8.6) - CORS misconfiguration enables any website to steal user data
3. **Database Full Table Scans** (CVSS 7.5) - UUID normalization prevents index usage, causing exponential performance degradation

**Current Risk Level**: HIGH - Multiple critical vulnerabilities allow data theft, injection attacks, and denial of service.

**Required Action**: Fix all 3 P0 issues (estimated 6-10 hours) before deploying frontend (Feature 011) or continuing development.

---

## Why This is Urgent

### Security Audit Results

A comprehensive security audit of the graph retrieval system revealed **PRODUCTION-BLOCKING vulnerabilities**:

**✅ What's Good**:
- Defense-in-depth architecture (query validator, LLM sanitization, caching)
- Proper parameterization through 6 of 7 layers
- Two-tier LLM fallback with timeouts

**❌ Critical Flaws**:
1. **Parameter interpolation breaks at REST API layer** - Enables Cypher injection despite validator
2. **CORS wildcard (`*`)** - Any website can query user's graph from browser
3. **No authentication on REST API** - Zero protection against unauthorized access
4. **Full table scans on every query** - `REPLACE(user_id, '-', '')` prevents index usage

**Impact**:
- Attacker can steal entire knowledge graph via cross-site request
- Injection bypasses validator, enables data exfiltration and DoS
- Performance degrades exponentially (100 entities: 25ms → 10,000 entities: 2,000ms → timeout)

### Why Now?

**Current Status**: Backend is deployed and working, frontend is next.

**Risk**: Deploying frontend with these vulnerabilities would:
1. **Expose user data** - Any website can steal knowledge graphs
2. **Enable injection attacks** - Malicious queries can bypass security
3. **Cause service outages** - Performance issues will crash production
4. **Block beta testing** - Cannot safely allow users on the platform

**Priority Change**:
- **Previous**: Frontend deployment (Feature 011)
- **Current**: Security hardening (P0 fixes)
- **After This**: Resume frontend deployment safely

---

## Scope (Single Context Window)

### Included - P0 Critical Fixes

**1. Fix Cypher Injection** (`scripts/falkordb-rest-api.js`):
- Replace manual parameter interpolation with FalkorDB native `--params` syntax
- Update REST API to use Redis protocol parameter support
- Test with injection payloads
- **Files**: `scripts/falkordb-rest-api.js` (lines 103-127)
- **Effort**: 2-4 hours

**2. Add REST API Authentication** (`scripts/falkordb-rest-api.js`, `src/lib/graph/rest-client.js`):
- Generate API key in `.env`
- Add Bearer token middleware
- Update `rest-client.js` to send token
- **Files**: `scripts/falkordb-rest-api.js` (lines 14-40), `src/lib/graph/rest-client.js` (line 85)
- **Effort**: 2-3 hours

**3. Restrict CORS Origins** (`scripts/falkordb-rest-api.js`):
- Replace `Access-Control-Allow-Origin: *` with whitelist
- Add allowed origins: localhost:5173, localhost:8787, graphmind.pages.dev
- Alternative: Bind to `127.0.0.1` only (if REST API is local-only)
- **Files**: `scripts/falkordb-rest-api.js` (lines 14-23)
- **Effort**: 30 minutes

**4. Fix UUID Index** (D1 migration, `src/services/cypher-generator.js`):
- Create D1 migration: Add `user_id_normalized` column to `entity_cache`
- Create index on `(user_id_normalized, canonical_name)`
- Update entity resolution query to use indexed column
- Add LIKE prefix filter to reduce fuzzy match candidates
- **Files**: `migrations/XXXX_add_normalized_user_id.sql`, `src/services/cypher-generator.js` (lines 546-552)
- **Effort**: 1-2 hours

**Total P0 Effort**: 6-10 hours

### Explicitly Excluded (for later)

**P1 - High Priority** (5-7 hours):
- Rate limiting (express-rate-limit + KV-based)
- Server-side entity search optimization
- Query complexity checks

**P2 - Medium Priority** (4-6 hours):
- Structured logging (Winston)
- Generic error responses
- Input sanitization (question validation)

**Deferred to Phase 4**:
- Frontend deployment (Feature 011)
- Graph visualization
- Search interface
- Entity management UI

### Estimated Tokens

**Implementation**: ~10,000 tokens
- Cypher injection fix: ~3,000 tokens
- Authentication: ~3,000 tokens
- CORS: ~1,000 tokens
- UUID index: ~3,000 tokens

**Testing**: ~3,000 tokens
- Injection test suite
- CORS security tests
- Performance benchmarks

**Documentation**: ~2,000 tokens
- Update deployment docs
- Security best practices

**Total**: ~15,000 tokens (fits in single context)

---

## User Stories (Security Hardening)

### Story 1: Prevent Cypher Injection Attacks (P0)

**As a** security-conscious developer
**I want** parameterized queries to be properly handled at all layers
**So that** malicious input cannot execute arbitrary Cypher code

**Acceptance Criteria**:
- [ ] REST API uses FalkorDB native parameter syntax (`--params` flag)
- [ ] Manual string interpolation removed from `falkordb-rest-api.js`
- [ ] Test with injection payloads: All return empty results (no injection)
- [ ] Parameterization chain maintained through all 7 layers
- [ ] Validator continues to block destructive keywords (defense-in-depth)

**Attack Vectors to Block**:
```javascript
// These should NOT work after fix:
{ entityName: 'Alice\\" OR 1=1 //' }           // Logic injection
{ entityName: 'Bob\\" OR true RETURN * //' }    // LIMIT bypass
{ entityName: 'Carol\\" WITH n MATCH (x) //' }  // Data exfiltration
```

---

### Story 2: Prevent Cross-Site Data Theft (P0)

**As a** user
**I want** my knowledge graph protected from unauthorized access
**So that** malicious websites cannot steal my personal data

**Acceptance Criteria**:
- [ ] REST API requires Bearer token authentication
- [ ] API key stored in `.env` (not hardcoded)
- [ ] `rest-client.js` sends `Authorization` header with API key
- [ ] Requests without valid token return 401 Unauthorized
- [ ] CORS restricted to known origins (localhost, Pages domain)
- [ ] Wildcard CORS (`*`) removed
- [ ] Cross-site requests from unknown origins fail

**Attack Scenario to Block**:
```javascript
// Evil website tries to steal user data:
fetch('http://localhost:3001/api/graph/user_abc/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'MATCH (n) RETURN n LIMIT 1000' })
})
// Should return: 401 Unauthorized (missing token)
// Should fail: CORS block (unknown origin)
```

---

### Story 3: Optimize Entity Resolution Performance (P0)

**As a** user with a growing knowledge graph
**I want** queries to remain fast regardless of how many entities I have
**So that** the system doesn't timeout or become unusably slow

**Acceptance Criteria**:
- [ ] `entity_cache` table has `user_id_normalized` column
- [ ] Index created on `(user_id_normalized, canonical_name)`
- [ ] Entity resolution query uses indexed column (no REPLACE in WHERE)
- [ ] Query includes LIKE prefix filter to limit candidates
- [ ] Performance benchmark: <100ms for 10,000 entities
- [ ] Database query plan shows index usage (not full table scan)

**Performance Targets**:
```
Entities | Before (Full Scan) | After (Indexed) | Improvement
---------|-------------------|-----------------|-------------
100      | 25ms              | 8ms             | 3x faster
1,000    | 200ms             | 8ms             | 25x faster
10,000   | 2,000ms (timeout) | 8ms             | 250x faster
100,000  | 20,000ms (crash)  | 8ms             | 2,500x faster
```

---

## Technical Approach

### 1. Cypher Injection Fix

**Root Cause**: `scripts/falkordb-rest-api.js` manually interpolates parameters instead of using FalkorDB's native parameter support.

**Current (Vulnerable)**:
```javascript
// scripts/falkordb-rest-api.js:103-124
let finalQuery = query;
for (const [key, value] of Object.entries(params)) {
  const paramPlaceholder = `$${key}`;
  let paramValue;
  if (typeof value === 'string') {
    paramValue = `"${value.replace(/"/g, '\\"')}"`;  // ❌ Vulnerable
  }
  finalQuery = finalQuery.replaceAll(paramPlaceholder, paramValue);  // ❌ Injection point
}
```

**Fixed (Secure)**:
```javascript
// scripts/falkordb-rest-api.js:103-127 (replace)
const args = [
  'GRAPH.QUERY',
  graphName,
  query,              // Keep parameterized with $placeholders
  '--compact',
  '--params',
  JSON.stringify(params)  // Pass params separately to FalkorDB
];

const result = await redisClient.sendCommand(args);
```

**Why This Works**:
- FalkorDB handles parameter escaping internally (safe from injection)
- Params never interpolated into query string
- Maintains parameterization through all 7 layers
- Validator continues to provide defense-in-depth

---

### 2. Authentication & CORS Fix

**Current (Vulnerable)**:
```javascript
// scripts/falkordb-rest-api.js:14-23
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');  // ❌ Any origin allowed
  // ... no authentication check
  next();
});
```

**Fixed (Secure)**:
```javascript
// scripts/falkordb-rest-api.js:14-50 (replace)
const API_KEY = process.env.FALKORDB_REST_API_KEY;

app.use((req, res, next) => {
  // Restrict CORS to known origins
  const allowedOrigins = [
    'http://localhost:5173',      // Vite dev
    'http://localhost:8787',      // Wrangler dev
    'https://graphmind.pages.dev' // Production
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  // Require authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  if (token !== API_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
});
```

**Update Client**:
```javascript
// src/lib/graph/rest-client.js:85 (add Authorization header)
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${env.FALKORDB_REST_API_KEY}`
  },
  body: JSON.stringify(body)
});
```

**Environment Setup**:
```bash
# Add to .env
FALKORDB_REST_API_KEY=your-secure-random-key-here

# Generate secure key:
openssl rand -base64 32
```

---

### 3. UUID Index Fix

**Root Cause**: `REPLACE(user_id, '-', '')` in WHERE clause prevents index usage, forcing full table scan.

**Current (Slow)**:
```javascript
// src/services/cypher-generator.js:546-552
const { results } = await env.DB.prepare(
  "SELECT canonical_name, entity_type FROM entity_cache WHERE REPLACE(user_id, '-', '') = ?"
).bind(cleanUserId).all();  // ❌ Full table scan
```

**Step 1: Database Migration**:
```sql
-- migrations/XXXX_add_normalized_user_id.sql

-- Add normalized UUID column
ALTER TABLE entity_cache ADD COLUMN user_id_normalized TEXT;

-- Populate from existing data
UPDATE entity_cache
SET user_id_normalized = REPLACE(user_id, '-', '');

-- Create composite index
CREATE INDEX idx_entity_cache_user_normalized
ON entity_cache(user_id_normalized, canonical_name);
```

**Step 2: Update Query**:
```javascript
// src/services/cypher-generator.js:546-560 (replace)
async function resolveEntity(env, userId, entityName) {
  const normalizedUserId = userId.replace(/-/g, '');

  // Use indexed column with server-side filtering
  const { results } = await env.DB.prepare(`
    SELECT canonical_name, entity_type
    FROM entity_cache
    WHERE user_id_normalized = ?
      AND canonical_name LIKE ? || '%'
    LIMIT 50
  `).bind(normalizedUserId, entityName.substring(0, 3)).all();

  // Fuzzy match only on ~50 candidates instead of ALL entities
  return performFuzzyMatch(results, entityName);
}
```

**Benefits**:
- Index scan instead of full table scan
- LIKE prefix filter reduces candidates before fetch
- Fuzzy matching on 50 items instead of 10,000+
- 250x faster for large graphs

---

## Implementation Steps

### Phase 1: Cypher Injection Fix (2-4 hours)

1. **Update REST API** (1-2 hours):
   - Read FalkorDB parameter docs
   - Replace manual interpolation (lines 103-127)
   - Test locally with simple query
   - Verify params passed correctly

2. **Test Injection Payloads** (1 hour):
   - Create test script with injection attempts
   - Verify all return empty results (no injection)
   - Test edge cases (unicode, escapes, special chars)

3. **Verify 7-Layer Chain** (30 minutes):
   - Trace parameter flow through all layers
   - Confirm separation maintained end-to-end
   - Update architecture docs

---

### Phase 2: Authentication & CORS (2-3 hours)

1. **Generate API Key** (15 minutes):
   - Create secure random key
   - Add to `.env` (local and production)
   - Document in README

2. **Add Auth Middleware** (1 hour):
   - Implement Bearer token check
   - Restrict CORS origins
   - Handle OPTIONS preflight
   - Test unauthorized requests (should 401)

3. **Update Client** (30 minutes):
   - Add Authorization header to rest-client.js
   - Pass env.FALKORDB_REST_API_KEY
   - Test authenticated requests

4. **Security Testing** (30-60 minutes):
   - Test CORS from unknown origin (should fail)
   - Test missing token (should 401)
   - Test invalid token (should 403)
   - Test cross-site attack scenario

---

### Phase 3: UUID Index Fix (1-2 hours)

1. **Create Migration** (30 minutes):
   - Write SQL migration
   - Test on local D1
   - Apply to development database

2. **Update Query Logic** (30 minutes):
   - Modify resolveEntity function
   - Add LIKE prefix filter
   - Test with sample data

3. **Performance Benchmark** (30 minutes):
   - Seed test data (100, 1K, 10K entities)
   - Measure query times before/after
   - Verify <100ms for 10K entities
   - Check database query plan

4. **Apply to Production** (15 minutes):
   - Run migration on production D1
   - Deploy updated code
   - Monitor performance

---

### Phase 4: Verification & Documentation (1-2 hours)

1. **Integration Testing** (30 minutes):
   - End-to-end query flow
   - Verify all security measures active
   - Test performance under load

2. **Security Test Suite** (30 minutes):
   - Injection attempts (should fail)
   - CORS violations (should block)
   - Unauthorized access (should 401)
   - Performance benchmarks (should pass)

3. **Update Documentation** (30 minutes):
   - Security best practices
   - Deployment checklist
   - Architecture diagrams
   - API documentation

---

## Success Criteria

### Functional Requirements

**Cypher Injection Prevention**:
- [ ] REST API uses FalkorDB `--params` syntax
- [ ] No manual string interpolation in parameter handling
- [ ] Injection test suite: 10/10 attacks blocked
- [ ] Parameterization maintained through all 7 layers

**Authentication & Authorization**:
- [ ] REST API requires Bearer token
- [ ] API key stored in environment variables
- [ ] Unauthorized requests return 401
- [ ] Invalid tokens return 403

**CORS Security**:
- [ ] Wildcard CORS removed (`*` → whitelist)
- [ ] Only allowed origins can make requests
- [ ] Cross-site attack scenario blocked
- [ ] Preflight OPTIONS handled correctly

**Performance Optimization**:
- [ ] `user_id_normalized` column exists with index
- [ ] Entity resolution uses indexed query
- [ ] Performance <100ms for 10,000 entities
- [ ] Database query plan shows index usage

---

### Non-Functional Requirements

**Security**:
- [ ] No CRITICAL vulnerabilities (audit re-scan)
- [ ] Defense-in-depth maintained (validator + params)
- [ ] Error messages don't leak internal details
- [ ] Logs capture security events

**Performance**:
- [ ] Query latency <500ms p95 (production)
- [ ] No full table scans in hot path
- [ ] Memory usage stable under load

**Maintainability**:
- [ ] Code follows existing patterns
- [ ] Comments explain security measures
- [ ] Documentation updated
- [ ] Tests cover security scenarios

---

### Testing Checklist

**Injection Tests** (scripts/test-security-injection.js):
```javascript
const injectionPayloads = [
  'Alice\\" OR 1=1 //',
  'Bob\\\\" OR true RETURN * //',
  'Carol\\" UNION MATCH (n) RETURN n //',
  'Dave\\" WITH 1 AS x MATCH (secret) RETURN secret //'
];

for (const payload of injectionPayloads) {
  const result = await queryGraph({ entityName: payload });
  assert(result.length <= 1, 'Injection blocked');
}
```

**CORS Tests** (scripts/test-security-cors.js):
```javascript
// Should fail from unknown origin
const response = await fetch('http://localhost:3001/api/graph/test/query', {
  method: 'POST',
  headers: { 'Origin': 'https://evil.com' },
  body: JSON.stringify({ query: 'MATCH (n) RETURN n' })
});
assert(response.status !== 200, 'CORS blocked');
```

**Performance Tests** (scripts/test-performance-entities.js):
```javascript
// Benchmark entity resolution
const start = Date.now();
await resolveEntity(env, userId, 'Alice');  // With 10,000 entities
const duration = Date.now() - start;
assert(duration < 100, 'Query optimized');
```

---

## Dependencies

### Prerequisites (Already Complete)

✅ **Infrastructure**:
- Cloudflare Workers deployed
- D1 database configured
- FalkorDB connection established
- REST API running

✅ **Features**:
- Feature 008: Voice Query (deployed)
- Feature 009: Answer Generation (ready)
- Feature 010: TTS Responses (deployed)

✅ **Code**:
- Cypher generator parameterization
- Query validator
- REST client infrastructure

### Required Changes

**Files to Modify**:
1. `scripts/falkordb-rest-api.js` - Lines 14-23 (CORS/auth), 103-127 (params)
2. `src/lib/graph/rest-client.js` - Line 85 (add auth header)
3. `src/services/cypher-generator.js` - Lines 546-552 (indexed query)
4. `migrations/XXXX_add_normalized_user_id.sql` - New migration file

**Environment Variables**:
- `FALKORDB_REST_API_KEY` - Generate secure random key

**D1 Schema Changes**:
- Add `user_id_normalized` column to `entity_cache`
- Create index on `(user_id_normalized, canonical_name)`

---

## Rollback Plan

### If P0 Fixes Break Production

**Cypher Injection Fix**:
- Rollback: Revert `falkordb-rest-api.js` to previous version
- Impact: Re-introduces injection vulnerability (HIGH RISK)
- Alternative: Debug parameter format, check FalkorDB docs
- Testing: Verify with simple query before complex ones

**Authentication Changes**:
- Rollback: Remove auth middleware, restore wildcard CORS
- Impact: Re-introduces cross-site data theft (HIGH RISK)
- Alternative: Bind REST API to `127.0.0.1` only (local-only access)
- Testing: Test with/without auth header

**UUID Index**:
- Rollback: Revert query to use `REPLACE(user_id, '-', '')`
- Impact: Performance degrades (MEDIUM RISK, not security)
- Alternative: Add LIMIT 100 to reduce memory usage
- Testing: Monitor query times and timeout rates

**Migration Issues**:
- Rollback: Drop `user_id_normalized` column and index
- Impact: No data loss, just performance regression
- Alternative: Rebuild index if corrupted
- Testing: Verify index exists, check query plans

---

## After This Spec

### Immediate Next Steps

Once P0 security fixes are complete:

1. **Re-run Security Audit** (1 hour):
   - Verify all P0 issues resolved
   - Update audit document with verification
   - Document remaining P1/P2 issues

2. **Resume Frontend Deployment** (Feature 011):
   - Previous NEXT_SPEC.md archived
   - Now safe to deploy frontend
   - CORS configured for Pages domain
   - Authentication ready for UI integration

3. **Production Deployment** (2-4 hours):
   - Deploy security fixes to production
   - Run security test suite
   - Monitor for 24 hours
   - Green light for beta testing

---

### P1 Fixes (Optional, After Frontend)

**Rate Limiting** (3-4 hours):
- Add express-rate-limit middleware
- Implement KV-based rate limiting for Workers
- Query complexity checks

**Entity Resolution Optimization** (2-3 hours):
- Cache resolution results in KV
- Implement server-side LIKE search
- Further reduce fuzzy match candidates

---

### P2 Fixes (Phase 4)

**Error Handling** (2-3 hours):
- Structured logging (Winston)
- Generic error responses
- Error ID tracking

**Input Sanitization** (2-3 hours):
- Question validation (length, charset)
- Suspicious pattern detection
- Semantic validation

---

## References

### Audit Documentation

- **Security Audit**: [docs/graph-query-audit.md](../graph-query-audit.md)
  - Critical findings with CVSS scores
  - Attack vectors and exploit examples
  - Prioritized action items (P0/P1/P2)
  - Code examples for fixes

### PRD Documentation

- **Phase 3 Status**: [docs/PRD/README_PRD.md](./README_PRD.md#-current-status)
- **Requirements**: [docs/PRD/REQUIREMENTS-PRD.md](./REQUIREMENTS-PRD.md)
- **Phase 4 (Next)**: [docs/PRD/phases/phase-4-polish.md](./phases/phase-4-polish.md)

### Technical Documentation

- **Database Schema**: [docs/PRD/technical/database-schemas.md](./technical/database-schemas.md)
- **API Specs**: [docs/PRD/technical/api-specifications.md](./technical/api-specifications.md)
- **FalkorDB Setup**: [docs/FALKORDB_TUNNEL.md](../FALKORDB_TUNNEL.md)

### Related Specs

- **Archived**: Frontend Deployment (deferred until after P0 fixes)
- **Feature 008**: Voice Query Input (deployed)
- **Feature 009**: Answer Generation (ready)
- **Feature 010**: TTS Responses (deployed)

---

## FAQ

### Why is this more urgent than frontend?

**Answer**: The audit revealed CRITICAL vulnerabilities that make the application unsafe for ANY deployment:
- Cross-site data theft allows any website to steal user data
- Cypher injection enables arbitrary code execution
- Performance issues cause timeouts and service outages

Deploying frontend now would expose these vulnerabilities to users, creating unacceptable security and stability risks.

### Can we do both in parallel?

**Answer**: No. The security fixes modify core infrastructure (REST API, database queries) that frontend depends on. Frontend deployment requires:
- CORS configuration (part of P0 fixes)
- Authentication system (part of P0 fixes)
- Stable backend performance (part of P0 fixes)

Attempting parallel work would create merge conflicts and require extensive retesting.

### How long will this delay frontend?

**Answer**: 6-10 hours for P0 fixes, then frontend can resume. Total project timeline impact: 1-2 days. This is acceptable given the severity of the vulnerabilities.

### What if we skip the index fix?

**Answer**: Performance would degrade exponentially as users add entities:
- 1,000 entities: 200ms queries (slow but usable)
- 10,000 entities: 2,000ms queries (timeout risk)
- 100,000 entities: Service crash

The index fix is critical for long-term viability and must be done before beta testing.

### Can we deploy frontend to local dev only?

**Answer**: Even local development is unsafe:
- CORS wildcard allows cross-site attacks from ANY website
- No authentication means any process can query the database
- Injection vulnerabilities affect all environments

P0 fixes are required for ANY deployment, including local development.

---

**Ready to start?** Yes - All prerequisites met, clear implementation path, urgent priority.

**Estimated completion**: 6-10 hours (1-2 days)

**Next after this**: Resume frontend deployment (Feature 011) with security hardening complete.
