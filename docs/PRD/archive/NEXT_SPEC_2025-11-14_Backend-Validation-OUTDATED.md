# Next Spec: Backend Validation & Deployment (Features 008-009)

**Phase**: Phase 3 - Voice Query System (Deployment & Validation)
**Priority**: P0 (CRITICAL - Blocks Frontend Deployment)
**Estimated Context**: ~12,000 tokens
**Dependencies**: Features 008-010 implementation complete (needs deployment/validation)
**Status**: Ready to Execute

---

## What We're Building

Complete the deployment and validation of the backend voice query system (Features 008 & 009) before frontend deployment. This ensures the backend API is fully functional, tested, and production-ready to support the upcoming frontend deployment.

## Why This Next

**Critical Blockers Identified:**
- **Feature 008 (Voice Query Input)** has **P1 blockers** preventing reliable frontend integration:
  - E2E tests created but not executed (14 test files, 4-6 hours needed)
  - Production infrastructure not configured (secrets, environment variables)
  - D1 migrations not applied to production database
  - Deployment readiness score: **62/100** (NOT READY)

- **Feature 009 (Answer Generation)** is implementation-complete but **NOT DEPLOYED**:
  - D1 migration must be applied to production
  - Deployment score: **92/100** (READY, just needs deployment)
  - ~1 hour from production-ready

- **Feature 010 (TTS)** is already **✅ DEPLOYED and LIVE** since 2025-11-14

**Strategic Reason:**
Deploying frontend now would result in:
- WebSocket connection errors (Feature 008 not validated)
- Missing answer generation endpoints (Feature 009 not deployed)
- CORS errors (not configured for Pages origin)
- Wasted frontend development effort on non-functional backend

**After Backend Validation:**
- Frontend can deploy with confidence (no backend surprises)
- End-to-end testing possible
- Complete voice query → answer → TTS flow validated
- Lower risk, faster frontend development

---

## Scope (Single Context Window)

**Included**:
- Feature 008 E2E testing (WebSocket, voice query flow, Cypher generation)
- Feature 008 production deployment (secrets, D1 migrations, infrastructure)
- Feature 009 production deployment (D1 migration, deployment, smoke tests)
- Backend API validation (complete voice query → answer → TTS flow)
- CORS configuration for future frontend deployment
- Production monitoring setup (health checks, error tracking)
- Backend API documentation with working examples

**Explicitly Excluded** (for later specs):
- Frontend deployment (next NEXT_SPEC after this completes)
- Frontend build system (Vite, React Router)
- Authentication UI components
- Graph visualization
- Advanced monitoring/analytics

**Estimated Tokens**: ~12,000 tokens

---

## User Stories (for this spec)

### Story 1: Backend Voice Query System Fully Validated (P0)
As a developer deploying the frontend, I need the backend voice query system fully tested and validated so that I can confidently integrate the frontend without encountering backend errors.

**Acceptance Criteria**:
- [ ] All 14 E2E tests executed and passing
- [ ] WebSocket connection flow validated (authentication, voice data streaming, transcription)
- [ ] Cypher query generation tested with 20+ example queries
- [ ] Answer generation tested with various query types (entity, relationship, temporal, count, list)
- [ ] TTS integration validated (text → audio generation → streaming)
- [ ] Error handling tested (network failures, invalid queries, empty results)
- [ ] Performance benchmarks met (<2s transcription, <500ms queries, <2s answers)

---

### Story 2: Features 008-009 Deployed to Production (P0)
As a user of GraphMind, I want the voice query system available in production so I can ask questions and receive answers via the API.

**Acceptance Criteria**:
- [ ] Feature 008 deployed to production Workers
- [ ] Feature 009 deployed to production Workers
- [ ] D1 migrations applied to production database (voice_queries table)
- [ ] Production secrets configured (JWT_SECRET, FALKORDB credentials, etc.)
- [ ] Environment variables set correctly
- [ ] Health check endpoint returns 200 OK
- [ ] Smoke tests pass on production URL

---

### Story 3: Backend API Ready for Frontend Integration (P1)
As a frontend developer, I need clear API documentation and working examples so I can integrate the voice query UI quickly.

**Acceptance Criteria**:
- [ ] API endpoints documented with request/response examples
- [ ] WebSocket protocol documented (events, message formats)
- [ ] CORS configured for Cloudflare Pages origin
- [ ] Authentication flow documented (JWT tokens, protected routes)
- [ ] Error response formats documented
- [ ] cURL/Postman examples for all endpoints
- [ ] Working example of complete voice query flow

---

## Technical Approach

### Phase 1: Feature 008 E2E Testing (4-6 hours)

**Objective**: Execute and validate all WebSocket and voice query flows

**Tests to Execute** (14 test files created, not yet run):
1. **WebSocket Connection Tests**:
   - `tests/e2e/websocket-connection.test.js`
   - Authentication via JWT query parameter
   - Connection upgrade (HTTP → WebSocket)
   - Reconnection logic on disconnect

2. **Voice Recording Tests**:
   - `tests/integration/phase3-voice-recording.test.js`
   - Audio chunk streaming
   - Real-time transcription display
   - Stop recording event

3. **Query Execution Tests**:
   - `tests/integration/phase4-query-execution.test.js`
   - Cypher query generation (template matching + LLM fallback)
   - Two-tier LLM fallback (Llama 3.1 → DeepSeek R1)
   - Query execution on FalkorDB
   - Result formatting

4. **Answer Generation Tests**:
   - `tests/integration/answer-generation-comprehensive.test.js`
   - 5 answer types (entity, relationship, temporal, count, list)
   - Hallucination detection
   - Source citation extraction
   - Empty result handling

5. **Performance Tests**:
   - `tests/performance/query-latency.test.js`
   - Transcription latency (<2s target)
   - Query execution (<500ms target)
   - Answer generation (<2s target)

6. **Edge Cases**:
   - `tests/integration/edge-cases.test.js`
   - Invalid queries
   - Empty knowledge graphs
   - Network failures
   - Concurrent queries

**Testing Infrastructure**:
```bash
# Install test dependencies (if not already installed)
npm install --save-dev @playwright/test ws

# Run E2E tests
npm run test:e2e

# Run integration tests
npm run test:integration

# Run performance tests
npm run test:performance
```

**Success Criteria**:
- All 14 test files execute successfully
- 0 P0 test failures
- Performance benchmarks met
- Edge cases handled gracefully

---

### Phase 2: Feature 008 Production Deployment (1-2 hours)

**Objective**: Deploy Feature 008 to production with all required infrastructure

**Steps**:

1. **Configure Production Secrets** (15 minutes):
```bash
# Set JWT secret
npx wrangler secret put JWT_SECRET

# Set FalkorDB credentials (if using cloud)
npx wrangler secret put FALKORDB_PASSWORD

# Verify secrets
npx wrangler secret list
```

2. **Apply D1 Migrations** (15 minutes):
```bash
# Check migration status
npx wrangler d1 migrations list graphmind-db --env production

# Apply pending migrations
npx wrangler d1 migrations apply graphmind-db --env production

# Verify tables exist
npx wrangler d1 execute graphmind-db --env production --command "SELECT name FROM sqlite_master WHERE type='table';"
```

3. **Deploy to Production** (15 minutes):
```bash
# Deploy Worker with Durable Objects
npx wrangler deploy

# Verify deployment
curl https://graphmind-api.apex-web-services-llc-0d4.workers.dev/api/health
```

4. **Run Production Smoke Tests** (30 minutes):
```bash
# Test WebSocket connection
node tests/smoke/websocket-connect.js

# Test voice query flow
node tests/smoke/voice-query-flow.js

# Test answer generation
node tests/smoke/answer-generation.js
```

**Success Criteria**:
- Deployment completes without errors
- Health check returns 200 OK
- Smoke tests pass on production URL
- No CORS errors in browser console

---

### Phase 3: Feature 009 Deployment (1 hour)

**Objective**: Deploy answer generation to production

**Steps**:

1. **Apply D1 Migration** (15 minutes):
```bash
# Migration file: migrations/0005_voice_queries.sql
# Adds: voice_queries.answer column
npx wrangler d1 migrations apply graphmind-db --env production --local=false

# Verify column exists
npx wrangler d1 execute graphmind-db --env production --command "PRAGMA table_info(voice_queries);"
```

2. **Deploy Updated Worker** (15 minutes):
```bash
# Feature 009 code already in src/services/answer-generator.js
# Just need to deploy
npx wrangler deploy
```

3. **Run Answer Generation Tests** (30 minutes):
```bash
# Test 5 answer types
node tests/smoke/answer-types.js

# Test hallucination detection
node tests/smoke/hallucination-detection.js

# Test source citations
node tests/smoke/source-citations.js

# Test empty results
node tests/smoke/empty-results.js
```

**Success Criteria**:
- D1 migration applied successfully
- Answer generation endpoint responds
- All answer types work correctly
- No hallucinations in test cases

---

### Phase 4: Backend Validation (2 hours)

**Objective**: Validate complete end-to-end backend flow

**Manual Testing Checklist**:

1. **Voice Query Flow** (30 minutes):
   - Start WebSocket connection (authenticated)
   - Stream audio chunks
   - Receive real-time transcription
   - Stop recording
   - Receive Cypher query
   - Receive graph results
   - Receive natural language answer
   - Receive TTS audio URL

2. **Query Types** (30 minutes):
   - Entity query: "Who is Sarah?"
   - Relationship query: "Who have I met this month?"
   - Temporal query: "What did I discuss last week?"
   - Count query: "How many projects am I working on?"
   - List query: "Show me all Python projects"

3. **Error Handling** (30 minutes):
   - Invalid authentication (no JWT)
   - Empty knowledge graph (no data)
   - Malformed audio data
   - Network disconnect/reconnect
   - LLM API failures (test fallback)

4. **Performance Benchmarks** (30 minutes):
   - Measure transcription latency (target: <2s)
   - Measure query execution (target: <500ms)
   - Measure answer generation (target: <2s)
   - Measure TTS generation (target: <1s)
   - Measure end-to-end latency (target: <6s total)

**Success Criteria**:
- Complete flow works end-to-end
- All query types return correct results
- Error handling graceful
- Performance targets met

---

### Phase 5: CORS Configuration (30 minutes)

**Objective**: Configure backend CORS for future frontend deployment

**Update src/index.js**:
```javascript
const allowedOrigins = [
  'http://localhost:5173',              // Vite dev server
  'http://localhost:3000',              // Alternative dev port
  'https://graphmind.pages.dev',        // Cloudflare Pages production
  'https://graphmind-*.pages.dev',      // Preview deployments (use regex)
];

function corsHeaders(request) {
  const origin = request.headers.get('Origin');

  // Check if origin is allowed
  const isAllowed = allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      const regex = new RegExp(allowed.replace('*', '.*'));
      return regex.test(origin);
    }
    return origin === allowed;
  });

  if (!isAllowed) {
    return {}; // No CORS headers for disallowed origins
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

// Apply to all responses
export default {
  async fetch(request, env, ctx) {
    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    // Handle actual request
    const response = await handleRequest(request, env, ctx);

    // Add CORS headers to response
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders(request)).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  }
}
```

**Test CORS**:
```bash
# Test OPTIONS preflight
curl -X OPTIONS https://graphmind-api.apex-web-services-llc-0d4.workers.dev/api/query/start \
  -H "Origin: https://graphmind.pages.dev" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization"

# Expected: 204 No Content with CORS headers
```

**Success Criteria**:
- OPTIONS requests return 204 with CORS headers
- Allowed origins accepted
- Disallowed origins rejected
- WebSocket upgrade includes CORS headers

---

### Phase 6: Documentation (1 hour)

**Objective**: Document backend API for frontend developers

**Create docs/API_REFERENCE.md**:

```markdown
# GraphMind Backend API Reference

## Authentication

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

### Get Token
POST /api/auth/login
```

**Include**:
- All REST endpoints with request/response examples
- WebSocket protocol documentation
- Event types and message formats
- Error response codes
- Rate limiting rules
- CORS configuration
- Example cURL commands
- Postman collection (export)

**Success Criteria**:
- Documentation complete and accurate
- Examples tested and working
- Frontend developers can use without questions

---

## Implementation Steps

### Day 1: Testing & Validation (4-6 hours)

1. **Set up test environment** (30 minutes):
   - Install Playwright, WebSocket client
   - Configure test database
   - Set up test user accounts

2. **Execute E2E tests** (2-3 hours):
   - Run all 14 test files
   - Fix any P0 failures
   - Document P1/P2 issues for later

3. **Manual validation** (2 hours):
   - Test complete voice query flow
   - Test all 5 query types
   - Test error handling
   - Benchmark performance

4. **Document test results** (30 minutes):
   - Create test report
   - List any issues found
   - Confirm readiness for deployment

---

### Day 2: Deployment (2-3 hours)

1. **Deploy Feature 008** (1 hour):
   - Configure secrets
   - Apply D1 migrations
   - Deploy Worker
   - Run smoke tests

2. **Deploy Feature 009** (1 hour):
   - Apply D1 migration
   - Deploy Worker
   - Run answer generation tests

3. **Production validation** (1 hour):
   - Test complete flow on production
   - Verify performance
   - Monitor logs for errors
   - Run smoke tests

---

### Day 3: CORS & Documentation (2 hours)

1. **Configure CORS** (30 minutes):
   - Update src/index.js
   - Deploy changes
   - Test with curl

2. **Write API documentation** (1 hour):
   - Document all endpoints
   - Create cURL examples
   - Export Postman collection

3. **Final validation** (30 minutes):
   - Run full test suite one more time
   - Confirm all systems green
   - Mark features as production-ready

---

## Success Criteria

**Feature 008 Validation**:
- [ ] All 14 E2E tests passing
- [ ] WebSocket flow validated end-to-end
- [ ] Performance benchmarks met (<2s transcription, <500ms queries)
- [ ] Error handling tested and working
- [ ] Deployed to production successfully
- [ ] Production smoke tests passing

**Feature 009 Deployment**:
- [ ] D1 migration applied to production
- [ ] Answer generation endpoint live
- [ ] All 5 answer types working correctly
- [ ] Hallucination detection active
- [ ] Source citations included in responses
- [ ] Production smoke tests passing

**Backend API Readiness**:
- [ ] Complete voice query → answer → TTS flow validated
- [ ] CORS configured for Pages origin
- [ ] API documentation complete with examples
- [ ] Health check endpoint returns 200 OK
- [ ] No P0 issues in production
- [ ] Production monitoring active

**Quality Checks**:
- [ ] No secrets hardcoded (all in environment)
- [ ] All production migrations applied
- [ ] Rate limiting active
- [ ] Error logging working
- [ ] Performance monitoring active
- [ ] Security audit passed

---

## Next After This

Once backend validation and deployment are complete, the next logical step is:

**Feature 011: Frontend Deployment to Cloudflare Pages**
- Build system setup (Vite, React Router)
- Authentication UI (login, register, protected routes)
- Integration of existing React components
- Deployment to Cloudflare Pages
- End-to-end testing

**Estimated Timeline**: 18-24 hours (after backend is validated)

---

## References

**Validation Reports**:
- [Feature 008 Validation](../../specs/008-voice-query-input/validation.md) - Current status: 62/100, needs testing
- [Feature 009 Validation](../../specs/009-answer-generation/validation.md) - Current status: 92/100, ready to deploy
- [Feature 010 Validation](../../specs/010-tts-responses/validation.md) - Current status: DEPLOYED ✅

**Technical Docs**:
- [API Specifications](./technical/api-specifications.md)
- [Database Schemas](./technical/database-schemas.md)
- [FalkorDB Deployment](./technical/falkordb-deployment.md)

**Test Files**:
- `tests/e2e/` - End-to-end WebSocket tests
- `tests/integration/` - Integration tests for Features 008-009
- `tests/performance/` - Performance benchmarks
- `tests/smoke/` - Production smoke tests

---

## Risk Mitigation

**Risk**: E2E tests reveal P0 issues
**Mitigation**: Fix issues before deploying frontend (better to find now than after frontend deployment)

**Risk**: Production deployment fails
**Mitigation**: Deploy to staging environment first, test thoroughly, then promote to production

**Risk**: Performance targets not met
**Mitigation**: Optimize query execution, enable caching, consider connection pooling adjustments

**Risk**: CORS configuration blocks frontend
**Mitigation**: Test CORS with curl before frontend deployment, allow localhost for development

---

## Timeline Estimate

**Conservative**: 7-8 hours (1 full day of focused work)
**Optimistic**: 5-6 hours (if tests pass cleanly)

**Breakdown**:
- Testing & validation: 4-6 hours
- Deployment: 2-3 hours
- CORS & documentation: 1-2 hours

**Note**: This estimate assumes no major P0 issues found during testing. If critical bugs are discovered, add 4-8 hours for fixes and retesting.

---

**Ready to validate and deploy the backend! This unblocks frontend development with confidence. 🚀**
