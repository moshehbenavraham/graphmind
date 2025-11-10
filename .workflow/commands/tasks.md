---
description: Generate implementation task checklist from spec and design documents
---

# Task Checklist Generator

## User Input

```text
$ARGUMENTS
```

You **MAY** consider the user input if provided (optional hints like "include tests" or "focus on backend").

## Overview

This command generates a dependency-ordered, actionable task checklist organized by user story. Tasks follow a strict format: `- [ ] T001 [P] [US1] Description with file path`

## Execution Steps

### 1. Find Feature Directory

Run the prerequisites check:
```bash
bash .workflow/scripts/check-prereqs.sh
```

Parse JSON output to get:
- `FEATURE_DIR`: Absolute path to current feature directory
- `SPEC_FILE`: Path to spec.md (must exist)
- `DESIGN_FILE`: Path to design.md (must exist)

If either file missing: ERROR "Run /spec and /design first"

### 2. Load Context

Read the following files:
- `{SPEC_FILE}`: User stories with priorities (P1, P2, P3)
- `{DESIGN_FILE}`: Architecture, endpoints, data models
- `/CLAUDE.md`: Project structure and conventions

### 3. Extract Task Sources

**From Spec (User Stories)**
- Extract each user story with its priority
- Note acceptance criteria per story
- Identify which stories are independent vs dependent

**From Design**
- Cloudflare services to configure
- D1 tables and migrations
- FalkorDB nodes and relationships
- API endpoints to implement
- Voice AI components

**Map Components to Stories**
- Each model/service/endpoint → which user story needs it?
- Shared infrastructure → Setup phase
- Story-specific code → That story's phase

### 4. Generate Task Checklist

Load template from `.workflow/templates/tasks-template.md` and create tasks:

#### Task Format Rules (CRITICAL)

Every task MUST follow this exact format:
```
- [ ] T001 [P] [US1] Description with file path
```

**Components:**
1. `- [ ]` - Checkbox (required)
2. `T001` - Sequential task ID (required)
3. `[P]` - Parallel marker (ONLY if truly parallelizable - different files, no dependencies)
4. `[US1]` - User story label (ONLY in user story phases, not Setup/Foundational/Polish)
5. Description with exact file path

**Examples:**
- ✅ `- [ ] T001 Create wrangler.toml with D1 bindings`
- ✅ `- [ ] T005 [P] Implement JWT middleware in src/workers/middleware/auth.js`
- ✅ `- [ ] T012 [P] [US1] Create VoiceNote model in src/models/voice-note.js`
- ✅ `- [ ] T014 [US1] Implement VoiceNoteService in src/services/voice-note.js`
- ❌ `Create model` (missing checkbox, ID, story label, file path)

#### Phase Structure

**Phase 1: Setup (Project Initialization)**
- Wrangler configuration
- D1 database setup
- KV namespace creation
- R2 bucket creation (if needed)
- FalkorDB Cloud connection setup
- Environment variables (.env setup)
- npm dependencies
- No [US] labels in this phase

**Phase 2: Foundational (Blocking Prerequisites)**
- Authentication middleware (JWT)
- Database schema migrations (D1)
- FalkorDB base schema
- Shared utilities (error handling, logging)
- Connection pooling Durable Objects
- No [US] labels in this phase

**Phase 3-N: User Story Phases (One Phase Per Story)**

For each user story from spec.md (in priority order P1, P2, P3...):

```markdown
## Phase 3: User Story 1 - [Story Title]

**Goal**: [User story description from spec]

**Independent Test**: [How to verify this story works standalone]

### Tasks

- [ ] T020 [P] [US1] Create [Model] in src/models/[file].js
- [ ] T021 [P] [US1] Create [Service] in src/services/[file].js
- [ ] T022 [US1] Implement [Worker endpoint] in src/workers/api/[file].js
- [ ] T023 [US1] Add D1 queries in src/lib/db/[file].js
- [ ] T024 [US1] Add FalkorDB queries in src/lib/graph/[file].js
- [ ] T025 [US1] Create frontend component in src/frontend/[file].jsx
- [ ] T026 [US1] Integrate WebRTC (if voice feature) in src/lib/voice/[file].js
- [ ] T027 [US1] Add KV caching in src/workers/api/[file].js
- [ ] T028 [US1] Test end-to-end user flow
```

Order within each story phase:
1. Data models
2. Services/business logic
3. Worker endpoints
4. Database operations (D1 + FalkorDB)
5. Frontend components
6. Voice AI integration (if applicable)
7. Caching/optimization
8. Integration testing

**Final Phase: Polish & Cross-Cutting**
- Error handling improvements
- Logging and monitoring
- Performance optimization
- Documentation
- Deployment preparation
- No [US] labels in this phase

### 5. Create Dependencies Section

After all tasks, add:

```markdown
## Dependencies

### User Story Completion Order

Most stories should be independent. Mark dependencies only when necessary:

- US1 (P1): No dependencies - implement first
- US2 (P1): No dependencies - parallel with US1
- US3 (P2): Depends on US1 (needs voice capture system)

### Parallel Execution Opportunities

Within each story:
- Models and services can be created in parallel [P]
- Frontend and backend can develop in parallel (mock APIs)
- D1 and FalkorDB operations can be parallelized [P]
```

### 6. Add Implementation Strategy

```markdown
## Implementation Strategy

**MVP Scope**: User Story 1 only (P1)
- Delivers core value
- Validates architecture
- Gets user feedback early

**Incremental Delivery**:
1. Phase 1-2: Setup + Foundation (1-2 days)
2. Phase 3: US1 - [description] (MVP) (2-4 days)
3. Phase 4: US2 - [description] (if P1) (2-3 days)
4. Phase 5+: Additional stories as prioritized
5. Final: Polish & optimization (1 day)

**GraphMind-Specific Considerations**:
- Voice latency: Test STT/TTS early
- FalkorDB queries: Validate Cypher early
- Edge deployment: Test in local dev before deploy
- WebRTC: Handle network issues from day 1
```

### 7. Save Task Checklist

Write the completed checklist to:
```
{FEATURE_DIR}/tasks.md
```

### 8. Report Completion

Output:
```markdown
✅ Task checklist created!

**Feature**: {FEATURE_NAME}
**Location**: {FEATURE_DIR}/tasks.md

**Summary**:
- Total tasks: {COUNT}
- User stories: {COUNT}
- Parallel opportunities: {COUNT}
- Estimated MVP: {DAYS} days

**Task Breakdown**:
- Setup: {COUNT} tasks
- Foundational: {COUNT} tasks
- US1 (P1): {COUNT} tasks
- US2 (P1): {COUNT} tasks
- [...]
- Polish: {COUNT} tasks

**Next Steps**:
- Review task order and dependencies
- Start with Phase 1 (Setup)
- Run `/validate` after implementation to check completeness
```

## Quality Rules

- **Every task has exact file path**: Not "create model", but "create model in src/models/user.js"
- **Parallelizable marked [P]**: Only if truly independent (different files, no shared state)
- **Story labels in story phases only**: Setup, Foundational, Polish phases have NO [US] labels
- **One phase per user story**: Keep story work isolated and testable
- **MVP-first**: P1 stories should deliver minimum viable value
- **GraphMind categories**: Cloudflare, FalkorDB, Voice AI, Frontend clearly separated
