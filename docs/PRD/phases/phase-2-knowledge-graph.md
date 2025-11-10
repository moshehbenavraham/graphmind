# Phase 2: Entity Extraction & Knowledge Graph (Weeks 4-6)

## ✅ Implementation Status

**Phase Progress**: 0% complete
**Status**: 🔲 Not Started
**Last Updated**: 2025-11-10

### Completed Items

None yet.

### In Progress

None yet.

### Remaining

- 🔲 Entity Extraction System
- 🔲 FalkorDB GraphRAG SDK Integration
- 🔲 Graph Schema Definition
- 🔲 Entity Resolution & Caching
- 🔲 Basic Graph Visualization

---

**Timeline:** Weeks 4-6
**Status:** Not Started
**Goal:** Build knowledge graph from voice notes

---

## Overview

This phase transforms GraphMind from a simple transcription tool into an intelligent knowledge assistant. We'll implement entity extraction using LLM models, integrate the FalkorDB GraphRAG SDK, and build the foundation of the personal knowledge graph that makes contextual querying possible.

---

## Deliverables

### Entity Extraction
- [x] Entity extraction using Llama 3.1 via Workers AI
- [x] Entity types: Person, Project, Meeting, Topic, Technology, Location, Organization
- [x] Relationship extraction between entities
- [x] Confidence scoring for entities (>0.8 threshold)
- [x] User confirmation for ambiguous entities

### Knowledge Graph
- [x] FalkorDB GraphRAG SDK integration
- [x] Ontology definition and loading
- [x] Knowledge graph creation and updates
- [x] Entity merge logic (fuzzy matching)
- [x] Relationship management

### Visualization
- [x] Graph visualization (basic interactive view)
- [x] Entity detail pages
- [x] Node color coding by type
- [x] Relationship labels

---

## Success Criteria

1. **Entity Extraction**
   - >85% accuracy for common entity types (Person, Project, Topic)
   - Entities extracted within 3 seconds of recording completion
   - Ambiguous entities flagged for user confirmation
   - Entity properties correctly populated

2. **Knowledge Graph Updates**
   - Entities added to FalkorDB successfully
   - Duplicate entities merged correctly (fuzzy matching)
   - Relationships created between entities
   - Graph maintains consistency (no orphaned nodes)
   - Supports 1,000+ entities per user

3. **Graph Visualization**
   - Graph renders within 3 seconds for <1000 nodes
   - Nodes are color-coded by entity type
   - Users can click nodes to see details
   - Basic zoom, pan, drag interactions work
   - Mobile-friendly visualization

4. **Data Quality**
   - No data loss during entity extraction
   - Transactional graph updates (all-or-nothing)
   - Entity deduplication works correctly

---

## Technical Requirements

### Entity Extraction Pipeline

```typescript
// Entity extraction flow
1. Voice note transcript -> Llama 3.1-8b-instruct
2. Extract entities with confidence scores
3. Resolve entity references (e.g., "Sarah" -> "Sarah Johnson")
4. Create/merge entities in FalkorDB
5. Create relationships
6. Update voice_notes table with extracted entities
```

### FalkorDB Integration

```python
from graphrag_sdk import KnowledgeGraph, Ontology

# Initialize knowledge graph
kg = KnowledgeGraph(
    name=user_namespace,
    ontology=auto_ontology,
    model="@cf/meta/llama-3.1-8b-instruct"
)

# Process text and extract entities
kg.process_text(transcript)

# Query for verification
results = kg.query("MATCH (n) RETURN n LIMIT 10")
```

### Database Updates (D1)

```sql
-- Add entity extraction fields to voice_notes
ALTER TABLE voice_notes ADD COLUMN entities_extracted JSON;
ALTER TABLE voice_notes ADD COLUMN relationships_created JSON;
ALTER TABLE voice_notes ADD COLUMN confidence_score REAL;

-- Entity resolution cache
CREATE TABLE entity_cache (
    entity_key TEXT PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    falkordb_id TEXT NOT NULL,
    aliases JSON,
    confidence REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Development Tasks

### Week 4: Entity Extraction
- [ ] Design entity extraction prompt for Llama 3.1
- [ ] Implement entity extraction endpoint
- [ ] Test extraction accuracy with sample transcripts
- [ ] Add confidence scoring logic
- [ ] Implement entity validation
- [ ] Create entity confirmation UI for ambiguous cases
- [ ] Add entity resolution caching (KV)
- [ ] Update voice notes with extracted entities

### Week 5: FalkorDB Integration
- [ ] Set up FalkorDB GraphRAG SDK in Workers
- [ ] Define ontology (Person, Project, Meeting, etc.)
- [ ] Implement entity creation in FalkorDB
- [ ] Implement entity merge logic (fuzzy matching)
- [ ] Create relationship builder
- [ ] Add graph query utilities
- [ ] Test with various entity types
- [ ] Performance optimization (connection pooling)

### Week 6: Visualization
- [ ] Choose visualization library (D3.js, Vis.js, or Cytoscape.js)
- [ ] Implement graph data API endpoint
- [ ] Build interactive graph component
- [ ] Add node color coding by entity type
- [ ] Implement click-to-view-details
- [ ] Add zoom, pan, drag interactions
- [ ] Create entity detail page
- [ ] Mobile optimization
- [ ] Performance tuning for large graphs

---

## Entity Extraction Prompt Template

```typescript
const ENTITY_EXTRACTION_PROMPT = `
Extract entities and relationships from the following text.

Text: {transcript}

Extract:
1. People (names, roles)
2. Projects (names, descriptions)
3. Meetings (dates, topics, attendees)
4. Topics/Concepts (themes, subjects)
5. Technologies (tools, frameworks, languages)
6. Locations (places, addresses)
7. Organizations (companies, institutions)

For each entity, provide:
- type: entity type
- name: canonical name
- properties: relevant properties
- confidence: 0.0-1.0

Also extract relationships:
- from: source entity
- to: target entity
- type: relationship type (WORKED_WITH, DISCUSSED, USES_TECHNOLOGY, etc.)

Return as JSON:
{
  "entities": [...],
  "relationships": [...]
}
`;
```

---

## FalkorDB Ontology Definition

```json
{
  "entity_types": [
    {
      "type": "Person",
      "properties": ["name", "email", "phone", "first_mentioned", "mention_count"]
    },
    {
      "type": "Project",
      "properties": ["name", "description", "status", "technology", "started_date"]
    },
    {
      "type": "Meeting",
      "properties": ["date", "time", "topic", "attendees", "duration_minutes"]
    },
    {
      "type": "Topic",
      "properties": ["name", "category", "description"]
    },
    {
      "type": "Technology",
      "properties": ["name", "version", "category"]
    },
    {
      "type": "Location",
      "properties": ["name", "address", "city", "country"]
    },
    {
      "type": "Organization",
      "properties": ["name", "industry", "website"]
    }
  ],
  "relationship_types": [
    {"type": "WORKED_WITH", "from": "Person", "to": "Person"},
    {"type": "ATTENDED", "from": "Person", "to": "Meeting"},
    {"type": "DISCUSSED", "from": "Meeting", "to": "Topic"},
    {"type": "USES_TECHNOLOGY", "from": "Project", "to": "Technology"},
    {"type": "WORKS_ON", "from": "Person", "to": "Project"},
    {"type": "LOCATED_AT", "from": "Person|Project", "to": "Location"}
  ]
}
```

---

## API Endpoints

### POST /api/notes/:note_id/extract-entities
Extract entities from a specific note.

```typescript
Request: { note_id: string }
Response: {
  entities: Entity[],
  relationships: Relationship[],
  confidence_score: number,
  processing_time_ms: number
}
```

### GET /api/graph
Get full knowledge graph for user.

```typescript
Response: {
  nodes: Array<{id: string, type: string, properties: any}>,
  edges: Array<{from: string, to: string, type: string}>
}
```

### GET /api/graph/entity/:entity_id
Get details for a specific entity.

```typescript
Response: {
  entity: Entity,
  relationships: Relationship[],
  mentioned_in_notes: string[]
}
```

---

## Testing Strategy

### Unit Tests
- Entity extraction accuracy (test with sample transcripts)
- Entity merge logic (fuzzy matching)
- Confidence scoring
- Graph query generation

### Integration Tests
- End-to-end: voice note -> entities -> graph
- Entity deduplication
- Relationship creation
- Graph consistency checks

### Accuracy Testing
Create test dataset of 50 voice transcripts with manually labeled entities:
- Measure precision and recall
- Target: >85% F1 score
- Test with various domains (work, personal, technical)

### Performance Testing
- Entity extraction latency (<3 seconds)
- Graph update latency (<1 second)
- Query performance (<100ms for simple lookups)
- Visualization render time (<3 seconds for 1000 nodes)

---

## Dependencies

### New NPM Packages
```json
{
  "dependencies": {
    "graphrag-sdk": "^0.5.0",
    "d3": "^7.0.0",
    "vis-network": "^9.0.0"
  }
}
```

### External Services
- **FalkorDB**: Running instance (Docker or Cloud)
- **Workers AI**: Llama 3.1-8b-instruct access
- **KV**: For entity resolution caching

---

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Entity extraction <85% accuracy | High | Medium | Iterative prompt engineering, user feedback loop |
| FalkorDB connection latency >500ms | Medium | Medium | Connection pooling, edge deployment |
| Graph visualization slow for large graphs | Medium | Low | Pagination, clustering, virtualization |
| Entity deduplication errors | High | Medium | Fuzzy matching algorithms, user confirmation |
| FalkorDB GraphRAG SDK compatibility | High | Low | Use stable v0.5+, have backup plan for direct Cypher |

---

## Deliverable Checklist

- [ ] Entity extraction working with >85% accuracy
- [ ] All entity types supported (Person, Project, Meeting, etc.)
- [ ] FalkorDB integrated and storing entities
- [ ] Entity merge logic prevents duplicates
- [ ] Relationships created correctly
- [ ] Graph visualization displays entities
- [ ] Users can click nodes to see details
- [ ] Entity detail pages show relationships
- [ ] Mobile-friendly visualization
- [ ] Performance targets met
- [ ] All success criteria met

---

## Next Phase

After Phase 2 completion, proceed to **Phase 3: Voice Query System** where we'll enable users to query their knowledge graph conversationally using voice input.

---

## Resources

- FalkorDB GraphRAG SDK: https://github.com/FalkorDB/GraphRAG-SDK
- FalkorDB Docs: https://docs.falkordb.com/
- Workers AI Llama 3.1: https://developers.cloudflare.com/workers-ai/
- D3.js Graph Visualization: https://d3js.org/
- Vis.js Network: https://visjs.org/

---

**Phase Owner:** Development Team
**Last Updated:** 2025-11-10
**Status:** Ready for Implementation
