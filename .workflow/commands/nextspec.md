---
description: Analyze project state and generate the next achievable spec scoped to a single context window
---

# Next Spec Generator

## User Input

```text
$ARGUMENTS
```

You **MAY** consider the user input if provided (optional hints or preferences).

## Overview

This command intelligently analyzes the current state of GraphMind, determines what needs to be built next based on the PRD phases, and creates a scoped specification in `docs/PRD/NEXT_SPEC.md` that can be accomplished in a single context window.

## Execution Steps

### 1. Check Existing NEXT_SPEC.md

First, check if `docs/PRD/NEXT_SPEC.md` already exists:

```bash
if [[ -f "docs/PRD/NEXT_SPEC.md" ]]; then
  # Check if it's been converted to a spec
  # Look for specs that reference NEXT_SPEC.md in their notes
fi
```

**If NEXT_SPEC.md exists**:
- Check if a spec exists that references it (grep specs/*/spec.md for "NEXT_SPEC.md")
- **If referenced by a spec**: User started work on it
  - Ask: "NEXT_SPEC.md is in progress (see specs/XXX/). Options:"
    - "Continue with current spec (run /design or /tasks)"
    - "Archive current and generate new NEXT_SPEC.md (if you're switching priorities)"
  - Wait for user decision
- **If NOT referenced**: Probably old/stale
  - Archive it: Move to `docs/PRD/archive/NEXT_SPEC_[date].md`
  - Add note to archived file: "Archived: [date], Reason: Replaced by new recommendation"
  - Continue to generate new NEXT_SPEC.md

**If NEXT_SPEC.md does NOT exist**:
- Continue to step 2

### 2. Analyze Project State

Run the project analysis script:
```bash
bash .workflow/scripts/analyze-project.sh
```

This script will output JSON with:
- Current phase (1-5 or "Planning")
- Completed components
- What exists in codebase
- Dependencies status
- Recommended next step

Parse the JSON to understand project state.

### 3. Ensure Archive Directory Exists

Create archive directory if needed:
```bash
mkdir -p docs/PRD/archive
```

This ensures `/updateprd` can archive NEXT_SPEC.md later.

### 4. Read PRD Documentation

Read the following files to understand the project:

**Core PRD**:
- `docs/PRD/REQUIREMENTS-PRD.md` - Overall requirements
- `docs/PRD/README_PRD.md` - Documentation structure

**Phase Documentation**:
- `docs/PRD/phases/phase-1-foundation.md`
- `docs/PRD/phases/phase-2-knowledge-graph.md`
- `docs/PRD/phases/phase-3-voice-query.md`
- `docs/PRD/phases/phase-4-polish.md`
- `docs/PRD/phases/phase-5-advanced.md`

**Technical Details**:
- Check `docs/PRD/technical/` for database schemas, API specs, etc.

### 3. Read Existing Specs

Check if any specs exist:
```bash
ls -la specs/
```

Read existing spec files to understand what's already been planned:
- Look for spec.md, design.md, tasks.md files
- Understand what features are in progress

### 4. Determine Next Logical Step

Based on analysis, determine what should be built next:

**Priority Logic**:

1. **Phase 1 (Foundation)** - If not started:
   - Wrangler setup + D1 database
   - Authentication system
   - Basic Workers structure
   - FalkorDB connection
   - Scope: Single foundational component (e.g., "Auth system" or "Database setup")

2. **Phase 2 (Knowledge Graph)** - If Phase 1 complete:
   - Voice note capture system
   - Entity extraction pipeline
   - FalkorDB integration
   - Scope: One complete user story (e.g., "Voice note capture" or "Entity extraction")

3. **Phase 3 (Voice Query)** - If Phase 2 complete:
   - Voice query system
   - GraphRAG integration
   - Answer generation
   - Scope: One query capability (e.g., "Basic Q&A" or "Context-aware queries")

4. **Phase 4 (Polish)** - If Phase 3 complete:
   - UI improvements
   - Performance optimization
   - Error handling
   - Scope: One polish area (e.g., "Error handling" or "Performance tuning")

5. **Phase 5 (Advanced)** - If Phase 4 complete:
   - Multi-source ingestion
   - Advanced features
   - Scope: One advanced feature

**Dependency Considerations**:
- Never recommend something that depends on unbuilt prerequisites
- Consider Cloudflare service dependencies
- Respect database schema dependencies
- Account for auth requirements

**Context Window Scoping**:
- Estimate token usage for implementation
- Typically scope to 1-3 related components
- Keep total implementation under 30,000 tokens
- Break larger features into multiple specs

### 5. Generate NEXT_SPEC.md

Load template from `.workflow/templates/nextspec-template.md` and create:

#### NEXT_SPEC.md Structure

```markdown
# Next Spec: [COMPONENT/FEATURE NAME]

**Phase**: [Phase Number and Name]
**Priority**: P1 (Next to Build)
**Estimated Context**: [Token estimate]
**Dependencies**: [What must exist first]
**Status**: Ready to Implement

---

## What We're Building

[2-3 sentence description of what this spec covers]

## Why This Next

[Explain why this is the logical next step]
- Dependency on: [completed items]
- Enables: [future items]
- Phase requirement: [phase context]

## Scope (Single Context Window)

**Included**:
- [Specific component 1]
- [Specific component 2]
- [Specific component 3]

**Explicitly Excluded** (for later specs):
- [Deferred item 1]
- [Deferred item 2]

**Estimated Tokens**: ~X,XXX tokens

---

## User Stories (for this spec)

### Story 1: [Title] (P1)
[Focused user story from phase documentation]

**Acceptance Criteria**:
- [ ] [Criterion]
- [ ] [Criterion]

---

## Technical Approach

[Brief technical approach referencing GraphMind architecture]

### Cloudflare Components
- Workers: [Which endpoints]
- D1: [Which tables]
- KV: [What caching]
- [Other services as needed]

### FalkorDB (if applicable)
- Nodes: [Which node types]
- Relationships: [Which relationships]

### Voice AI (if applicable)
- STT/TTS: [Which models]
- Entity extraction: [Approach]

---

## Implementation Steps

[High-level steps, not detailed tasks]

1. [Setup step]
2. [Core implementation step]
3. [Integration step]
4. [Testing step]

---

## Success Criteria

[How to know this is complete]

- [ ] [Measurable criterion 1]
- [ ] [Measurable criterion 2]
- [ ] [Measurable criterion 3]

---

## Next After This

Once this spec is complete, the next logical steps will be:
1. [Next component/feature]
2. [Following component/feature]

---

## References

- PRD Phase: [Link to phase doc]
- Related Specs: [Links if any exist]
- Technical Docs: [Links to relevant technical docs]
```

Write this to: `docs/PRD/NEXT_SPEC.md`

### 6. Update PRD Documentation

Update the PRD files to reflect current state:

#### Update README_PRD.md

Add a section at the top:

```markdown
## 🎯 Current Status

**Phase**: [Current Phase]
**Next Spec**: [Link to NEXT_SPEC.md]
**Last Updated**: [DATE]

### Implementation Progress

- ✅ Phase 1: [Status - e.g., "Complete" or "In Progress (60%)"]
- 🔲 Phase 2: [Status]
- 🔲 Phase 3: [Status]
- 🔲 Phase 4: [Status]
- 🔲 Phase 5: [Status]

**Recent Completions**:
- [Component 1] - [Date]
- [Component 2] - [Date]

**In Progress**:
- [Component] - [Started Date]

**Next Up**:
- [NEXT_SPEC.md component]
```

#### Update REQUIREMENTS-PRD.md

Add an implementation status section after the overview:

```markdown
## Implementation Status

**Last Updated**: [DATE]
**Current Phase**: [Phase Number - Phase Name]

### Completed Components

- [Component 1] - [Brief status]
- [Component 2] - [Brief status]

### In Progress

- [Component] - [Status/blockers]

### Next (See NEXT_SPEC.md)

- [Next component from NEXT_SPEC.md]

---
```

Insert this section early in the document, before the detailed requirements.

### 7. Generate Implementation Guidance

Based on the next spec, provide guidance on how to proceed:

**If NEXT_SPEC is a new feature**:
- Suggest running `/spec` with the component description
- Outline the workflow: /spec → /design → /tasks → implement → /validate

**If NEXT_SPEC is foundation work**:
- Suggest starting directly with implementation
- List specific commands to run (wrangler init, etc.)
- Reference setup documentation

### 8. Report Completion

Output:

```markdown
✅ Next spec generated!

**Next to Build**: [COMPONENT NAME]
**Phase**: [Phase Number]
**Scope**: [Brief scope description]
**Estimated**: ~X,XXX tokens

**Location**: docs/PRD/NEXT_SPEC.md

---

## Current Project State

**Phase Progress**:
- Phase 1: [Status with %]
- Phase 2: [Status with %]
- Phase 3: [Status with %]

**What Exists**:
- [Component 1]
- [Component 2]

**What's Missing** (needed for next spec):
- [Prerequisite if any]

---

## Recommended Next Steps

1. Review NEXT_SPEC.md to understand scope
2. [If new feature]: Run `/spec "[component description]"` to create detailed spec
3. [If foundation]: Start implementation directly with [command/approach]
4. Refer to [relevant phase doc] for detailed requirements

**Ready to start?** [Yes/No - explain if not ready]

---

## After Implementation

Once you complete this spec:
1. Run `/validate` to check completeness
2. Run `/nextspec` again to get the next chunk
3. Update NEXT_SPEC.md will be regenerated with new next step
```

## Analysis Logic

### How to Determine Phase

**Phase 1 (Foundation)** - None of these exist:
- `wrangler.toml`
- `src/workers/` directory
- `migrations/` directory
- D1 database created
- Basic auth system

**Phase 2 (Knowledge Graph)** - Phase 1 complete, but missing:
- Voice capture endpoints
- Entity extraction logic
- FalkorDB schema
- Voice note storage

**Phase 3 (Voice Query)** - Phase 2 complete, but missing:
- Query endpoints
- GraphRAG integration
- Answer generation
- Voice response system

**Phase 4 (Polish)** - Phase 3 complete, but missing:
- Comprehensive error handling
- Performance optimization
- UI polish
- Logging/monitoring

**Phase 5 (Advanced)** - Phase 4 complete:
- Multi-source ingestion
- Advanced features
- Scale optimizations

### How to Scope for Single Context

**Token Budget**: ~30,000 tokens for implementation

**Typical Scopes**:
- 1 complete user story (if small)
- 2-4 related components
- 1 large system (e.g., auth system)
- 3-5 API endpoints
- 1 Durable Object + related logic

**Too Large** (split into multiple specs):
- Entire phase
- Multiple independent user stories
- Complete voice pipeline + UI + backend

**Too Small** (combine):
- Single utility function
- One database table
- Single endpoint without context

## GraphMind-Specific Considerations

- **Voice-first nature**: Prioritize voice interaction components
- **Edge computing**: Consider Cloudflare service dependencies
- **GraphRAG accuracy**: Ensure FalkorDB setup before query system
- **User isolation**: Include auth before any user data features
- **Performance**: Consider caching early in implementation

## Error Handling

If unable to determine next step:
- List what's blocking progress
- Suggest prerequisites to complete first
- Ask user for guidance on priorities
- Provide multiple options if unclear
