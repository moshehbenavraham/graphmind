# Next Spec: Security Hardening - Validation & Deployment

> **✅ COMPLETED**: This NEXT_SPEC was converted to [Spec 013 (Security Validation)](../../specs/013-security-validation/) on 2025-11-24.
> **Archived**: Moved to archive after spec creation completed.
> **Status**: Specification created and ready for implementation via `/design` and `/tasks`.

**Phase**: Phase 3.5 - Security Critical (Completion)
**Priority**: P0 (Production Blocker - Final Steps)
**Estimated Context**: ~12,000 tokens
**Dependencies**: Security fixes implemented (specs/012-security-hardening)
**Status**: ✅ Converted to Spec 013
**Previous**: [Archived - Implementation Phase Complete](./NEXT_SPEC_security-hardening-implementation_20251124.md)

---

## What We're Building

The final validation and deployment preparation phase for the Security Hardening feature. This spec covers integration testing, security audit verification, documentation updates, and deployment preparation for the three P0 security fixes that were implemented in spec 012.

**Core Security Fixes (Already Implemented in spec 012)**:
1. ✅ Cypher Injection Prevention (CVSS 9.1) - Native parameterization
2. ✅ Cross-Site Data Theft Prevention (CVSS 8.6) - API authentication + CORS restrictions  
3. ✅ Performance Optimization (CVSS 7.5) - Indexed database queries

**This Spec Covers (Remaining 63 tasks from spec 012)**:
- Integration testing of all fixes together
- Security audit verification
- Documentation updates (SETUP.md, DEPLOY.md, TESTING.md, CHANGELOG.md)
- Production deployment preparation
- Performance validation

---

## Why This Next

The core security fixes (query injection prevention, authentication/CORS, performance optimization) have been implemented and unit tested in spec 012. Before deploying to production, we need to:

- Verify all fixes work together in an integrated environment
- Re-run the comprehensive security audit to confirm vulnerability resolution
- Document setup, deployment, and testing procedures
- Prepare production deployment checklist and rollback procedures

This is the final gate before production deployment and frontend beta testing.

---

## Scope (Single Context Window)

**Included**:
- Integration testing of all three security fixes together
- Re-running original security audit tests
- Documentation updates (SETUP.md, DEPLOY.md, TESTING.md, CHANGELOG.md)
- Production deployment preparation and checklists
- Performance validation with production-scale data
- Validation.md generation for /validate command

**Explicitly Excluded** (already complete in spec 012):
- Security fix implementation (query parameterization, auth, indexes)
- Unit testing of individual fixes
- Test script creation

**Estimated Tokens**: ~12,000 tokens (documentation and testing, not implementation)

---

## User Stories (for this spec)

### Story 1: Validate Security Fixes in Production-Like Environment (P0)

**As a** platform operator  
**I want** all security fixes validated together in an integrated environment  
**So that** I can confidently deploy to production knowing the system is secure

**Acceptance Criteria**:
- [ ] All services running together (FalkorDB, REST API, Workers)
- [ ] End-to-end voice query flow works with security enabled
- [ ] Injection attacks blocked at all layers
- [ ] Performance remains within targets with security overhead
- [ ] No regression in existing functionality

---

### Story 2: Complete Security Audit Verification (P0)

**As a** security auditor  
**I want** comprehensive verification that all P0 vulnerabilities are resolved  
**So that** the system meets production security standards

**Acceptance Criteria**:
- [ ] All tests from docs/graph-query-audit.md pass
- [ ] P0 vulnerabilities (CVSS 9.1, 8.6, 7.5) confirmed resolved
- [ ] Test results documented in validation.md
- [ ] No new vulnerabilities introduced

---

### Story 3: Document Deployment Procedures (P0)

**As a** developer deploying to production  
**I want** clear documentation of setup, deployment, and rollback procedures  
**So that** production deployment is safe and repeatable

**Acceptance Criteria**:
- [ ] API key generation documented in SETUP.md
- [ ] Secret configuration documented in DEPLOY.md
- [ ] Security testing procedures in TESTING.md
- [ ] CHANGELOG.md updated with security fixes
- [ ] Deployment checklist created
- [ ] Rollback procedures documented

---

## Technical Approach

This spec focuses on validation and documentation rather than new implementation.

### Integration Testing Approach

1. **Local Environment Setup**:
   - FalkorDB Docker container on localhost:6380
   - REST API server on localhost:3001
   - Workers dev server on localhost:8787
   - All three services communicating with security enabled

2. **End-to-End Testing**:
   - Voice query → STT → Entity extraction → Graph query → Answer generation → TTS
   - Injection payloads tested via Workers API (not just REST API directly)
   - Large knowledge graph queries (1,000+ entities) to verify performance

3. **Security Validation**:
   - Re-run all 13 injection tests from tests/security/injection-tests.js
   - Re-run all 14 auth/CORS tests from tests/security/auth-tests.js
   - Verify test results match expected outcomes

### Documentation Updates

1. **SETUP.md**:
   - Add section on FALKORDB_REST_API_KEY generation
   - Document environment variable configuration
   - Include fail-safe checking procedures

2. **DEPLOY.md**:
   - Add D1 migration steps
   - Document wrangler secret configuration
   - Include production checklist

3. **TESTING.md**:
   - Document security test execution
   - Include expected results
   - Add troubleshooting guide

4. **CHANGELOG.md**:
   - Document all three P0 fixes
   - Include CVSS scores and impact
   - Reference security audit

### Performance Validation

Run benchmarks with production-scale data:
- 100 entities (baseline)
- 1,000 entities (typical user)
- 10,000 entities (power user)
- 100,000 entities (stress test)

Document performance improvements and compare to targets.

---

## Implementation Steps

### Phase 1: Integration Testing (T100-T108)

1. Start all services (FalkorDB, REST API, Workers)
2. Test end-to-end voice query flow
3. Verify entity resolution works with optimizations
4. Test injection payloads via Workers API
5. Verify authenticated requests succeed
6. Test with large knowledge graphs

### Phase 2: Security Audit Verification (T110-T115)

1. Re-run injection tests from security audit
2. Re-run CORS tests from security audit
3. Re-run performance tests from security audit
4. Document all test results in validation.md
5. Confirm P0 vulnerabilities resolved
6. Verify no regression

### Phase 3: Documentation (T120-T125)

1. Update SETUP.md with API key generation
2. Update DEPLOY.md with deployment procedures
3. Add security testing section to TESTING.md
4. Document CORS configuration for production
5. Add migration rollback procedure
6. Update CHANGELOG.md

### Phase 4: Deployment Preparation (T130-T136)

1. Test REST API startup scenarios (missing/valid key)
2. Generate production API key
3. Verify migration works on production database
4. Test Workers deployment with secrets
5. Create deployment checklist
6. Document rollback procedures

### Phase 5: Performance Validation (T140-T145)

1. Benchmark with 100, 1K, 10K, 100K entities
2. Compare before/after metrics
3. Document performance improvements
4. Verify all targets met

---

## Success Criteria

### Integration Testing
- [ ] All services start successfully with security enabled
- [ ] End-to-end voice query completes in <5s
- [ ] Injection attacks return safe results (not all data)
- [ ] Performance within targets (<100ms entity resolution for 10K entities)

### Security Audit
- [ ] 100% of P0 vulnerabilities resolved
- [ ] All injection tests pass (13/13)
- [ ] All auth/CORS tests pass (14/14)
- [ ] Test results documented

### Documentation
- [ ] Setup instructions complete and tested
- [ ] Deployment procedures documented with checklists
- [ ] Security testing procedures documented
- [ ] CHANGELOG updated

### Deployment Readiness
- [ ] Production API key generated
- [ ] Migration tested on production database
- [ ] Deployment checklist validated
- [ ] Rollback procedures documented and tested

### Performance
- [ ] 100 entities: <50ms
- [ ] 1,000 entities: <50ms
- [ ] 10,000 entities: <100ms
- [ ] 100,000 entities: <500ms
- [ ] Metrics documented in validation.md

---

## Task List (63 tasks remaining from spec 012)

### Integration Testing (9 tasks)
- T100-T108: Start services, test end-to-end, verify performance

### Security Audit Verification (6 tasks)
- T110-T115: Re-run tests, document results, confirm resolution

### Documentation (6 tasks)
- T120-T125: Update SETUP, DEPLOY, TESTING, CHANGELOG

### Deployment Preparation (7 tasks)
- T130-T136: Test scenarios, create checklists, document rollback

### Performance Validation (6 tasks)
- T140-T145: Benchmark, compare metrics, document improvements

**Total**: 34 Final Phase tasks + 29 other remaining tasks = 63 tasks
**Estimated Time**: 3-4 hours

---

## Next After This

Once this validation/deployment spec is complete:

1. **Deploy to Production**:
   - Apply D1 migration
   - Set wrangler secrets
   - Deploy Workers
   - Restart REST API with authentication

2. **Resume Frontend Development** (spec 011):
   - Frontend deployment was deferred for security fixes
   - Can now safely deploy UI with secure backend
   - Begin beta testing with real users

3. **Phase 4: Polish & Optimization** (future specs):
   - Rate limiting (P1)
   - Advanced logging (P2)
   - Query complexity analysis (P1)
   - Additional security hardening (P2)

---

## References

- **Previous Spec**: [specs/012-security-hardening](../../specs/012-security-hardening/)
- **Security Audit**: [docs/graph-query-audit.md](../graph-query-audit.md)
- **PRD Phase**: Phase 3 - Voice Query System (security critical path)
- **Deferred Spec**: [specs/011-frontend-deployment](../../specs/011-frontend-deployment/) (resume after this)

---

## Notes

**Why This is Separate from Spec 012**:

The original security hardening spec (012) covered:
- Implementation of three P0 security fixes
- Unit testing of individual components
- 82 tasks completed

This spec (013) covers:
- Integration testing of all fixes together
- Comprehensive security audit verification
- Production documentation and deployment preparation
- 63 remaining tasks from original 145

Splitting allows:
- Clean completion of implementation phase
- Focused validation and documentation phase
- Clear gate before production deployment
- Easier tracking of what's code vs. what's validation

**Created**: 2025-11-24
**Token Estimate**: ~12,000 tokens (documentation and testing, not implementation)
**Blocks**: Frontend deployment (spec 011), Beta testing
