---
description: Validate feature completeness and deployment readiness for GraphMind
---

# Feature Validation

## User Input

```text
$ARGUMENTS
```

You **MAY** consider the user input if provided (optional focus area like "deployment" or "voice").

## Overview

This command validates that a feature is complete, tested, and ready for deployment. It checks documentation completeness, Cloudflare configuration, voice AI integration, and practical deployment readiness.

## Execution Steps

### 1. Find Feature Directory

Run the prerequisites check:
```bash
bash .workflow/scripts/check-prereqs.sh
```

Parse JSON output to get:
- `FEATURE_DIR`: Absolute path to current feature directory
- `SPEC_FILE`: Path to spec.md
- `DESIGN_FILE`: Path to design.md
- `TASKS_FILE`: Path to tasks.md

### 2. Load Context

Read all available files:
- `{SPEC_FILE}`: Requirements and success criteria
- `{DESIGN_FILE}`: Architecture and technical decisions
- `{TASKS_FILE}`: Implementation checklist
- Check for actual implementation files referenced in tasks

### 3. Run Validation Checks

Load template from `.workflow/templates/validation-template.md` and validate:

#### Section 1: Documentation Completeness

Check if all planning documents exist and are complete:

- [ ] spec.md exists and has all required sections
- [ ] design.md exists and has architecture decisions
- [ ] tasks.md exists and follows checklist format
- [ ] All tasks have file paths specified
- [ ] Success criteria are measurable and clear
- [ ] Dependencies are documented

**Output**: List any missing or incomplete documentation

#### Section 2: Implementation Completeness

Check if all tasks are completed:

- [ ] Count total tasks in tasks.md
- [ ] Count completed tasks (checked boxes)
- [ ] List any uncompleted tasks
- [ ] Verify referenced files actually exist
- [ ] Check if MVP scope (P1 stories) is complete

**Output**: Completion percentage and missing items

#### Section 3: Cloudflare Configuration

Validate Cloudflare setup:

**wrangler.toml**
- [ ] All required Workers are defined
- [ ] Durable Objects are declared (if used)
- [ ] D1 bindings are configured (if used)
- [ ] KV namespaces are bound (if used)
- [ ] R2 buckets are bound (if used)
- [ ] Environment variables are documented
- [ ] Routes are properly configured

**D1 Database**
- [ ] Migration files exist in migrations/
- [ ] Migrations are applied (check with `wrangler d1 migrations list`)
- [ ] Tables match design.md schema
- [ ] Indexes are created for performance

**KV Namespaces**
- [ ] Namespaces exist (check with `wrangler kv:namespace list`)
- [ ] Keys follow naming conventions
- [ ] TTL strategy is implemented

**R2 Buckets** (if applicable)
- [ ] Buckets exist (check with `wrangler r2 bucket list`)
- [ ] Access policies are configured
- [ ] File organization matches design

**Workers AI Models** (if voice feature)
- [ ] Deepgram models are accessible
- [ ] Llama model is configured
- [ ] Model usage is optimized (batching, caching)

**Output**: List any missing configurations

#### Section 4: FalkorDB Integration

Validate graph database setup:

**Connection**
- [ ] FalkorDB credentials in .env
- [ ] Connection test successful
- [ ] Error handling for connection failures

**Schema**
- [ ] Node types match design.md
- [ ] Relationships are properly defined
- [ ] Indexes exist for frequently queried properties
- [ ] User data isolation is implemented (namespaces)

**Queries**
- [ ] All Cypher queries from design.md are implemented
- [ ] GraphRAG SDK is integrated (v0.5+)
- [ ] Entity extraction is working
- [ ] Query caching is implemented in KV

**Output**: List any schema or query issues

#### Section 5: Voice AI Pipeline (if applicable)

Only validate if feature involves voice:

**WebRTC Connection**
- [ ] WebRTC setup in frontend
- [ ] Connection to Cloudflare Realtime Agent
- [ ] Audio codec configuration
- [ ] Network error handling (reconnection, buffering)

**Speech-to-Text**
- [ ] Deepgram Nova-3 integration
- [ ] Streaming transcription works
- [ ] Latency meets targets (<2s p95)
- [ ] Error handling for poor audio quality

**Text-to-Speech**
- [ ] Deepgram Aura integration
- [ ] Voice selection implemented
- [ ] Streaming playback works
- [ ] Latency meets targets (<1s to start)

**Entity Extraction**
- [ ] Llama 3.1 prompt engineering
- [ ] Extraction accuracy is good (manual spot check)
- [ ] Batch processing for efficiency
- [ ] Results stored in FalkorDB

**Turn Detection**
- [ ] Pipecat smart-turn-v2 configured
- [ ] Interruption handling works
- [ ] Silence thresholds tuned

**Output**: List any voice pipeline issues

#### Section 6: API Endpoints

Validate all endpoints from design.md:

For each endpoint:
- [ ] Endpoint is implemented
- [ ] Authentication works (JWT if required)
- [ ] Request validation is in place
- [ ] Response format matches design
- [ ] Error handling returns appropriate status codes
- [ ] Rate limiting is implemented
- [ ] Logging is in place

**Output**: List any endpoint issues

#### Section 7: Performance Validation

Check if performance targets from spec.md are met:

- [ ] Voice transcription latency: <2s (p95)
- [ ] Entity extraction: <3s
- [ ] Graph query: <500ms uncached, <100ms cached
- [ ] Answer generation: <2s
- [ ] TTS playback start: <1s
- [ ] Page load: <2s

**How to measure**:
1. Use `console.time()` / `console.timeEnd()` in code
2. Run manual tests with real data
3. Check Cloudflare analytics (if deployed)

**Output**: List any performance issues or untested metrics

#### Section 8: Security Checklist

Validate security measures:

- [ ] JWT tokens validated on all protected endpoints
- [ ] Password hashing uses bcrypt (cost factor 12)
- [ ] User data isolation (FalkorDB namespaces, D1 user_id filtering)
- [ ] Input validation on all endpoints
- [ ] Parameterized queries (no SQL injection)
- [ ] Rate limiting prevents abuse
- [ ] CORS configured correctly
- [ ] Secrets in .env (not hardcoded)
- [ ] Audio files encrypted in R2 (if used)

**Output**: List any security concerns

#### Section 9: Deployment Readiness

Check if ready to deploy:

**Local Testing**
- [ ] `wrangler dev` works without errors
- [ ] All features work in local development
- [ ] Environment variables in .dev.vars

**Production Prep**
- [ ] Environment variables documented
- [ ] Secrets added to Cloudflare (if production)
- [ ] D1 migrations ready for production
- [ ] KV/R2 resources created in production account
- [ ] FalkorDB production database configured

**Deployment Test**
- [ ] Can run `wrangler deploy` without errors
- [ ] Workers deploy successfully
- [ ] Durable Objects migrate successfully
- [ ] Frontend deploys to Pages

**Output**: List any deployment blockers

### 4. Generate Validation Report

Create a summary report with:

**Overall Status**: ✅ Ready / ⚠️ Issues Found / ❌ Not Ready

**Completion Metrics**:
- Documentation: X/Y complete
- Implementation: X% tasks done
- Configuration: X/Y checks passed
- Performance: X/Y targets met
- Security: X/Y checks passed
- Deployment: Ready/Not Ready

**Issues Found**: List with priority (P1 = blocker, P2 = should fix, P3 = nice to have)

**Recommendations**:
- List top 3-5 things to address before deployment
- Suggest testing approaches
- Note any technical debt or future improvements

### 5. Save Validation Report

Write the report to:
```
{FEATURE_DIR}/validation.md
```

### 6. Report Completion

Output:
```markdown
✅ Validation complete!

**Feature**: {FEATURE_NAME}
**Location**: {FEATURE_DIR}/validation.md

**Overall Status**: [Ready/Issues Found/Not Ready]

**Quick Summary**:
- Documentation: ✅ Complete
- Implementation: 85% done (3 tasks remaining)
- Cloudflare: ⚠️ Missing KV namespace
- FalkorDB: ✅ All checks passed
- Voice AI: ✅ All checks passed
- Performance: ⚠️ 2 metrics untested
- Security: ✅ All checks passed
- Deployment: ❌ Not ready (KV namespace + 3 tasks)

**Priority Issues**:
1. [P1] Create KV namespace for entity caching
2. [P1] Complete tasks T045, T047, T051
3. [P2] Test voice transcription latency
4. [P2] Test graph query performance

**Next Steps**:
{If ready}:
1. Update PRD with implementation progress: `/updateprd`
2. Generate next specification: `/nextspec`
3. Begin next feature implementation

{If issues}: Address P1 issues, then re-run `/validate`
```

## Validation Philosophy

- **Practical over perfect**: Focus on what blocks deployment, not nitpicks
- **Evidence-based**: Check actual files and configurations, not just docs
- **GraphMind-specific**: Validate voice latency, graph accuracy, edge performance
- **Security-conscious**: Never skip security checks
- **User-focused**: Validate against success criteria from spec.md, not technical checklists
