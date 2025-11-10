---
description: Update PRD documentation to reflect actual implementation progress (run after /validate)
---

# Update PRD Documentation

## Overview

This command scans the codebase, analyzes completed specs, and updates all PRD documentation in `docs/PRD/` to accurately reflect the current implementation state. This ensures `/nextspec` has correct information about what's been built.

**When to run**: After `/validate` confirms a feature is complete.

**What it updates**:
- `docs/PRD/README_PRD.md` - Current status section
- `docs/PRD/REQUIREMENTS-PRD.md` - Implementation status
- `docs/PRD/phases/phase-*.md` - Completion markers
- `docs/PRD/IMPLEMENTATION_REPORT.md` - Comprehensive progress report
- `docs/CHANGELOG.md` - Feature completion entries
- Removes or archives `docs/PRD/NEXT_SPEC.md` if completed

## Execution Steps

### 1. Analyze Current Implementation

Run the project analysis script:
```bash
bash .workflow/scripts/analyze-project.sh
```

Parse JSON output to get:
- Current phase and percentages
- Completed components
- Missing components
- All filesystem checks

### 2. Scan Completed Specs

Check the `specs/` directory:
```bash
find specs/ -name "validation.md" -type f
```

For each validation.md found:
- Read the validation report
- Check "Overall Status" (✅ Ready / ⚠️ Issues / ❌ Not Ready)
- Extract completion date
- Extract component/feature name
- Mark as completed if status is "✅ Ready"

Build a list of:
- **Completed features**: Specs with ✅ Ready status
- **In progress features**: Specs with validation but not ready
- **Planned features**: Specs without validation

### 3. Update README_PRD.md

Read `docs/PRD/README_PRD.md` and update/add the "Current Status" section at the top:

```markdown
## 🎯 Current Status

**Last Updated**: [DATE]
**Current Phase**: [Phase Number - Phase Name]
**Phase Progress**: [X%]

### Implementation Progress

| Phase | Status | Progress | Completion |
|-------|--------|----------|------------|
| Phase 1: Foundation | [✅ Complete / 🔄 In Progress / 🔲 Not Started] | [X%] | [Date or -] |
| Phase 2: Knowledge Graph | [Status] | [X%] | [Date or -] |
| Phase 3: Voice Query | [Status] | [X%] | [Date or -] |
| Phase 4: Polish | [Status] | [X%] | [Date or -] |
| Phase 5: Advanced | [Status] | [X%] | [Date or -] |

### Recent Completions

[Last 5 completed features with dates]

- ✅ [Feature Name] ([spec-dir-name]) - Completed [Date]
- ✅ [Feature Name] ([spec-dir-name]) - Completed [Date]
- ✅ [Feature Name] ([spec-dir-name]) - Completed [Date]

### In Progress

[Current work in progress]

- 🔄 [Feature Name] ([spec-dir-name]) - Started [Date], Status: [Brief status]

### Next Up

[Link to NEXT_SPEC.md or recommendation]

- 🎯 See [NEXT_SPEC.md](NEXT_SPEC.md) for next recommended component

---
```

**Rules**:
- If "Current Status" section exists, replace it entirely
- If it doesn't exist, insert at the very top after title
- Preserve all other content in README_PRD.md
- Update the table with accurate percentages from analysis
- List features in reverse chronological order (newest first)

### 4. Update REQUIREMENTS-PRD.md

Read `docs/PRD/REQUIREMENTS-PRD.md` and update/add "Implementation Status" section.

**Location**: Insert right after the main overview/introduction, before detailed requirements.

```markdown
## 📊 Implementation Status

**Last Updated**: [DATE]
**Current Phase**: [Phase Number - Phase Name] ([X%] complete)

### Completed Components

| Component | Spec | Completed | Validation |
|-----------|------|-----------|------------|
| [Component Name] | [001-short-name](../../specs/001-short-name) | [Date] | ✅ Ready |
| [Component Name] | [002-short-name](../../specs/002-short-name) | [Date] | ✅ Ready |

### In Progress

| Component | Spec | Started | Status |
|-----------|------|---------|--------|
| [Component Name] | [003-short-name](../../specs/003-short-name) | [Date] | 🔄 [Brief status] |

### Codebase Overview

**Directories**:
- ✅ `src/workers/` - Workers and API endpoints
- ✅ `src/models/` - Data models
- ✅ `src/lib/` - Utilities and libraries
- ✅ `migrations/` - D1 database migrations
- [List actual directories that exist]

**Key Files**:
- ✅ `wrangler.toml` - Cloudflare configuration
- [List other key files that exist]

**Database**:
- D1 Tables: [Count] tables
- FalkorDB Schema: [Node types count] node types, [Relationships count] relationships
- Migrations Applied: [Count]

**API Endpoints**:
- [Count] REST endpoints implemented
- [Count] WebSocket endpoints
- [List key endpoints]

### Next Priority

See [NEXT_SPEC.md](NEXT_SPEC.md) for the next recommended component to build.

---
```

**Rules**:
- If "Implementation Status" section exists, replace it
- If not, insert after introduction/overview
- Include links to spec directories
- Show validation status for each component
- List actual implemented endpoints if discoverable

### 5. Update Phase Documents

For each phase document in `docs/PRD/phases/`:

Read the phase document and add/update a "✅ Implementation Status" section at the top:

```markdown
# Phase [N]: [Phase Name]

## ✅ Implementation Status

**Phase Progress**: [X%] complete
**Status**: [✅ Complete / 🔄 In Progress / 🔲 Not Started]
**Last Updated**: [DATE]

### Completed Items

- ✅ [Component/Feature 1] - [Date]
- ✅ [Component/Feature 2] - [Date]

### In Progress

- 🔄 [Component/Feature] - Started [Date]

### Remaining

- 🔲 [Component/Feature]
- 🔲 [Component/Feature]

---

[Original phase content continues below]
```

**Mapping Logic**:

Map completed specs to phases by:
1. Reading each spec's "Phase" field (if it exists)
2. Reading NEXT_SPEC.md history (if components came from NEXT_SPEC)
3. Inferring from component type:
   - wrangler, auth, database setup → Phase 1
   - voice capture, entity extraction, graph schema → Phase 2
   - query system, graphrag integration → Phase 3
   - error handling, performance, UI → Phase 4
   - advanced features → Phase 5

**Rules**:
- Add implementation status to top of each phase doc
- Don't modify original phase requirements
- Show percentage progress
- Link to relevant specs

### 6. Handle NEXT_SPEC.md

Check if the current NEXT_SPEC.md has been completed:

**Check**: Does a validated spec exist that matches NEXT_SPEC.md?
- Compare NEXT_SPEC.md component name with completed specs
- Check if validation.md exists and shows "✅ Ready"

**If completed**:
```markdown
Archive NEXT_SPEC.md:
- Move to docs/PRD/archive/NEXT_SPEC_[DATE].md
- Add note: "Completed: [Date], Spec: [link to spec]"
```

**If not completed**:
- Leave NEXT_SPEC.md in place
- Update its status section if it has one

**After archiving**:
- Suggest user run `/nextspec` to generate new recommendation

### 7. Generate Implementation Report

Create a comprehensive report in `docs/PRD/IMPLEMENTATION_REPORT.md`:

```markdown
# GraphMind Implementation Report

**Generated**: [DATE]

## Summary

**Project Start**: [From git history or manual entry]
**Current Phase**: [Phase Number - Phase Name]
**Overall Progress**: [X%]
**Components Completed**: [Count]
**Components In Progress**: [Count]
**Components Planned**: [Count]

## Phase Progress

### Phase 1: Foundation ([X%])

**Status**: [✅ Complete / 🔄 In Progress / 🔲 Not Started]

**Completed**:
- [Component] - [Date]
- [Component] - [Date]

**In Progress**:
- [Component] - Started [Date]

**Remaining**:
- [Component]

### Phase 2: Knowledge Graph ([X%])

[Same structure]

### Phase 3: Voice Query ([X%])

[Same structure]

### Phase 4: Polish ([X%])

[Same structure]

### Phase 5: Advanced ([X%])

[Same structure]

## Timeline

| Date | Event | Spec |
|------|-------|------|
| [Date] | [Component] completed | [Link] |
| [Date] | [Component] started | [Link] |
| [Date] | [Component] completed | [Link] |

## Technology Stack Status

### Cloudflare

- [ ] Workers configured
- [ ] Durable Objects implemented
- [ ] D1 database setup
- [ ] KV namespaces created
- [ ] R2 buckets configured

### FalkorDB

- [ ] Connection established
- [ ] Schema defined
- [ ] GraphRAG SDK integrated
- [ ] Queries implemented

### Voice AI

- [ ] Deepgram STT integrated
- [ ] Deepgram TTS integrated
- [ ] Llama 3.1 entity extraction
- [ ] Pipecat turn detection

### Frontend

- [ ] WebRTC implemented
- [ ] UI components created
- [ ] State management
- [ ] User authentication

## Next Steps

1. [Top priority from NEXT_SPEC.md or analysis]
2. [Second priority]
3. [Third priority]

---

*This report is automatically generated by `/updateprd`. Run this command after validating completed features to keep documentation in sync.*
```

### 8. Update CHANGELOG.md

Check and update the project changelog to reflect completed features.

**Read Current CHANGELOG**:
```bash
# Read the CHANGELOG.md
cat docs/CHANGELOG.md
```

**Check for Existing Entry**:
- Look for the current version (e.g., 1.4.0, 1.5.0)
- Check if the completed feature is already documented
- Determine if a new version entry is needed

**Update Strategy**:

**If feature already documented**:
- Verify entry is complete and accurate
- No changes needed

**If feature not documented**:

**Option A - Add to Current Version** (if version was just released today):
```markdown
## [1.X.0] - YYYY-MM-DD

### Added

- **Feature [NNN]: [Feature Name]** - [Brief description]
  - [Key implementation detail 1]
  - [Key implementation detail 2]
  - [Key implementation detail 3]

### Changed

- [Any changes to existing functionality]

### Performance

- [Any performance metrics achieved]
```

**Option B - Create New Minor Version** (if adding to older version):
```markdown
## [1.X+1.0] - YYYY-MM-DD

### Added

- **Feature [NNN]: [Feature Name]** - [Brief description]
  - [Key implementation details from validation]

[Previous version entries below...]
```

**Changelog Entry Format**:

Extract from the validated spec:
- **Feature number and name** from spec directory (e.g., "001-wrangler-setup" → "Feature 001: Wrangler Configuration & Project Setup")
- **Key accomplishments** from validation.md "Implementation Completeness" section
- **Performance metrics** from validation.md "Performance Validation" section
- **Infrastructure details** if relevant (database IDs, service configurations)

**Example Entry**:
```markdown
## [1.5.0] - 2025-11-10

### Added

- **Feature 002: Authentication System** - Complete user authentication and session management
  - User registration with email/password validation
  - JWT token generation with 24-hour expiration
  - bcrypt password hashing (cost factor 12)
  - Session management in D1 database
  - Protected API endpoints with middleware
  - Rate limiting on auth endpoints (10 attempts per hour)

- **API Endpoints**
  - `POST /api/auth/register` - User registration
  - `POST /api/auth/login` - User authentication
  - `POST /api/auth/logout` - Session invalidation
  - `GET /api/auth/me` - Current user profile

### Performance

- Token generation: <50ms (target: <100ms) ✅
- Password hashing: ~150ms (bcrypt cost 12) ✅
- Login latency: <200ms (target: <500ms) ✅

### Security

- All passwords hashed with bcrypt
- JWT tokens signed with HS256
- Session tokens stored in D1 with expiration
- Rate limiting prevents brute force attacks
```

**Update Version History Table**:

Update the table at the bottom of CHANGELOG.md:
```markdown
| Version | Release Date | Key Features |
|---------|--------------|--------------|
| 1.X.0   | YYYY-MM-DD   | Feature NNN complete - [brief one-line summary] |
| [previous entries...]
```

**Rules**:
- **Never attribute anyone** - Don't add author names, co-authors, or user attributions (per CLAUDE.md rule)
- Use present tense for feature descriptions ("completes", "adds", "implements")
- Include specific metrics from validation when available
- Keep entries concise but informative
- Follow [Keep a Changelog](https://keepachangelog.com/) format
- Use version numbers consistently (semantic versioning)
- Group related changes under appropriate headers (Added, Changed, Performance, Security, etc.)

**Version Numbering**:
- **Major version (X.0.0)**: Breaking changes or major milestones
- **Minor version (1.X.0)**: New features, significant additions (most common for feature completions)
- **Patch version (1.0.X)**: Bug fixes, documentation updates (rare in this workflow)

**When to Create New Version**:
- If current version is from a previous day: Create new version
- If current version is from today AND no other features completed today: Update current version
- If current version is from today AND other features already in it: Consider if they're related enough to group

---

### 9. Verify Documentation Sync

Run a consistency check:

**Check 1**: Does analyze-project.sh agree with PRD updates?
- Compare script output with PRD documented completions
- Flag any discrepancies

**Check 2**: Are all completed specs documented?
- Check specs/ directory for validated features
- Ensure all are mentioned in PRD docs

**Check 3**: Are completion dates consistent?
- Check git history for spec files
- Use git commit dates if validation dates missing

**If inconsistencies found**:
- Report them in output
- Suggest corrections
- Don't fail, but warn user

### 10. Report Completion

Output:

```markdown
✅ PRD documentation updated!

**Last Updated**: [DATE]
**Current Phase**: [Phase Number - Phase Name] ([X%] complete)

---

## Updates Made

### README_PRD.md
- ✅ Current Status section updated
- Phase progress: Phase 1 ([X%]), Phase 2 ([X%]), Phase 3 ([X%])
- Recent completions: [Count] features listed
- In progress: [Count] features listed

### REQUIREMENTS-PRD.md
- ✅ Implementation Status section updated
- Completed components: [Count]
- In progress: [Count]
- Codebase overview updated

### Phase Documents
- ✅ phase-1-foundation.md - [X%] complete
- ✅ phase-2-knowledge-graph.md - [X%] complete
- ✅ phase-3-voice-query.md - [X%] complete
- ✅ phase-4-polish.md - [X%] complete
- ✅ phase-5-advanced.md - [X%] complete

### Reports
- ✅ IMPLEMENTATION_REPORT.md generated

### CHANGELOG.md
- [✅ Updated with new feature / 📝 Entry already exists / ➕ New version created]

### NEXT_SPEC.md
- [✅ Archived (completed) / 📝 Updated / ⏭️ Ready for /nextspec]

---

## Current State

**Completed Components**: [Count]
- [Component 1] - [Date]
- [Component 2] - [Date]
- [Component 3] - [Date]

**In Progress**: [Count]
- [Component] - [Status]

**Next Recommended**: [Component from NEXT_SPEC.md or "Run /nextspec"]

---

## Inconsistencies Found

[If any]
- ⚠️ [Inconsistency description]
- ⚠️ [Inconsistency description]

[If none]
- ✅ No inconsistencies detected

---

## Next Steps

1. Review updated documentation in docs/PRD/
2. [If NEXT_SPEC completed]: Run `/nextspec` to get next recommendation
3. [If NEXT_SPEC exists]: Review NEXT_SPEC.md and run `/spec` when ready
4. Continue with: /spec → /design → /tasks → implement → /validate → /updateprd

**Ready for next component?** [Yes/No with explanation]
```

## Special Cases

### First Run (No Completions Yet)

If no specs have been validated yet:
- Still create/update all sections
- Show 0% progress
- Note that project is in planning/early implementation
- Don't create timeline (no events yet)

### Multiple Components Completed Since Last Update

If multiple specs validated since last `/updateprd`:
- Update all of them
- Show timeline of completions
- Update all phase percentages
- Highlight batch of recent work

### Partial Implementation

If validation shows "⚠️ Issues Found":
- Mark as "in progress" not "completed"
- Include in "In Progress" section
- Note issues in status
- Don't increment phase percentage

### Git Integration

Use git to enhance accuracy:
```bash
# Get spec completion dates from git
git log --follow --format="%ai" --diff-filter=A specs/*/validation.md

# Get recent commits for context
git log --since="[last update date]" --oneline
```

## Quality Rules

- **Accuracy first**: Better to show less info than wrong info
- **Link everything**: Specs, phase docs, components all linked
- **Preserve original content**: Only update status sections
- **Consistent formatting**: Use same emoji/format across all docs
- **Dates matter**: Always include completion dates
- **No assumptions**: If unsure about completion, mark in progress
