# Next Spec: [COMPONENT/FEATURE NAME]

**Generated**: [DATE]
**Phase**: [Phase Number and Name]
**Priority**: P1 (Next to Build)
**Estimated Context**: ~[X,XXX] tokens
**Dependencies**: [What must exist first]
**Status**: Ready to Implement

---

## What We're Building

[2-3 sentence description of what this spec covers and why it's scoped this way]

## Why This Next

This is the logical next step because:

- **Dependency satisfaction**: [What completed items enable this]
- **Enables future work**: [What this will unblock]
- **Phase requirement**: [How this fits into current phase]
- **Risk mitigation**: [Any technical unknowns this addresses]

---

## Scope (Single Context Window)

### ✅ Included in This Spec

- [Specific component/feature 1]
- [Specific component/feature 2]
- [Specific component/feature 3]
- [Testing/validation approach]

### ❌ Explicitly Excluded (Future Specs)

- [Deferred feature 1] - Reason for deferral
- [Deferred feature 2] - Reason for deferral
- [Deferred feature 3] - Reason for deferral

### 📊 Token Estimate

**Estimated Implementation**: ~[X,XXX] tokens

Breakdown:
- Setup/configuration: ~[X]K tokens
- Core implementation: ~[X]K tokens
- Testing/validation: ~[X]K tokens
- Documentation: ~[X]K tokens

---

## User Stories for This Spec

### Story 1: [Title] (P1)

**As a** [user type]
**I want** [specific goal for this component]
**So that** [immediate benefit]

**Acceptance Criteria**:
- [ ] [Specific, testable criterion]
- [ ] [Specific, testable criterion]
- [ ] [Specific, testable criterion]

### Story 2: [Title] (P1/P2)

[If applicable - keep to 1-2 focused stories per spec]

**As a** [user type]
**I want** [goal]
**So that** [benefit]

**Acceptance Criteria**:
- [ ] [Criterion]
- [ ] [Criterion]

---

## Technical Approach

### Architecture Overview

[Brief description of how this fits into GraphMind's architecture]

```
[Text diagram showing component placement]

User/API → [This Component] → [Dependencies]
```

### Cloudflare Components

**Workers**:
- Endpoints: [List specific endpoints to create]
- Purpose: [What each endpoint does]

**Durable Objects** (if needed):
- Class: [Name]
- Purpose: [State management need]
- Lifecycle: [When created/destroyed]

**D1 (SQLite)**:
- Tables: [Which tables needed]
- Migrations: [Migration description]
- Queries: [Key queries]

**KV (Key-Value)**:
- Namespace: [Which namespace]
- Keys: [Key patterns]
- TTL: [Cache duration strategy]

**R2 (Object Storage)** (if needed):
- Bucket: [Which bucket]
- File structure: [Organization]

### FalkorDB (if applicable)

**Node Types**:
- [NodeLabel]: Properties: [list]
- [NodeLabel]: Properties: [list]

**Relationships**:
- [From]-[:REL_TYPE]->[To]: Properties: [list]

**Key Cypher Queries**:
```cypher
// Query 1: [Purpose]
[Cypher query]

// Query 2: [Purpose]
[Cypher query]
```

### Voice AI Pipeline (if applicable)

**Speech-to-Text**:
- Model: `@cf/deepgram/nova-3`
- Configuration: [Streaming/batch, language]

**Text-to-Speech**:
- Model: `@cf/deepgram/aura-1` or `aura-2`
- Configuration: [Voice, streaming]

**Entity Extraction** (if applicable):
- Model: `@cf/meta/llama-3.1-8b-instruct`
- Prompt approach: [Brief description]

**WebRTC** (if applicable):
- Connection flow: [Brief description]
- Error handling: [Approach]

---

## Implementation Steps

### 1. Setup & Configuration

- Create/update wrangler.toml bindings
- Set up D1 migrations (if needed)
- Configure KV namespaces (if needed)
- Environment variables

### 2. Core Implementation

- [Component 1 implementation]
- [Component 2 implementation]
- [Component 3 implementation]

### 3. Integration

- Connect to existing systems
- Add caching layer (if applicable)
- Error handling
- Logging

### 4. Testing & Validation

- Unit tests (if applicable)
- Integration tests
- Manual testing checklist
- Performance validation

---

## File Structure

New files to create:

```
src/
├── workers/
│   └── api/
│       └── [endpoint-name].js
├── models/
│   └── [model-name].js
├── services/
│   └── [service-name].js
└── lib/
    ├── [utility-category]/
    │   └── [utility-name].js

migrations/
└── [XXXX]_[migration-name].sql

tests/ (if applicable)
└── [component-name].test.js
```

---

## Success Criteria

This spec is complete when:

- [ ] [Measurable criterion 1 - e.g., "Endpoint responds with 200 OK"]
- [ ] [Measurable criterion 2 - e.g., "Data persists to D1 correctly"]
- [ ] [Measurable criterion 3 - e.g., "Latency < X seconds"]
- [ ] [Measurable criterion 4 - e.g., "Error handling works for case X"]
- [ ] Manual testing checklist passed
- [ ] Code follows GraphMind conventions
- [ ] Documentation updated (inline comments, README)

---

## Dependencies

### Prerequisites (Must Exist)

- [Prerequisite 1] - Status: [✅ Complete / 🔲 Missing]
- [Prerequisite 2] - Status: [✅ Complete / 🔲 Missing]

### Enables Future Work

Once this is complete, we can build:
- [Future component 1]
- [Future component 2]
- [Future component 3]

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk 1] | Low/Med/High | Low/Med/High | [How to mitigate] |
| [Risk 2] | Low/Med/High | Low/Med/High | [How to mitigate] |

---

## Testing Approach

### Manual Testing Checklist

- [ ] Test case 1: [Description]
- [ ] Test case 2: [Description]
- [ ] Test case 3: [Description]
- [ ] Edge case: [Description]
- [ ] Error case: [Description]

### Integration Testing

- [ ] Integration with [System 1]
- [ ] Integration with [System 2]

### Performance Testing

- [ ] Latency measurement: [How to measure]
- [ ] Load testing: [Approach if applicable]

---

## Next After This

Once this spec is complete, the next logical steps will be:

1. **[Next Component]** - [Brief reason]
2. **[Following Component]** - [Brief reason]
3. **[Alternative Path]** - [If multiple options]

Running `/nextspec` again after completion will re-analyze and recommend the updated next step.

---

## References

### PRD Documentation
- **Phase Doc**: [Link to phase-X-name.md]
- **Requirements**: [Link to relevant section in REQUIREMENTS-PRD.md]
- **Technical Specs**: [Links to relevant technical docs]

### Existing Specs (if related)
- [Spec 001-name] - [Relationship]
- [Spec 002-name] - [Relationship]

### External Documentation
- [Cloudflare Workers AI Docs]
- [FalkorDB Documentation]
- [Relevant third-party docs]

---

## Notes

[Any additional context, trade-offs made, or considerations for implementation]

---

**Ready to implement?** Review this spec, then:
1. Run `/spec "[component description]"` to create detailed feature spec (if needed)
2. Or start implementation directly (for foundational components)
3. Follow the standard workflow: design → tasks → implement → validate
