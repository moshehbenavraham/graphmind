# Archived: 2025-11-13
# Original Feature: Feature 008 - Voice Query Input & Graph Querying
# Reason: Feature 008 in progress (82% complete), generating next spec (Feature 009)
# 
# Next Spec: Voice Query Input & Graph Querying (Phase 3 Start)

**Generated**: 2025-11-13
**Phase**: Phase 3 - Voice Query System
**Type**: Feature
**Priority**: P1 (Next to Build)
**Estimated Context**: ~25,000 tokens

---

## What We're Building

A voice-driven query interface that allows users to ask natural language questions about their knowledge graph and receive structured results. This feature processes spoken questions, converts them to Cypher graph queries, executes them against FalkorDB, and returns results in JSON format. This is the **first component of Phase 3**, establishing the query foundation before adding answer generation (LLM) and text-to-speech in subsequent specs.

---

## Why This Next

**Dependencies Satisfied**:
- ✅ Phase 1 Foundation 100% complete (Auth, D1, FalkorDB connection pooling, Workers setup)
- ✅ Feature 004: Voice Note Capture & Transcription 100% complete (VoiceSessionManager pattern proven)
- ✅ Feature 005: Entity Extraction Pipeline 100% complete (7 entity types extracted and cached)
- ✅ Feature 006: Knowledge Graph Building 100% complete (FalkorDB populated with nodes and relationships)
- ✅ Knowledge graph contains queryable data (entities, relationships, user namespaces)
- ✅ Deepgram STT integration proven (Nova-3 streaming in Feature 004)

**Blocks Future Work**:
- Answer generation with LLM (Feature 009) - needs query results to generate answers from
- Text-to-speech responses (Feature 010) - needs answers to speak
- Conversation context management (Feature 011) - needs query history to maintain context
- All remaining Phase 3 deliverables depend on this query foundation

**Phase Requirement**:
- **Phase 3 Goal**: "Query knowledge graph via voice"
- This is the critical first step that transforms GraphMind from a data collection tool into an interactive knowledge assistant
- Enables users to retrieve information conversationally
- Referenced in Phase 3 doc: [docs/PRD/phases/phase-3-voice-query.md](phases/phase-3-voice-query.md)

**Why Not Graph Visualization First?**
- Graph visualization is a **required feature** but deferred to Phase 4 for strategic reasons
- Voice querying is the **core value proposition** of GraphMind - "voice-first personal knowledge assistant"
- Users need to be able to query their knowledge conversationally to validate the graph works correctly
- Visualization makes more sense after the query system proves the knowledge graph is accurate and useful
- Will be implemented as a high-priority feature once Phase 3 (Voice Query) is complete

---

## Scope Definition

### ✅ Included (Single Context Window)

**Core Voice Query System**:
- Voice query recording interface (UI button, microphone access, audio capture)
- Real-time audio streaming via WebSocket (reuse VoiceSessionManager pattern)
- Speech-to-text transcription (Deepgram Nova-3, already proven in Feature 004)
- Natural language question parsing and intent detection
- Basic Cypher query generation from natural language questions
- Query execution against FalkorDB knowledge graph
- User namespace isolation in queries (only query authenticated user's graph)
- Query result formatting (JSON response with entities, relationships, metadata)
- REST API endpoints for query management (start query, get query history)
- WebSocket protocol for real-time query processing
- Query session management in D1 (track questions, generated queries, results)
- Query caching in KV (cache frequent queries for <100ms response time)

**Query Types Supported (MVP)**:
- Entity lookup: "Who is Sarah?" → MATCH (p:Person {name: "Sarah"}) RETURN p
- Relationship queries: "What projects did Sarah work on?" → MATCH (p:Person {name: "Sarah"})-[:WORKS_ON]->(proj:Project) RETURN proj
- Temporal queries: "What did I do last week?" → MATCH (m:Meeting) WHERE m.date >= date() - duration('P7D') RETURN m
- List queries: "Who have I met this month?" → MATCH (p:Person)-[:ATTENDED]->(m:Meeting) WHERE m.date >= ... RETURN DISTINCT p
- Count queries: "How many projects involve Python?" → MATCH (proj:Project)-[:USES_TECHNOLOGY]->(t:Technology {name: "Python"}) RETURN count(proj)

### ❌ Explicitly Excluded (For Later Specs)

- **Answer Generation with LLM** (Feature 009) - Converting query results to natural language answers
- **Text-to-Speech Output** (Feature 010) - Speaking answers back to users (Deepgram Aura-1/Aura-2)
- **Conversation Context Management** (Feature 011) - Multi-turn conversations, follow-up questions
- **Advanced Query Types** - Multi-hop queries (2+ degrees), graph analytics, pattern matching
- **Query Suggestions** - Autocomplete, "people also asked", suggested queries
- **Graph Visualization** - Interactive graph UI (deferred to Phase 4, required feature)
- **Query Refinement** - "Did you mean..." suggestions, query rewriting
- **Voice Activation** - "Hey GraphMind" wake word detection
- **Query Editing** - Manual query editing, Cypher query builder UI

### 📏 Size Check

**Estimated Complexity**: Medium
**Fits Single Context Window**: Yes (~25,000 tokens estimated)

**Breakdown**:
1. **Voice Query Interface** (~3,000 tokens)
   - React components for query recording (reuse VoiceRecorder pattern)
   - UI state management (recording, transcribing, querying, results display)
   - WebSocket connection handling

2. **QuerySessionManager Durable Object** (~5,000 tokens)
   - Similar to VoiceSessionManager but for queries
   - WebSocket protocol for real-time query updates
   - Audio streaming to Deepgram STT
   - Integration with Cypher generator

3. **Cypher Query Generator** (~7,000 tokens)
   - Natural language to Cypher conversion (Llama 3.1-8b prompt engineering)
   - Query templates for common patterns (entity lookup, relationships, temporal)
   - Query validation and sanitization
   - Parameterized queries (prevent injection)

4. **Query Execution Service** (~4,000 tokens)
   - Execute Cypher queries via FalkorDB connection pool
   - Result parsing and formatting
   - Error handling (invalid queries, empty results)
   - Performance monitoring

5. **API Endpoints & Database** (~3,000 tokens)
   - POST /api/query/start (create query session)
   - WebSocket /ws/query/:session_id (real-time query processing)
   - GET /api/query/history (query history)
   - D1 schema updates (voice_queries table)
   - KV query cache integration

6. **Testing & Documentation** (~3,000 tokens)
   - Unit tests for Cypher generator
   - Integration tests for query flow
   - API documentation
   - Example queries and responses

**Total**: ~25,000 tokens (fits comfortably in single context window)

---

## What /spec Needs to Know

**Spec Type**: Feature (008-voice-query-input)

**Core Goals** (will become full requirements in spec):
1. Enable users to ask natural language questions about their knowledge graph via voice
2. Convert spoken questions to text in real-time using Deepgram STT
3. Generate valid Cypher queries from natural language questions
4. Execute queries against FalkorDB and return structured results
5. Provide query management API and session tracking

**Key Components** (will be expanded in design):

**Cloudflare Services**:
- **Workers**: Query API endpoints, QuerySessionManager routing, Cypher generator service
- **Durable Objects**: QuerySessionManager (WebSocket management, similar to VoiceSessionManager)
- **Workers AI**: Deepgram Nova-3 (STT - already integrated), Llama 3.1-8b (Cypher generation)
- **D1**: Query sessions table, query history, result caching metadata
- **KV**: Query result cache (1-hour TTL), Cypher query cache
- **FalkorDB Connection Pool**: Reuse existing FalkorDBConnectionPool Durable Object

**Frontend**:
- Query recording interface (React components)
- Real-time transcription display
- Query results display (JSON tree view, entity cards)
- Query history viewer

**Success Criteria** (will become acceptance criteria):
- Voice questions transcribed within 2 seconds (p95)
- Cypher query generated within 3 seconds for common patterns
- Query execution completes within 500ms (uncached) or 100ms (cached)
- 90%+ query generation accuracy for supported question types
- Zero cross-user data leakage (queries respect user namespaces)
- Query history persisted and retrievable
- Handles "no results found" gracefully without errors

---

## Implementation Steps (High-Level)

1. **Create QuerySessionManager Durable Object**
   - WebSocket protocol for query lifecycle
   - Audio streaming to Deepgram STT
   - Integration with Cypher generator and FalkorDB

2. **Implement Cypher Query Generator**
   - Llama 3.1-8b prompt engineering for NL → Cypher
   - Query templates for common patterns
   - Query validation and parameterization

3. **Build Query Execution Service**
   - Execute Cypher via FalkorDB connection pool
   - Result parsing and formatting
   - Cache frequent queries in KV

4. **Create API Endpoints**
   - POST /api/query/start (create session, return WebSocket URL)
   - WebSocket /ws/query/:session_id (real-time query updates)
   - GET /api/query/history (retrieve past queries)

5. **Update D1 Schema**
   - Add voice_queries table (query_id, user_id, question, cypher_query, results, timestamp)
   - Add indexes for fast query history retrieval

6. **Build Frontend Components**
   - QueryRecorder component (microphone, recording UI)
   - TranscriptDisplay component (real-time question display)
   - QueryResultsViewer component (display entities, relationships)

7. **Testing & Validation**
   - Test query generation accuracy (sample questions → Cypher)
   - Test query execution performance (latency, caching)
   - Test user isolation (queries don't leak across users)
   - Integration tests (voice → transcript → query → results)

---

## Technical Approach

### Architecture Pattern (Reuse Proven Pattern)

This feature **reuses the VoiceSessionManager pattern** from Feature 004:
- Durable Object manages WebSocket lifecycle
- Real-time Deepgram STT integration (already proven)
- Session state tracking in Durable Object
- D1 persistence for query history
- Similar API structure (start endpoint → WebSocket URL → real-time updates)

### Natural Language to Cypher Generation

**Approach**: Llama 3.1-8b with prompt engineering

**Prompt Template**:
```
You are a Cypher query expert. Convert the natural language question to a Cypher query for FalkorDB.

Knowledge graph schema:
- Nodes: Person, Project, Meeting, Topic, Technology, Location, Organization
- Relationships: WORKED_WITH, WORKS_ON, ATTENDED, DISCUSSED, USES_TECHNOLOGY, LOCATED_AT

User namespace: {user_namespace}

Question: "{user_question}"

Generate a valid Cypher query. Use parameterized queries. Return only the Cypher query, no explanation.

Cypher query:
```

**Query Templates** (for common patterns):
- Entity lookup: `MATCH (n:{EntityType} {name: $name}) RETURN n`
- Relationship query: `MATCH (a:{TypeA})-[:{RelType}]->(b:{TypeB}) WHERE a.name = $name RETURN b`
- Temporal query: `MATCH (n:{NodeType}) WHERE n.date >= date() - duration($period) RETURN n`

### Query Execution Flow

```
1. User clicks "Ask Question" button
2. Frontend requests WebSocket URL: POST /api/query/start
3. Server creates QuerySessionManager DO, returns wss://... URL
4. Frontend connects WebSocket, starts recording audio
5. Audio chunks stream to QuerySessionManager
6. QuerySessionManager streams audio to Deepgram STT
7. Deepgram returns transcript in real-time
8. On recording stop, QuerySessionManager:
   a. Sends transcript to Llama 3.1-8b for Cypher generation
   b. Validates generated Cypher query
   c. Executes query via FalkorDB connection pool
   d. Parses results and formats JSON
   e. Caches query + results in KV (1-hour TTL)
   f. Saves to D1 voice_queries table
   g. Sends results to frontend via WebSocket
9. Frontend displays results (entity cards, relationship graph preview)
```

### Performance Optimizations

- **Query Caching**: Cache Cypher queries by question hash (KV, 1-hour TTL)
- **Result Caching**: Cache query results by Cypher hash (KV, 1-hour TTL)
- **Connection Pooling**: Reuse FalkorDB connections from existing pool
- **Streaming**: Stream transcript updates in real-time (perceived speed)
- **Lazy Loading**: Load query history on demand, not all at once

### Security Considerations

- **User Namespace Isolation**: All Cypher queries scoped to `user_{uuid}_graph`
- **Query Validation**: Validate generated Cypher before execution (no DELETE/DROP allowed)
- **Parameterized Queries**: Use parameterized queries to prevent injection
- **Rate Limiting**: Max 30 queries per hour per user (prevent abuse)
- **Session Authentication**: WebSocket connections require valid JWT token

---

## Success Criteria

This feature will be considered complete when:

- ✅ Users can record voice questions and see real-time transcription
- ✅ Natural language questions convert to valid Cypher queries (90%+ accuracy for supported types)
- ✅ Queries execute and return results within 500ms (uncached) or 100ms (cached)
- ✅ Query results display correctly in frontend (entities, relationships, metadata)
- ✅ Query history persisted in D1 and retrievable via API
- ✅ User namespace isolation verified (10/10 security tests pass)
- ✅ Zero cross-user data leakage under any query conditions
- ✅ Performance targets met: STT <2s, Cypher gen <3s, query exec <500ms
- ✅ Error handling graceful (invalid queries, empty results, API failures)
- ✅ Comprehensive test suite (unit + integration tests)
- ✅ Complete documentation (API docs, query templates, example usage)

---

## Next After This

Once this spec (Feature 008) is complete, the next logical steps will be:

1. **Feature 009: Answer Generation with LLM** (~15,000 tokens)
   - Convert query results to natural language answers using Llama 3.1-8b
   - Source citation (which notes/entities)
   - "I don't know" handling (no hallucinations)
   - Answer quality evaluation

2. **Feature 010: Text-to-Speech Responses** (~10,000 tokens)
   - Deepgram Aura-1/Aura-2 TTS integration
   - Audio streaming to frontend
   - Synchronized text + audio display
   - Pause/resume/skip controls

3. **Feature 011: Conversation Context** (~12,000 tokens)
   - Multi-turn conversations
   - Follow-up question support ("What else?", "Tell me more")
   - Context window management (last 3 exchanges)
   - Session continuity

**After Phase 3 Complete - Phase 4 Required Features**:

4. **Feature 012: Graph Visualization** (~18,000 tokens) - **HIGH PRIORITY**
   - Interactive graph visualization (D3.js or Vis.js)
   - Node color coding by entity type
   - Relationship labels and edge styling
   - Click node to see entity details
   - Zoom, pan, drag interactions
   - Filter by entity type
   - Search for specific entities
   - Mobile-friendly visualization

5. **Feature 013: Full-Text Search** (~12,000 tokens)
   - Search across notes and entities
   - Fuzzy matching and autocomplete
   - Search filters (date range, entity type)
   - Result ranking by relevance

6. **Feature 014: Manual Entity Management** (~15,000 tokens)
   - Create/edit/delete entities manually
   - Merge duplicate entities
   - Create/edit relationships
   - Entity property editing
   - Undo support

**Then Phase 5: Advanced Features** (optional enhancements)
- Multi-source ingestion (URLs, files, text paste)
- Advanced analytics and insights
- Export/import functionality
- Multi-user collaboration

---

## References

- **PRD Phase**: [docs/PRD/phases/phase-3-voice-query.md](phases/phase-3-voice-query.md)
- **PRD Section**: [Section 3.3 Voice Query System](REQUIREMENTS-PRD.md#33-voice-query-system)
- **Related Specs**:
  - [specs/004-voice-note-capture](../../specs/004-voice-note-capture) - VoiceSessionManager pattern to reuse
  - [specs/003-falkordb-connection](../../specs/003-falkordb-connection) - FalkorDB connection pool ready
  - [specs/006-knowledge-graph-building](../../specs/006-knowledge-graph-building) - Knowledge graph populated and queryable
- **Technical Docs**:
  - [Database Schemas](technical/database-schemas.md) - D1 schema for voice_queries table
  - [API Specifications](technical/api-specifications.md) - Query API endpoint specs

---

## Notes for Implementation

**Reuse Existing Infrastructure**:
- VoiceSessionManager pattern proven in Feature 004
- Deepgram STT integration already working (Nova-3 streaming)
- FalkorDB connection pooling ready (Feature 003)
- Entity cache and KV utilities available (Feature 005)

**Cypher Generation Strategy**:
- Start with query templates for common patterns (80% coverage)
- Use Llama 3.1-8b for complex queries (20% edge cases)
- Validate all generated queries before execution
- Log query generation failures for prompt improvement

**User Experience Priorities**:
- Real-time feedback (streaming transcript, "Generating query...", "Searching graph...")
- Clear error messages ("I didn't understand that question", "No results found")
- Show Cypher query in debug mode (help users understand what's happening)
- Query history easily accessible (recent queries sidebar)

**Testing Priorities**:
- Query generation accuracy (test suite of 50 sample questions)
- Performance under load (10 concurrent queries)
- User isolation (cross-user query attempts should fail)
- Cache effectiveness (hit rate >70% for repeated queries)

**Future Extensibility**:
- Design query generator to support additional query types (Phase 5)
- Schema-aware query generation (automatically detect available node types)
- Query suggestion system (learn from user query patterns)
- Multi-language support (query in any language, translate to English for Cypher gen)
