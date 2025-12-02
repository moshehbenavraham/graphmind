# Next Spec: Entity Role Assignment Bug Fix (Query Template Fix)

**Phase**: Phase 4 - Polish & Features (Critical Bugfix)
**Priority**: P0 (Blocker)
**Estimated Context**: ~12,000 tokens
**Dependencies**:
- Feature 011 frontend deployed (blocked by this bug)
- Feature 014 GraphRAG validation complete
- All backend infrastructure operational
**Status**: Ready to Implement

---

## What We're Building

This spec fixes the **Entity Role Assignment Bug** that is blocking the entire GraphMind frontend from functioning. Voice queries like "Who works on GraphMind?" return empty results because the Cypher query generator incorrectly treats the extracted entity ("GraphMind") as the SOURCE of the relationship when it should be the TARGET.

## Why This Next

This is the **#1 blocker** preventing GraphMind from being usable:

- **Blocking**: Feature 011 (Frontend) cannot function - users see "I don't have any notes about X" for all relationship queries
- **Impact**: 100% failure rate for "Who VERBS X?" question patterns
- **Root Cause Identified**: After 7+ fix attempts, root cause is documented in `specs/011-frontend-deployment/research_current_issue.md`
- **Phase Context**: Must be fixed before Phase 4 Polish features can be validated

**Current State**:
- Backend: Fully operational, security validated (Feature 012-014 complete)
- Frontend: Deployed but non-functional due to this bug
- Knowledge Graph: Contains data but queries return empty results

---

## Scope (Single Context Window)

**Included**:
- Fix entity role assignment in `src/services/cypher-generator.js`
- Add bidirectional query templates to `src/lib/graph/cypher-templates.js`
- Implement question pattern detection for source/target determination
- Add test coverage for relationship query patterns
- Validate fix with production-like queries

**Explicitly Excluded** (for later specs):
- LLM-based semantic role labeling (Option B from research)
- New Phase 4 features (multi-source ingestion, search, etc.)
- Frontend UI changes
- Performance optimization

**Estimated Tokens**: ~12,000 tokens

---

## User Stories (for this spec)

### Story 1: Fix "Who VERBS X?" Query Pattern (P0)

**As a** user
**I want** to ask "Who works on GraphMind?" and get correct results
**So that** I can discover relationships in my knowledge graph

**Acceptance Criteria**:
- [ ] Query "Who works on GraphMind?" returns Person nodes connected to GraphMind Project
- [ ] Query "What does John work on?" returns Project nodes connected to John Person
- [ ] Entity role (source vs target) correctly determined from question pattern
- [ ] All existing test scenarios continue to pass

### Story 2: Support Bidirectional Relationship Queries (P1)

**As a** developer
**I want** the query system to support both source-based and target-based relationship queries
**So that** all natural language question patterns work correctly

**Acceptance Criteria**:
- [ ] New `relationshipByTargetTemplate()` function added to cypher-templates.js
- [ ] Question pattern regex identifies "Who/What VERBS X?" as target-based query
- [ ] Question pattern regex identifies "What does X VERB?" as source-based query
- [ ] `buildRelationshipParams()` populates correct parameters based on pattern

---

## Technical Approach

### Root Cause (from research_current_issue.md)

The bug is in `src/services/cypher-generator.js` function `buildRelationshipParams()`:

```javascript
// CURRENT BUG (Line 113):
const sourceEntity = await resolveEntity(entities[0].text, userId, env);
// ^ Always treats first extracted entity as SOURCE

// For "Who works on GraphMind?":
// - Extracted entity: "GraphMind" (Project)
// - Treated as: SOURCE (Person named "GraphMind") <- WRONG
// - Should be: TARGET (Project named "GraphMind")
```

### Recommended Fix: Option A + Option C Combined

**Option A**: Pattern-based question detection (deterministic, fast)
**Option C**: Bidirectional templates with explicit source/target params

### Implementation Steps

#### 1. Add Question Pattern Detection

Add to `src/lib/graph/cypher-templates.js`:

```javascript
const QUESTION_PATTERNS = {
  // "Who/What VERBS on/for X?" -> X is TARGET, query for SOURCE
  WHO_VERBS_X: /^(who|what)\s+(\w+s?)\s+(on|for|with|to)\s+(.+)\??$/i,

  // "What does X VERB?" -> X is SOURCE, query for TARGET
  WHAT_DOES_X_VERB: /^what\s+does\s+(.+)\s+(\w+)\s*(on|for|with)?\??$/i,

  // "Who/what is/are X?" -> X is entity lookup
  WHO_IS_X: /^(who|what)\s+(is|are)\s+(.+)\??$/i,
};

export function identifyEntityRole(question, entities) {
  const q = question.trim();

  // "Who works on X?" -> entity X is TARGET
  if (QUESTION_PATTERNS.WHO_VERBS_X.test(q)) {
    return { role: 'target', pattern: 'WHO_VERBS_X' };
  }

  // "What does X work on?" -> entity X is SOURCE
  if (QUESTION_PATTERNS.WHAT_DOES_X_VERB.test(q)) {
    return { role: 'source', pattern: 'WHAT_DOES_X_VERB' };
  }

  // Default: entity is SOURCE (backward compatible)
  return { role: 'source', pattern: 'default' };
}
```

#### 2. Add Bidirectional Template

Add to `src/lib/graph/cypher-templates.js`:

```javascript
export function relationshipByTargetTemplate(userNamespace, sourceType, relType, targetType, targetName) {
  return `
    MATCH (source:${sourceType})-[r:${relType}]->(target:${targetType})
    WHERE target.name = $target_name
    AND target.user_id_normalized = $user_namespace
    RETURN source, r, target
    LIMIT 100
  `;
}
```

#### 3. Fix buildRelationshipParams()

Update `src/services/cypher-generator.js`:

```javascript
async function buildRelationshipParams(question, entities, env, userNamespace, userId) {
  const { role, pattern } = identifyEntityRole(question, entities);
  const resolvedEntity = await resolveEntity(entities[0].text, userId, env);

  if (role === 'target') {
    // Entity is the TARGET of the relationship
    return {
      target_name: resolvedEntity.name,
      user_namespace: userNamespace,
      query_direction: 'by_target',
      // Source will be wildcard (the "who")
    };
  } else {
    // Entity is the SOURCE of the relationship (default)
    return {
      source_name: resolvedEntity.name,
      user_namespace: userNamespace,
      query_direction: 'by_source',
    };
  }
}
```

#### 4. Update generateCypherQuery() to Use Direction

```javascript
if (template === 'relationship_query') {
  const params = await buildRelationshipParams(question, entities, env, userNamespace, userId);

  if (params.query_direction === 'by_target') {
    cypher = relationshipByTargetTemplate(
      userNamespace,
      mapping.source,  // e.g., 'Person'
      mapping.type,    // e.g., 'WORKS_ON'
      mapping.target,  // e.g., 'Project'
      params.target_name
    );
  } else {
    cypher = relationshipQueryTemplate(
      userNamespace,
      mapping.source,
      params.source_name,
      mapping.type,
      mapping.target,
      'outgoing'
    );
  }
}
```

### Cloudflare Components
- **Workers**: `src/services/cypher-generator.js` (main fix)
- **No D1/KV/R2 changes** - this is logic-only fix

### FalkorDB
- **No schema changes** - only query generation logic
- **Query templates**: Add `relationshipByTargetTemplate()`

---

## Implementation Steps

1. **Read existing code** - Understand current implementation in cypher-generator.js and cypher-templates.js
2. **Add pattern detection** - Implement `identifyEntityRole()` function with regex patterns
3. **Add target template** - Create `relationshipByTargetTemplate()` function
4. **Fix buildRelationshipParams()** - Use pattern detection to set correct role
5. **Update generateCypherQuery()** - Select template based on query direction
6. **Add unit tests** - Test pattern detection and template selection
7. **Integration test** - Test full pipeline with "Who works on X?" queries
8. **Validate in frontend** - Confirm fix works end-to-end

---

## Success Criteria

This spec is complete when:

- [ ] "Who works on GraphMind?" returns Person nodes (not empty)
- [ ] "What does John work on?" returns Project nodes
- [ ] "Tell me about GraphMind" continues to work (regression test)
- [ ] All 5+ question patterns from research doc work correctly
- [ ] Unit tests cover pattern detection logic (>90% coverage)
- [ ] Integration tests validate full query pipeline
- [ ] Frontend voice queries return correct results
- [ ] Feature 011 validation.md status changes from BLOCKED to PASSING

---

## Test Cases (from research_current_issue.md)

| Question | Expected Source | Expected Target | Expected Result |
|----------|-----------------|-----------------|-----------------|
| "Who works on GraphMind?" | Person (wildcard) | Project "GraphMind" | List of people |
| "What does John work on?" | Person "John" | Project (wildcard) | List of projects |
| "What projects involve AI?" | Project (wildcard) | Topic "AI" | List of projects |
| "Who knows about machine learning?" | Person (wildcard) | Topic "machine learning" | List of people |
| "Tell me about GraphMind" | N/A (entity lookup) | N/A | GraphMind details |

---

## Next After This

Once this spec is complete, the next logical steps will be:
1. **Feature 011 Validation**: Mark frontend deployment as complete (unblocked)
2. **Phase 4 Features**: Multi-source ingestion, search, entity management
3. **User Acceptance Testing**: End-to-end testing with real users

---

## References

- **Research Doc**: [specs/011-frontend-deployment/research_current_issue.md](/home/aiwithapex/projects/graphmind/specs/011-frontend-deployment/research_current_issue.md)
- **Bug Location**: `src/services/cypher-generator.js:107-149`
- **Template Location**: `src/lib/graph/cypher-templates.js`
- **Feature 011 Spec**: [specs/011-frontend-deployment/spec.md](/home/aiwithapex/projects/graphmind/specs/011-frontend-deployment/spec.md)
- **PRD Phase 4**: [docs/PRD/phases/phase-4-polish.md](/home/aiwithapex/projects/graphmind/docs/PRD/phases/phase-4-polish.md)

---

## Technical Notes

### Key Files to Modify

1. **`src/services/cypher-generator.js`** (primary fix)
   - `buildRelationshipParams()` - Fix entity role assignment
   - `generateCypherQuery()` - Use direction-aware template selection

2. **`src/lib/graph/cypher-templates.js`** (template additions)
   - Add `identifyEntityRole()` function
   - Add `relationshipByTargetTemplate()` function
   - Export new functions

3. **`tests/unit/cypher-generator.test.js`** (new tests)
   - Pattern detection tests
   - Template selection tests
   - Parameter building tests

### Risk Assessment

- **Low Risk**: Pattern-based detection is deterministic and testable
- **Backward Compatible**: Default behavior remains "entity as source"
- **Scoped Change**: Only affects relationship query generation, not entity lookups

### Known Edge Cases

1. Questions with multiple entities: "Does John work on GraphMind?" (both known)
   - Solution: Match both source AND target in query

2. Ambiguous questions: "Tell me about the relationship between John and GraphMind"
   - Solution: Fall back to bidirectional query returning all relationships

3. Entity not found: "Who works on NonExistent?"
   - Solution: Return empty result with helpful message (existing behavior)
