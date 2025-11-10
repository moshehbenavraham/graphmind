---
description: Create feature specification from docs/PRD/NEXT_SPEC.md
---

# Feature Specification Generator

## Overview

This command creates a detailed feature specification by reading `docs/PRD/NEXT_SPEC.md` and expanding it into a complete spec with user stories, requirements, and acceptance criteria.

**Workflow**: `/nextspec` → `/spec` → `/design` → `/tasks` → implement → `/validate`

## Execution Steps

### 1. Check for NEXT_SPEC.md

Check if `docs/PRD/NEXT_SPEC.md` exists:

```bash
if [[ ! -f "docs/PRD/NEXT_SPEC.md" ]]; then
  ERROR
fi
```

**If file does NOT exist**:
```
❌ NEXT_SPEC.md not found!

Please run `/nextspec` first to generate the next recommended spec.

The workflow is:
1. /nextspec  → Analyzes project and creates NEXT_SPEC.md
2. /spec      → Creates detailed spec from NEXT_SPEC.md
3. /design    → Creates technical design
4. /tasks     → Generates implementation checklist
```

Stop execution and display this message.

**If file exists**: Continue to step 2.

### 2. Check if NEXT_SPEC Already Converted

Before creating a new spec, check if NEXT_SPEC.md has already been converted:

```bash
# Search for specs that reference NEXT_SPEC.md
grep -r "Original NEXT_SPEC: docs/PRD/NEXT_SPEC.md" specs/*/spec.md 2>/dev/null
```

**If found**: A spec already exists for this NEXT_SPEC.md
```
⚠️ NEXT_SPEC.md has already been converted!

Found existing spec: specs/XXX-component-name/

You've already run /spec for this NEXT_SPEC.md. Options:
1. Continue with existing spec: Run /design or /tasks
2. Generate new NEXT_SPEC.md: Run /nextspec to get next recommendation
3. Review existing spec: Read specs/XXX-component-name/spec.md

Avoid creating duplicate specs.
```

Stop execution and display this message.

**If not found**: Continue to step 3.

### 3. Read NEXT_SPEC.md

Read `docs/PRD/NEXT_SPEC.md` and extract:
- **Component/Feature Name**: From title
- **Short Name**: Derive from title (2-4 words, lowercase, hyphenated)
- **Phase**: Which phase this belongs to
- **User Stories**: The focused stories for this spec
- **Technical Approach**: High-level approach
- **Scope**: What's included/excluded
- **Success Criteria**: Measurable outcomes
- **Dependencies**: Prerequisites
- **Estimated Tokens**: Scope indicator

### 4. Generate Short Name

From the NEXT_SPEC.md title, create a short name:
- Extract key words from "Next Spec: [TITLE]"
- Convert to lowercase, hyphenated format
- 2-4 words maximum
- Examples:
  - "Wrangler Configuration & Project Setup" → "wrangler-setup"
  - "Voice Note Capture System" → "voice-note-capture"
  - "Authentication System (JWT)" → "auth-system"
  - "Entity Extraction Pipeline" → "entity-extraction"

### 5. Setup Feature Directory

Run the setup script:
```bash
bash .workflow/scripts/setup-feature.sh --short-name "generated-short-name"
```

Parse the JSON output to get:
- `FEATURE_DIR`: Absolute path to feature directory
- `FEATURE_NUMBER`: Auto-incremented number (001, 002, etc.)
- `SHORT_NAME`: Validated short name

### 6. Create Specification

Load the template from `.workflow/templates/spec-template.md` and fill it with content from NEXT_SPEC.md:

#### Map NEXT_SPEC.md → spec.md

**Feature Overview**:
- Use the "What We're Building" section from NEXT_SPEC.md
- Expand to 2-3 sentences if needed

**User Stories**:
- Copy user stories from NEXT_SPEC.md
- Expand acceptance criteria if they're too brief
- Ensure each criterion is testable

**Functional Requirements**:
- Extract from NEXT_SPEC.md's technical approach and scope
- Break down into clear, testable requirements
- Remove all implementation details (no "use Workers AI", say "transcribe audio in <2s")
- Focus on WHAT and WHY, not HOW

**Success Criteria**:
- Copy from NEXT_SPEC.md
- Ensure they're measurable and technology-agnostic
- Add user-focused metrics if missing

**Edge Cases**:
- Infer from the technical approach
- Add common GraphMind edge cases:
  - Voice: Poor audio quality, network interruption, ambiguous speech
  - Graph: Empty knowledge base, large result sets, concurrent updates
  - Edge: Cold starts, rate limits, service timeouts

**Assumptions**:
- Copy dependencies from NEXT_SPEC.md as assumptions
- Add standard GraphMind assumptions:
  - User authentication exists (if Phase 1+ complete)
  - FalkorDB connection configured (if needed)
  - Cloudflare services available

**Dependencies**:
- Copy from NEXT_SPEC.md "Prerequisites" section
- List internal dependencies (other GraphMind components)
- List external dependencies (Cloudflare services, FalkorDB, etc.)

**Out of Scope**:
- Copy from NEXT_SPEC.md "Explicitly Excluded" section
- Add any additional items that should be deferred

**Notes**:
- Add context about why this spec is scoped this way
- Reference the token estimate
- Note what will come after this

#### GraphMind Context

Keep in mind GraphMind's architecture when writing the spec:
- **Voice-first**: Natural conversation, WebRTC, real-time streaming
- **Edge computing**: Cloudflare Workers, Durable Objects, global performance
- **GraphRAG**: FalkorDB knowledge graph, 90%+ accuracy retrieval
- **Privacy-first**: Isolated user data, end-to-end encryption

#### Quality Guidelines

- **No tech stack mentions**: Don't specify Cloudflare, FalkorDB, React, etc.
- **User-focused language**: Write for product managers, not developers
- **Testable requirements**: Each requirement should be verifiable
- **Voice-first mindset**: Consider conversation flow, latency, natural language
- **Measurable success**: Include specific metrics (time, accuracy, completion %)
- **Edge computing benefits**: Leverage global distribution without naming the tech

### 7. Save Specification

Write the completed spec to:
```
{FEATURE_DIR}/spec.md
```

### 8. Create Reference Link

Add a reference back to NEXT_SPEC.md in the notes section:

```markdown
## Notes

This spec was generated from NEXT_SPEC.md on [DATE].

**Original NEXT_SPEC**: docs/PRD/NEXT_SPEC.md
**Token Estimate**: ~[X,XXX] tokens (scoped for single context window)
**Phase Context**: [Phase description]

After completing this spec, run `/nextspec` again to get the next recommendation.
```

### 9. Report Completion

Output:
```markdown
✅ Feature specification created from NEXT_SPEC.md!

**Feature**: {FEATURE_NUMBER}-{SHORT_NAME}
**Location**: {FEATURE_DIR}/spec.md
**Source**: docs/PRD/NEXT_SPEC.md

**Component**: [Component name from NEXT_SPEC.md]
**Phase**: [Phase from NEXT_SPEC.md]
**Scope**: ~[X,XXX] tokens

---

## What's in the Spec

**User Stories**: [Count] stories (all P1 for this focused spec)
**Functional Requirements**: [Count] requirements
**Success Criteria**: [Count] measurable outcomes
**Edge Cases**: [Count] scenarios covered

---

## Next Steps

1. ✅ Review {FEATURE_DIR}/spec.md
2. Run `/design` to create technical design
3. Then `/tasks` to generate implementation checklist
4. Implement and validate
5. Run `/nextspec` again for the next chunk

**Ready to continue?** Run `/design` next.
```

## Example Transformation

**NEXT_SPEC.md says**:
> # Next Spec: Wrangler Configuration & Project Setup
>
> We're building the basic Cloudflare Workers project structure with wrangler.toml,
> D1 database bindings, KV namespaces, and initial directory structure.

**spec.md should say**:
> # Feature Specification: Wrangler Setup
>
> ## Feature Overview
>
> Establish the foundational Cloudflare Workers project configuration that enables
> all future development. This includes project structure, database connections,
> and caching infrastructure setup.
>
> ## User Stories
>
> ### Story 1: Project Initialization (P1)
>
> **As a** developer
> **I want** a properly configured Cloudflare Workers project
> **So that** I can build and deploy GraphMind features
>
> **Acceptance Criteria**:
> - [ ] Project deploys successfully to Cloudflare
> - [ ] Database connections are configured
> - [ ] Local development environment works
> - [ ] Project structure follows GraphMind conventions

Notice: No mention of "wrangler.toml" in spec, that's an implementation detail. The spec stays focused on WHAT (configured project) and WHY (enable development).

## Error Handling

**If NEXT_SPEC.md is empty or malformed**:
- Try to parse what you can
- Ask user to run `/nextspec` again
- Do not create an invalid spec

**If short name generation fails**:
- Fall back to "next-component-XXX" where XXX is feature number
- Warn user about generic name

**If setup script fails**:
- Display error from script
- Suggest manual directory creation
- Do not continue to spec generation
