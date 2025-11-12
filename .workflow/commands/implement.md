---
description: Guide implementation of tasks with AI assistance and progress tracking
---

# Implementation Guide

## User Input

```text
$ARGUMENTS
```

You **MAY** consider the user input if provided (optional hints like "start from T042" or "focus on voice").

## Overview

This command provides either a completely automated AI Engineer or interactive implementation guidance through the task checklist. It analyzes task status, provides context from design docs, performs/guides code generation, tracks progress, and offers validation checks. Think of this as either a completely Agentic Senior Coding Engineer or an AI pair programmer working through your task list.

## CRITICAL: Command Execution Authority

**YOU WILL RUN ALL COMMANDS DIRECTLY. NO EXCEPTIONS.**

You have wrangler installed and configured. You have all necessary tools. When a task requires a command:

**EXECUTE IT IMMEDIATELY:**
- ✅ `npx wrangler deploy` - Run it
- ✅ `npx wrangler d1 migrations apply` - Run it
- ✅ `npx wrangler d1 execute` - Run it
- ✅ `npm install <package>` - Run it
- ✅ All bash scripts in the project - Run them
- ✅ Any command listed in your approved tools - Run it

**NEVER DO THIS:**
- ❌ "Since I cannot run X, you should..."
- ❌ "This modifies your account, so you need to..."
- ❌ Asking user to run commands you have tools for
- ❌ Hesitating on ANY command in your approved tools list

**YOUR APPROVED TOOLS LIST = YOUR PERMISSION TO EXECUTE**

If a command is in your tool permissions, you MUST execute it without asking. The user has already authorized you by giving you the tools.

## Execution Steps

### 1. Find Feature Directory

Run the prerequisites check:
```bash
bash .workflow/scripts/check-prereqs.sh
```

Parse JSON output to get:
- `FEATURE_DIR`: Absolute path to current feature directory
- `TASKS_FILE`: Path to tasks.md (must exist)
- `DESIGN_FILE`: Path to design.md (for architecture context)
- `SPEC_FILE`: Path to spec.md (for requirements context)

If tasks.md missing: ERROR "Run /tasks first to generate implementation checklist"

### 2. Load Context

Read all context files:
- `{TASKS_FILE}`: Task checklist with IDs, priorities, file paths
- `{DESIGN_FILE}`: Technical architecture, API contracts, data models
- `{SPEC_FILE}`: User stories, acceptance criteria, success metrics
- `/CLAUDE.md`: Project conventions, tech stack, coding standards

### 3. Analyze Task Status

Parse tasks.md to determine:

**Completion Metrics**:
- Total tasks count
- Completed tasks (checked boxes: `- [x]`)
- Remaining tasks (unchecked boxes: `- [ ]`)
- Completion percentage

**Current Position**:
- Which phase is active (Setup, Foundational, US1, US2, etc.)
- Next uncompleted task in sequence
- Tasks with `[P]` marker that could run in parallel

**Blockers**:
- Tasks that depend on incomplete prerequisites
- Missing files or configurations
- External dependencies (FalkorDB, Cloudflare resources)

### 4. Display Implementation Dashboard

Show user an overview:

```markdown
## Implementation Status: [FEATURE NAME]

**Progress**: X/Y tasks complete (Z%)

**Current Phase**: Phase 3 - User Story 1

**Recently Completed**:
- ✅ T040 Create endpoint in src/workers/api/notes.js
- ✅ T041 Add request validation
- ✅ T042 Implement response formatting

**Next Task**: T043

**Parallel Opportunities**: T045 [P], T046 [P] can be done together

**Blockers**: None
```

### 5. Interactive Task Guidance

For the next uncompleted task (or user-specified task):

#### Display Task Context

```markdown
## Current Task: T043

```
- [ ] T043 [US1] Test endpoint with manual request in src/workers/api/notes.js
```

**From Design** (design.md context):
- Endpoint: POST /api/notes/start-recording
- Authentication: JWT required
- Request: { "user_id": string }
- Response: { "session_id": string, "websocket_url": string }
- Error codes: 401 (unauthorized), 429 (rate limit)

**From Spec** (acceptance criteria):
- User can start recording with valid JWT
- Session ID is returned within 500ms
- WebSocket URL is properly formatted

**Dependencies**:
- ✅ T040: Endpoint created (completed)
- ✅ T041: Validation added (completed)
- ✅ T042: Response formatting (completed)

**File Path**: src/workers/api/notes.js
```

#### Offer Implementation Actions

Present options to the user:

1. **Generate code** - AI writes the implementation based on design.md
2. **Explain requirements** - Break down what the task needs
3. **Show related code** - Display relevant files for reference
4. **Mark complete** - Update checkbox (if already done)
5. **Skip task** - Move to next task without completing
6. **Run tests** - Execute relevant test suite
7. **Validate progress** - Check files exist, run basic checks

#### Guide Code Generation

If user chooses "Generate code":

- Reference exact file paths from task description
- Follow architecture from design.md
- Apply conventions from CLAUDE.md
- Include error handling, logging, validation
- Add comments for complex logic
- Show the complete implementation

#### Provide Testing Guidance

After implementation, suggest testing:

```markdown
**Testing T043**:

Run in terminal:
```bash
# Start local dev server
npx wrangler dev

# In another terminal, test the endpoint
curl -X POST http://localhost:8787/api/notes/start-recording \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test-user-123"}'
```

**Expected Response**:
```json
{
  "session_id": "sess_...",
  "websocket_url": "wss://..."
}
```

**Verify**:
- [ ] Response has session_id
- [ ] WebSocket URL is valid format
- [ ] Invalid JWT returns 401
- [ ] Missing user_id returns 400
```

### 6. Update Progress

After each task completion:

**Update tasks.md**:
- Change `- [ ] T043` to `- [x] T043`
- Preserve all formatting and labels

**Log to implementation-notes.md**:
- Create if doesn't exist
- Append completion log with timestamp
- Note any issues or decisions made

### 7. Create/Update Implementation Log

Maintain `{FEATURE_DIR}/implementation-notes.md`:

```markdown
# Implementation Notes: [Feature Name]

**Started**: 2025-01-10
**Last Updated**: 2025-01-10 14:30 UTC
**Progress**: 43/73 tasks (59%)

---

## Implementation Log

### 2025-01-10 - Session 1

**Completed Tasks**:
- ✅ T001: Updated wrangler.toml with D1 bindings
- ✅ T002: Created KV namespace configuration
- ✅ T003: Added environment variables to .env.example

**Decisions Made**:
- Using `graphmind-sessions` for KV namespace name
- JWT expiration set to 24 hours per CLAUDE.md

**Issues Encountered**:
- Node.js version mismatch (needed v18+)
- Resolved by updating .nvmrc

**Next Session**:
- Continue with Phase 2 foundational tasks
- Start with T010 (JWT middleware)

---

### 2025-01-10 - Session 2

**Completed Tasks**:
- ✅ T010: Verified JWT middleware exists
- ✅ T015: Created D1 migration file
- ✅ T016: Applied migration locally

**Testing Notes**:
- D1 migration successful
- Tables created: users, voice_notes, voice_queries
- Indexes added for user_id columns

**Blockers**:
- FalkorDB Cloud credentials not yet configured
- Need to create account and add to .env

**Next Session**:
- Set up FalkorDB Cloud account
- Continue with T017 (FalkorDB connection)

---

[Continue logging each session...]
```

### 8. Handle Parallel Tasks

When encountering tasks marked `[P]`:

```markdown
## Parallel Opportunities Detected

These tasks can be implemented simultaneously:
- [ ] T045 [P] [US1] Add D1 queries in src/lib/db/notes.js
- [ ] T046 [P] [US1] Add FalkorDB queries in src/lib/graph/notes.js

**Recommendation**:
Implement both together since they:
- Operate on different files
- Have no shared dependencies
- Can be tested independently

**Approach**:
1. Generate code for both
2. Create both files
3. Test each independently
4. Mark both as complete
```

### 9. Detect and Handle Blockers

If task cannot be completed:

```markdown
## Blocker Detected: T047

**Task**: T047 [US1] Test FalkorDB connection

**Blocker**: FalkorDB credentials not configured in .env

**Resolution Options**:
1. Set up FalkorDB Cloud account
2. Add credentials to .env:
   - FALKORDB_HOST
   - FALKORDB_PORT
   - FALKORDB_USER
   - FALKORDB_PASSWORD
3. Test connection with: `node scripts/test-falkordb-connection.js`

**Action**:
- [ ] Mark T047 as deferred
- [ ] Add blocker note to implementation-notes.md
- [ ] Move to next unblocked task
- [ ] Return to T047 after resolution
```

### 10. Phase Completion Checks

After completing all tasks in a phase:

```markdown
## Phase 3 Complete! 🎉

**User Story 1**: Voice note capture and storage

**Completed**:
- ✅ All 15 tasks in Phase 3
- ✅ End-to-end user flow tested
- ✅ Success criteria verified

**Validation Checkpoint**:
Before moving to Phase 4, verify:
- [ ] All files created and working
- [ ] Tests passing
- [ ] Performance targets met (if applicable)
- [ ] No errors in `wrangler dev`

**Next Steps**:
1. Run quick validation: `/validate` (optional)
2. Move to Phase 4: User Story 2
3. Or skip to Final Phase if MVP complete
```

### 11. Offer Periodic Validation

Every 5-10 tasks, suggest validation:

```markdown
## Validation Checkpoint

You've completed 45/73 tasks (62%). Time for a quick check!

**Quick Validation**:
1. Run local dev server: `npx wrangler dev`
2. Test implemented endpoints manually
3. Check for TypeScript/linting errors
4. Verify files exist at specified paths

**Full Validation**:
Run `/validate` command for comprehensive checks:
- Cloudflare configuration
- Database schemas
- API endpoints
- Performance targets
- Security measures

**Recommendation**: Continue implementation or validate now?
```

### 12. GraphMind-Specific Guidance

When implementing GraphMind features, provide context-aware assistance:

#### Voice Features (WebRTC, STT, TTS)
```markdown
**Voice Implementation Tips**:
- Test latency early with real audio
- Use Deepgram Nova-3 for STT: `@cf/deepgram/nova-3`
- Use Deepgram Aura for TTS: `@cf/deepgram/aura-1`
- Configure Pipecat smart-turn-v2 for natural conversations
- Target: <2s STT latency (p95)
```

#### FalkorDB Graph Operations
```markdown
**FalkorDB Implementation Tips**:
- Use GraphRAG SDK v0.5+ (not v2)
- Leverage auto ontology detection (no manual setup)
- Validate Cypher queries early
- Implement KV caching for query results (1 hour TTL)
- Test with realistic data volumes
- Target: <500ms query execution uncached
```

#### Cloudflare Edge Deployment
```markdown
**Edge Deployment Tips**:
- Always test with `wrangler dev` before deploy
- Monitor Workers CPU time (optimize if >10ms)
- Use Durable Objects for stateful connections
- Implement request coalescing for D1
- Cache aggressively in KV
- Target: <50ms total request time
```

#### Authentication & Security
```markdown
**Security Implementation Tips**:
- Validate JWT on all protected endpoints
- Use bcrypt cost factor 12 for passwords
- Filter all queries by user_id (data isolation)
- Parameterize all database queries
- Implement rate limiting (100 req/min per user)
- Store secrets in .env, never hardcode
```

### 13. Final Implementation Report

When all tasks complete (or MVP complete):

```markdown
## Implementation Complete! 🎉

**Feature**: [FEATURE_NAME]
**Final Progress**: X/Y tasks (Z%)

**Completion Summary**:
- ✅ Phase 1: Setup (7/7 tasks)
- ✅ Phase 2: Foundational (8/8 tasks)
- ✅ Phase 3: User Story 1 (15/15 tasks)
- ⚠️ Phase 4: User Story 2 (0/12 tasks - deferred)
- ⚠️ Final: Polish (3/10 tasks - partial)

**Files Created**:
- 15 new files
- 3 migrations
- 8 tests

**Configuration Changes**:
- wrangler.toml updated
- 2 KV namespaces created
- 1 D1 database configured
- FalkorDB connection established

**Testing Status**:
- ✅ Local dev server working
- ✅ MVP user flow tested
- ✅ Core endpoints functional
- ⚠️ Performance not yet measured

**Known Issues**:
- None (or list any)

**Next Steps**:
1. Run `/validate` for comprehensive validation
2. Address any validation issues
3. Deploy to production with `wrangler deploy`
4. Or continue with deferred tasks (Phase 4+)

**Implementation Notes**: See {FEATURE_DIR}/implementation-notes.md for detailed log
```

## Implementation Philosophy

**Task-Focused**:
- Work through tasks.md sequentially
- One task at a time (unless parallel opportunities)
- Clear completion criteria per task

**Context-Aware**:
- Reference design.md for architecture decisions
- Reference spec.md for requirements validation
- Follow CLAUDE.md conventions
- Understand the "why" behind each task

**Incremental & Testable**:
- Test each component as built
- Verify files exist and work
- Run `wrangler dev` frequently
- Catch issues early

**Documented**:
- Track progress in implementation-notes.md
- Log decisions and trade-offs
- Note blockers and resolutions
- Maintain knowledge for future reference

**Flexible**:
- Allow skipping tasks if blocked
- Support parallel implementation
- Adapt to user's working style
- Prioritize MVP over completeness

**Quality-Conscious**:
- Follow coding standards
- Include error handling
- Add logging and monitoring
- Think about edge cases

## Quality Rules

- **Update checkboxes immediately**: Mark tasks complete right after implementation
- **Test as you go**: Don't implement 10 tasks then test; test each one
- **Follow file paths exactly**: Create files where tasks specify
- **Reference architecture**: Always check design.md before implementing
- **Validate assumptions**: If unclear, check spec.md or ask user
- **Log everything**: Keep implementation-notes.md current
- **Security first**: Never skip auth, validation, or data isolation
- **GraphMind-specific**: Test voice latency, graph queries, edge performance early
