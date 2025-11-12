# Next Spec: Entity Extraction Pipeline

**Generated**: 2025-11-11
**Phase**: Phase 2 - Knowledge Graph & Entity Extraction
**Type**: Feature
**Priority**: P1 (Next to Build)

---

## Why This Next

**Dependencies Satisfied**:
- Phase 1 Foundation 100% complete (Auth, D1, FalkorDB connection, Workers setup)
- Feature 004 Voice Note Capture & Transcription 100% complete
  - VoiceSessionManager Durable Object with WebRTC/WebSocket
  - Real-time Deepgram Nova-3 STT integration
  - Voice notes stored in D1 with transcripts
  - 4 REST API endpoints for note management

**Blocks Future Work**:
- Knowledge Graph Building (Feature 006) - needs extracted entities
- Graph Visualization (Feature 007) - needs entities to visualize
- Voice Query System (Phase 3) - needs populated knowledge graph
- All Phase 2 deliverables depend on entity extraction

**Phase Requirement**:
- **Phase 2 Goal**: "Build knowledge graph from voice notes"
- Entity extraction is the critical first step that transforms transcripts into structured knowledge
- Enables automatic ontology population in FalkorDB
- Referenced in Phase 2 doc: [docs/PRD/phases/phase-2-knowledge-graph.md](phases/phase-2-knowledge-graph.md)

---

## Scope Definition

### ✅ Included

- Llama 3.1-8b-instruct integration via Workers AI for NLP entity extraction
- Entity extraction from voice note transcripts (7 entity types: Person, Project, Meeting, Topic, Technology, Location, Organization)
- Confidence scoring for extracted entities (threshold: 0.8)
- Entity resolution and caching (KV storage for fuzzy matching)
- Background job processing for transcript entity extraction
- API endpoints for triggering entity extraction and viewing results
- D1 schema updates for entity metadata storage

### ❌ Excluded

- Knowledge graph creation/updates in FalkorDB - Feature 006 (Knowledge Graph Building)
- Graph visualization UI - Feature 007 (Graph Visualization)
- Relationship extraction between entities - Feature 006 (will use FalkorDB GraphRAG SDK's auto relationship detection)
- Entity merge/deduplication logic - Feature 006 (part of graph building)
- User confirmation UI for ambiguous entities - Phase 4 polish feature
- Audio file storage in R2 - Phase 4 (not needed for entity extraction)

### 📏 Size Check

**Estimated Complexity**: Medium
**Fits Single Context Window**: Yes

**Breakdown**:
- Entity extraction service (Workers AI integration, prompt engineering)
- Entity storage and caching (D1 updates, KV caching)
- API endpoints (extract entities, view extracted entities)
- Background job processing (queue for async extraction)

---

## What /spec Needs to Know

**Spec Type**: Feature

**Core Goals** (will become full requirements in spec):
1. Extract 7 entity types from voice note transcripts with >85% accuracy
2. Score entity confidence and filter low-confidence extractions (<0.8 threshold)
3. Cache entity resolutions in KV for fast fuzzy matching
4. Process entity extraction asynchronously (background jobs)
5. Store extracted entities in D1 with metadata

**Key Components** (will be expanded in design):
- **Cloudflare Services**:
  - Workers (entity extraction service, API endpoints)
  - Workers AI (Llama 3.1-8b-instruct for entity extraction)
  - KV (entity resolution cache, fuzzy matching)
  - D1 (entity metadata storage, entity_cache table)
  - Queues (background job processing for extraction)
- **FalkorDB**: No (not yet - Feature 006 will add to graph)
- **Voice AI**: No (uses existing transcripts from Feature 004)
- **Frontend**: No (API-only feature, UI in Feature 007)

**Success Criteria** (will become acceptance criteria):
- Entity extraction accuracy >85% on test dataset (50 sample transcripts)
- Entity extraction completes within 3 seconds per note
- Confidence scores correctly filter low-quality entities (<0.8)
- Entity cache reduces duplicate entity checks by 70%
- All 7 entity types extracted correctly (Person, Project, Meeting, Topic, Technology, Location, Organization)

---

## After This Spec

**Next Logical Steps** (in order):
1. **Feature 006: Knowledge Graph Building** - Create/update entities in FalkorDB using extracted entities
2. **Feature 007: Basic Graph Visualization** - Display entities and relationships in interactive graph
3. **Phase 3: Voice Query System** - Query the populated knowledge graph via voice

**Enables**:
- Structured knowledge capture from unstructured voice notes
- Automatic ontology population in FalkorDB (auto-detection from entities)
- Foundation for Phase 2 knowledge graph building
- Intelligent querying in Phase 3 (requires populated graph)

---

## References

- **Phase Doc**: [docs/PRD/phases/phase-2-knowledge-graph.md](phases/phase-2-knowledge-graph.md)
- **PRD Section**: [Section 3.2.2 Entity Extraction (FR-NC-002)](REQUIREMENTS-PRD.md#322-entity-extraction)
- **Related Specs**:
  - [specs/004-voice-note-capture](../../specs/004-voice-note-capture) - Provides transcripts for extraction
  - [specs/003-falkordb-connection](../../specs/003-falkordb-connection) - FalkorDB ready for Feature 006

---

## Notes

**Entity Extraction Approach**:
- Use Llama 3.1-8b-instruct via Workers AI (model: `@cf/meta/llama-3.1-8b-instruct`)
- Structured prompt with JSON output schema
- Extract 7 entity types with properties and confidence scores
- Cache entity resolutions in KV for fuzzy matching (e.g., "Sarah" -> "Sarah Johnson")

**Performance Considerations**:
- Background processing via Cloudflare Queues (async extraction)
- Batch processing for multiple notes
- KV caching to reduce duplicate LLM calls
- Target: <3 seconds per note for entity extraction

**Integration Points**:
- Triggered automatically after voice note creation (webhook)
- Can be manually triggered via API for existing notes
- Stores results in D1 `voice_notes.entities_extracted` JSON column
- Creates entries in `entity_cache` table for fuzzy matching

**Quality Assurance**:
- Confidence threshold of 0.8 to filter low-quality entities
- Test dataset of 50 sample transcripts with manually labeled entities
- Measure precision, recall, F1 score (target: >85% F1)
- Iterative prompt engineering based on test results
