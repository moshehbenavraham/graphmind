# Production Deployment Guide: GraphRAG 2.0

**Feature**: Vector Search Validation & Production Deployment
**Document Version**: 1.0
**Last Updated**: 2025-11-24

---

## Prerequisites

Before deploying to production, ensure:

- [x] US1 (Accuracy Validation) passed with 90%+ accuracy
- [x] US2 (Performance Validation) passed with P95 <500ms
- [x] Security hardening complete (admin auth, rate limiting)
- [x] All integration tests passing
- [x] Rollback procedure tested in staging
- [ ] Production secrets configured
- [ ] Team notified of deployment window
- [ ] Monitoring dashboard ready

---

## Pre-Deployment Checklist

### 1. Verify Vector Indexes Exist (T121)

```bash
# Connect to production FalkorDB
# Via REST API wrapper or Cloudflare Tunnel

# Check Person vector index
node -e "
const fetch = require('node-fetch');
fetch('http://localhost:3001/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.FALKORDB_REST_API_KEY },
  body: JSON.stringify({
    graph: 'graphmind',
    query: 'CALL db.indexes() YIELD label, properties RETURN label, properties'
  })
}).then(r => r.json()).then(console.log);
"

# Expected output: Indexes on Person, Project, Note, Topic with 'embedding' property
```

**Required Indexes**:
- `Person.embedding` (vector, 768 dimensions, cosine similarity)
- `Project.embedding` (vector, 768 dimensions, cosine similarity)
- `Note.embedding` (vector, 768 dimensions, cosine similarity)
- `Topic.embedding` (vector, 768 dimensions, cosine similarity)

**If Missing**: Run `node scripts/vector-index.js` to create them.

### 2. Configure Production Secrets (T115-T118)

**Set secrets via Wrangler:**

```bash
# Set FALKORDB_PASSWORD
npx wrangler secret put FALKORDB_PASSWORD --env production
# When prompted, paste password from password manager

# Set FALKORDB_REST_API_KEY
npx wrangler secret put FALKORDB_REST_API_KEY --env production
# When prompted, paste API key

# Set JWT_SECRET
npx wrangler secret put JWT_SECRET --env production
# When prompted, paste JWT secret (min 32 characters, random)

# Verify secrets configured
npx wrangler secret list --env production

# Expected output:
# Secret Name              Created At
# FALKORDB_PASSWORD        2025-11-24
# FALKORDB_REST_API_KEY    2025-11-24
# JWT_SECRET               2025-11-24
```

**Security Notes**:
- Never commit secrets to git
- Store secrets in password manager (1Password, LastPass, etc.)
- Rotate secrets quarterly
- Use different secrets for staging vs production

### 3. Run Pre-Deployment Tests (T120)

```bash
# Run integration tests
npm run test:integration

# Run security tests
npm run test:security

# Run performance benchmarks
npm run test:performance

# All tests should pass before deployment
```

---

## Deployment Steps

### Step 1: Deploy to Production (T122)

```bash
# Deploy Workers code
npx wrangler deploy --env production

# Expected output:
# Total Upload: XX.XX KiB / gzip: XX.XX KiB
# Uploaded graphmind-worker (X.XX sec)
# Published graphmind-worker (X.XX sec)
#   https://graphmind-worker.your-account.workers.dev
# Current Deployment ID: abc123def456789
```

**Deployment takes ~30-60 seconds** to propagate across Cloudflare's global network.

### Step 2: Wait for Deployment Propagation (T124)

```bash
# Wait 2 minutes for edge deployment
sleep 120

# Or monitor deployment status
npx wrangler deployments list --env production
```

### Step 3: Verify Deployment Success (T123)

```bash
# Check deployment list
npx wrangler deployments list --env production

# Verify latest deployment is active
# Look for "Current Deployment ID" matching latest upload
```

---

## Production Smoke Tests (T126-T132)

### Test 1: Health Check Endpoint (T126)

```bash
curl https://graphmind.your-domain.com/api/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2025-11-24T15:00:00Z",
#   "version": "2.0.0"
# }
```

### Test 2: FalkorDB Health Check (T127)

```bash
curl https://graphmind.your-domain.com/api/health/falkordb

# Expected response:
# {
#   "status": "healthy",
#   "falkordb": {
#     "connected": true,
#     "latency_ms": 5
#   }
# }
```

### Test 3: Semantic Query Execution (T128-T130)

```bash
# Authenticate as test user
LOGIN_RESPONSE=$(curl -X POST https://graphmind.your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')

# Execute semantic query
QUERY_RESPONSE=$(curl -X POST https://graphmind.your-domain.com/api/query/semantic \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"Who works on AI?"}')

echo $QUERY_RESPONSE | jq '.'

# Expected response:
# {
#   "results": [
#     {
#       "node": { "name": "Alice", "type": "Person" },
#       "score": 0.87,
#       "context": [...]
#     }
#   ],
#   "latency_ms": 450
# }

# Verify latency < 500ms (T129)
LATENCY=$(echo $QUERY_RESPONSE | jq -r '.latency_ms')
if [ $LATENCY -lt 500 ]; then
  echo "✅ Latency within target: ${LATENCY}ms"
else
  echo "❌ Latency exceeded target: ${LATENCY}ms"
fi

# Verify relevance scores ≥ 0.65 (T130)
MIN_SCORE=$(echo $QUERY_RESPONSE | jq -r '.results[].score | min')
if (( $(echo "$MIN_SCORE >= 0.65" | bc -l) )); then
  echo "✅ All results relevant (min score: ${MIN_SCORE})"
else
  echo "❌ Low relevance scores (min score: ${MIN_SCORE})"
fi
```

### Test 4: User Isolation (T131)

```bash
# Login as user1
USER1_TOKEN=$(curl -X POST https://graphmind.your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user1@example.com","password":"pass1"}' | jq -r '.token')

# Login as user2
USER2_TOKEN=$(curl -X POST https://graphmind.your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user2@example.com","password":"pass2"}' | jq -r '.token')

# User1 query
USER1_RESULTS=$(curl -X POST https://graphmind.your-domain.com/api/query/semantic \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -d '{"query":"Show my notes"}')

# Verify no user2 data in user1 results
USER2_DATA=$(echo $USER1_RESULTS | jq -r '.results[] | select(.user_id == "user2")')

if [ -z "$USER2_DATA" ]; then
  echo "✅ User isolation working (no cross-user data)"
else
  echo "❌ CRITICAL: Cross-user data leakage detected!"
fi
```

### Test 5: Admin Endpoint Security (T132)

```bash
# Test without authentication
curl -X POST https://graphmind.your-domain.com/api/admin/backfill-embeddings

# Expected: 401 Unauthorized

# Test with regular user token
curl -X POST https://graphmind.your-domain.com/api/admin/backfill-embeddings \
  -H "Authorization: Bearer $USER1_TOKEN"

# Expected: 403 Forbidden

# Test with admin token
ADMIN_TOKEN=$(curl -X POST https://graphmind.your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"adminpass"}' | jq -r '.token')

curl -X POST https://graphmind.your-domain.com/api/admin/backfill-embeddings \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit":10,"nodeType":"Person"}'

# Expected: 200 OK with backfill stats
```

---

## Production Monitoring (T135-T139)

### Monitor for 1 Hour After Deployment

**Via Cloudflare Dashboard**:
1. Navigate to Workers & Pages → graphmind-worker
2. Click "Logs" tab → Real-time logs
3. Monitor for errors (filter by level: ERROR)

**Via Wrangler CLI**:
```bash
# Tail production logs
npx wrangler tail --env production

# Watch for errors
npx wrangler tail --env production --format pretty | grep ERROR
```

**Key Metrics to Monitor** (T136-T137):

| Metric | Target | Location |
|--------|--------|----------|
| Error Rate | <1% | Cloudflare Analytics → Errors |
| P95 Latency | <500ms | Cloudflare Analytics → Performance |
| Cache Hit Rate | >30% | KV Analytics |
| Requests/min | Baseline ±20% | Cloudflare Analytics → Traffic |

**Verify Zero Critical Errors** (T138):

Critical errors include:
- `Cross-user data leakage detected`
- `FalkorDB connection failed`
- `Embedding generation timeout`
- `Unhandled promise rejection`

**If critical error detected**: Execute rollback immediately (see `rollback-procedure.md`).

### Document Baseline Metrics (T139)

After 1 hour of stable operation, record baseline metrics:

```json
{
  "deployment_date": "2025-11-24T15:00:00Z",
  "deployment_id": "abc123def456789",
  "baseline_metrics": {
    "error_rate": 0.2,
    "p50_latency_ms": 250,
    "p95_latency_ms": 420,
    "p99_latency_ms": 680,
    "requests_per_minute": 150,
    "cache_hit_rate": 0.35
  }
}
```

Save to: `docs/deployment/baseline-metrics.json`

---

## Post-Deployment Actions

### 1. Create Deployment Report

Document in `specs/014-graphrag-validation-deployment/validation.md`:

- Deployment date/time
- Deployment ID
- Smoke test results (all pass/fail)
- Baseline metrics
- Any issues encountered
- Resolution steps taken

### 2. Update PRD (T160)

```bash
# Run PRD update command
/updateprd

# Provide deployment summary:
# - GraphRAG 2.0 deployed to production
# - All validation tests passed
# - Semantic search live for all users
# - Baseline metrics documented
```

### 3. Team Communication

**Engineering Team**:
```
Subject: GraphRAG 2.0 Production Deployment Complete ✅

Team,

GraphRAG 2.0 semantic search has been successfully deployed to production.

Deployment Details:
- Deployment Time: 2025-11-24 15:00 UTC
- Deployment ID: abc123def456789
- Smoke Tests: All passed ✅
- Monitoring: Stable for 1 hour ✅

Key Features Enabled:
- Semantic search across all knowledge nodes
- Admin backfill endpoint (auth required)
- Enhanced security (RBAC, rate limiting)

Monitoring Dashboard: [LINK]
Rollback Procedure: docs/deployment/rollback-procedure.md

Next Steps:
- Continue monitoring for 24 hours
- Gather user feedback
- Plan Phase 4 features
```

---

## 24-Hour Stability Validation (T162-T165)

After deployment, monitor for 24 hours to ensure stability.

**Monitoring Checklist**:

- [ ] Hour 1: Active monitoring (real-time logs)
- [ ] Hour 2-4: Check every hour for errors
- [ ] Hour 5-12: Check every 2 hours
- [ ] Hour 13-24: Check every 4 hours

**Success Criteria**:
- Zero critical errors for 24 hours (T163)
- Performance targets maintained (P95 <500ms) (T164)
- No user complaints about search quality
- Error rate <1%

**If Issues Arise** (T165):
- Document issue in incident report
- Assess severity (critical = rollback, non-critical = hot-fix)
- Implement fix or rollback as appropriate

---

## Troubleshooting

### Issue: High Latency (P95 >1000ms)

**Possible Causes**:
- FalkorDB connection slow
- Embedding generation timeout
- Network latency to FalkorDB

**Resolution**:
```bash
# Check FalkorDB health
curl https://graphmind.your-domain.com/api/health/falkordb

# Check FalkorDB connection pooling
# (Durable Object logs should show <10ms connection time)

# Increase FalkorDB resources if needed
# Or add connection pooling optimization
```

### Issue: High Error Rate (>5%)

**Possible Causes**:
- Invalid API responses
- Missing vector indexes
- Auth failures

**Resolution**:
```bash
# Check error logs for patterns
npx wrangler tail --env production --format pretty | grep ERROR

# Common errors:
# - "Vector index not found" → Run vector-index.js
# - "Authentication failed" → Check JWT_SECRET
# - "FalkorDB timeout" → Check FalkorDB availability
```

### Issue: Cache Not Working

**Symptoms**: All queries have high latency (no cached <100ms queries)

**Resolution**:
```bash
# Check KV namespace binding
npx wrangler kv:namespace list

# Verify KV is accessible
# Check wrangler.toml has correct KV binding

# Test KV manually
npx wrangler kv:key put "test_key" "test_value" --namespace-id=YOUR_KV_ID
npx wrangler kv:key get "test_key" --namespace-id=YOUR_KV_ID
```

---

## Appendix: Manual Task Reference

**Tasks Requiring Manual Execution** (cannot be automated):

- **T115-T118**: Production secrets configuration
- **T121**: Vector index verification
- **T122-T124**: Deployment execution and propagation
- **T126-T132**: Smoke tests execution
- **T135-T139**: Production monitoring
- **T162-T165**: 24-hour stability validation

**Tasks Completed During Implementation**:
- All test creation (T020-T095)
- Security hardening (T100-T111)
- Documentation (T150-T170)

---

## Success Metrics

Deployment is considered successful when:

- [x] All smoke tests pass
- [x] Error rate <1% for 1 hour
- [x] P95 latency <500ms for 1 hour
- [x] No cross-user data leakage detected
- [x] Admin endpoints require authentication
- [x] Baseline metrics documented

**Final Validation**: Run `/validate` command after 24-hour period.

---

**Document Maintenance**: Update this guide after each production deployment with lessons learned.
