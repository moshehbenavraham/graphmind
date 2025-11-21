# Software Requirements Document
## GraphMind: Voice-First Personal Knowledge Assistant

**Version:** 1.0
**Date:** November 10, 2025
**Document Owner:** Development Team
**Status:** Draft

---

## 📊 Implementation Status

**Last Updated**: 2025-11-14
**Current Phase**: Phase 3 - Voice Query System (67% complete)
**Next Priority**: [Feature 010: Text-to-Speech Responses](NEXT_SPEC.md)

### Completed Components

| Component | Spec | Completed | Validation |
|-----------|------|-----------|------------|
| Wrangler Configuration & Project Setup | [001-wrangler-setup](../../specs/001-wrangler-setup) | 2025-11-10 | ✅ Production Ready |
| Authentication System | [002-auth-system](../../specs/002-auth-system) | 2025-11-10 | ✅ Production Ready |
| FalkorDB Connection & Pooling | [003-falkordb-connection](../../specs/003-falkordb-connection) | 2025-11-11 | ✅ Production Ready |
| Voice Note Capture & Transcription | [004-voice-note-capture](../../specs/004-voice-note-capture) | 2025-11-11 | ✅ Production Ready |
| Entity Extraction Pipeline | [005-entity-extraction](../../specs/005-entity-extraction) | 2025-11-11 | ✅ Production Ready |
| Knowledge Graph Building | [006-knowledge-graph-building](../../specs/006-knowledge-graph-building) | 2025-11-12 | ✅ Production Ready |
| Voice Query Input & Graph Querying | [008-voice-query-input](../../specs/008-voice-query-input) | 2025-11-13 | ⚠️ Needs E2E testing + deployment |
| Answer Generation with LLM | [009-answer-generation](../../specs/009-answer-generation) | 2025-11-14 | ⚠️ Needs D1 migration + deployment |

### Phase 1 Complete ✅ (100%)

- Wrangler Configuration & Project Setup
- Authentication System (JWT, bcrypt, sessions)
- FalkorDB Connection & Pooling (Durable Objects)

### Phase 2 Complete ✅ (100%)

- Voice Note Capture & Transcription (WebRTC, Deepgram STT, WebSocket)
- Entity Extraction Pipeline (Llama 3.1-8b, fuzzy matching, KV caching)
- Knowledge Graph Building (FalkorDB GraphRAG, auto-deduplication)

### Phase 3 In Progress 🔄 (67% complete, 2/3 features)

**✅ Complete**:
- Feature 008: Voice Query Input & Graph Querying (282/282 tasks, ⚠️ needs E2E testing + deployment)
- Feature 009: Answer Generation with LLM (223/223 tasks, ⚠️ needs D1 migration + deployment)

**🎯 Next (See [NEXT_SPEC.md](NEXT_SPEC.md))**:
- Feature 010: Text-to-Speech Responses (Deepgram Aura TTS, audio streaming)

**🔲 Remaining**:
- Feature 011: Conversation Context Management (blocked by Feature 010)

### Codebase Overview

**Directories**:
- ✅ `src/` - Worker source files (index.js, workers, lib, middleware)
- ✅ `src/lib/auth/` - Authentication utilities (JWT, bcrypt, sessions)
- ✅ `src/lib/falkordb/` - FalkorDB client library (client, namespace, operations, errors)
- ✅ `src/lib/entity-utils/` - Entity extraction utilities (key generator, confidence filter, prompt builder)
- ✅ `src/lib/db/` - D1 query helpers (voice notes, entity cache)
- ✅ `src/lib/kv/` - KV cache utilities (entity resolution cache)
- ✅ `src/durable-objects/` - FalkorDBConnectionPool, VoiceSessionManager
- ✅ `src/workers/api/` - API endpoint handlers (auth, health, graph, notes, entities)
- ✅ `src/workers/consumers/` - Queue consumers (entity extraction)
- ✅ `src/services/` - Business logic (entity extraction, entity resolution, extraction jobs)
- ✅ `src/models/` - Data models (entity, extraction job)
- ✅ `src/middleware/` - Rate limiting and auth middleware
- ✅ `migrations/` - D1 database migrations (3 applied)
- ✅ `tests/` - Unit tests (entity-key-generator, confidence-filter)
- ✅ `test-data/` - Sample transcripts for testing

**Key Files**:
- ✅ `wrangler.toml` - Complete Cloudflare configuration (Workers, DO, Queues, D1, KV, R2, AI)
- ✅ `package.json` - Dependencies (bcryptjs, jsonwebtoken, redis-on-workers)
- ✅ `src/index.js` - Main Worker with complete routing (15 endpoints + WebSocket + queue consumer export)
- ✅ `migrations/0003_entity_extraction.sql` - Entity extraction schema (voice_notes columns + entity_cache table)
- ✅ `.env.example` - Environment variable template
- ✅ `README.md` - Complete setup and deployment guide
- ✅ `CLAUDE.md` - Project guidance for Claude Code

**Database**:
- D1 Tables: 4 tables (users, sessions, voice_notes with entity columns, entity_cache)
- FalkorDB: Connection pool ready, user namespaces provisioned on demand
- Migrations Applied: 3 (0001_initial, 0002_voice_notes, 0003_entity_extraction)

**API Endpoints**:
- 15 REST endpoints implemented:
  - Authentication: register, login, logout, /me
  - Health: /, /api/health, /api/health/falkordb
  - Graph: /api/graph/init, /api/test/falkordb
  - Voice Notes: POST /api/notes/start-recording, GET /api/notes, GET /api/notes/:id, DELETE /api/notes/:id
  - Entity Extraction: POST /api/notes/:id/extract-entities, GET /api/notes/:id/entities, POST /api/entities/extract-batch, GET /api/entities/cache/:key
- 1 WebSocket endpoint: GET /ws/notes/:session_id (voice transcription streaming)

**Cloudflare Services Configured**:
- ✅ Workers (graphmind-api) - Live in production
- ✅ D1 Database (graphmind-db) - 3 migrations applied locally
- ✅ KV Namespaces (GRAPHMIND_KV, RATE_LIMIT) - Active
- ✅ R2 Bucket (graphmind-audio) - Ready for audio storage
- ✅ Workers AI binding - Deepgram STT (used), Llama 3.1-8b (used)
- ✅ Durable Objects (FalkorDBConnectionPool, VoiceSessionManager) - Production ready
- ✅ Cloudflare Queues (entity-extraction-jobs with DLQ) - Configured, consumer implemented

### Next Priority

**🎯 Complete Entity Extraction Pipeline** - [See validation report](../../specs/005-entity-extraction/validation.md)

Core implementation complete (38%), testing phase needed (4-5 days to deployment).

**Remaining Work**:
1. Implement rate limiting (T077-T078) - 4 hours
2. Add VoiceSessionManager extraction hook (T068) - 2 hours
3. Create test dataset and accuracy testing (T033-T044) - 2-3 days
4. Integration testing and performance benchmarking (T083-T096) - 1 day
5. Apply production D1 migration and deploy (T097-T102) - 4 hours

**P1 Blockers** (must fix before deployment):
- Unit tests missing for core services
- No accuracy testing (>85% F1 score requirement)
- No cache performance testing (70% hit rate requirement)
- Rate limiting not implemented (security vulnerability)
- Integration testing missing
- VoiceSessionManager hook missing (automatic extraction)
- Performance benchmarking not done (<3s latency requirement)
- Production D1 migration not applied

**After Entity Extraction Complete**:
- Run `/validate` to confirm ✅ Ready status
- Feature 006: Knowledge Graph Building in FalkorDB
- Feature 007: Basic graph visualization UI
- Phase 3: Voice query system

---

## 1. Executive Summary

### 1.1 Vision

**GraphMind** is an open-source, voice-first personal knowledge assistant that runs entirely on Cloudflare's edge network. It combines real-time voice AI (custom Durable Object pipeline with Workers AI) with graph-based retrieval-augmented generation (FalkorDB GraphRAG) to create an intelligent "second brain" that captures, organizes, and retrieves your personal knowledge through natural conversation.

**The Problem:** Traditional note-taking and knowledge management tools require typing, organizing, and searching manually. Voice notes get lost. Information silos form. Retrieval is difficult.

**The Solution:** Speak naturally to capture thoughts, ideas, notes, and bookmarks. GraphMind automatically builds a knowledge graph of entities and relationships, then lets you query your knowledge conversationally with intelligent, contextual answers.

### 1.2 Market Context

The "second brain" market is exploding in 2025:
- **TwinMind** raised $5.7M (Sequoia Capital) for AI-powered speech capture + knowledge graphs
- **30,000+ users** for ambient voice knowledge management
- Market shifting from monolithic apps to **modular, AI-powered ecosystems**
- Voice interfaces becoming **primary input method** for knowledge capture

**Our Differentiators:**
- [x] **100% open source** (vs proprietary solutions)
- [x] **Runs on Cloudflare edge** (ultra-fast, globally distributed, low cost)
- [x] **GraphRAG** (90%+ accuracy vs 56% traditional RAG - FalkorDB benchmarks)
- [x] **Minimal infrastructure** (~$20/month production vs $100s)
- [x] **Privacy-first** (your data, your infrastructure)
- [x] **Developer-friendly** (extensible, hackable, open source)

### 1.3 Core Features (Minimal V1)

1. **Voice Capture** - Speak to add notes, thoughts, ideas, bookmarks
2. **Auto Knowledge Graph** - Entities and relationships extracted automatically
3. **Voice Query** - Ask questions conversationally about your knowledge
4. **GraphRAG Retrieval** - Intelligent answers using knowledge graph traversal
5. **Web Interface** - Simple, clean UI for voice interaction and graph visualization
6. **Multi-Source Ingestion** - Import from URLs, files, text (future)

### 1.4 Technology Stack (Cloudflare-First)

**Frontend:**
- Cloudflare Pages (static hosting)
- React or Vanilla JS (minimal)
- WebRTC for voice capture

**Backend:**
- Cloudflare Workers (API + orchestration)
- Cloudflare Durable Objects (custom QuerySessionManager for voice sessions + FalkorDB connection pool)
- Workers AI (Deepgram Nova-3 STT, Deepgram Aura-2 TTS, `@cf/meta/llama-3.1-8b-instruct` for entity extraction)

**Data Storage:**
- FalkorDB (flexible deployment - see [deployment options](technical/falkordb-deployment.md))
  - **Development**: Self-hosted Docker (localhost, sub-millisecond performance)
  - **Production**: Self-hosted VPS or FalkorDB Cloud (TBD)
- D1 (user metadata, sessions, light relational data)
- R2 (audio recordings - optional)
- KV (caching frequent queries)

**Voice AI:**
- Custom WebSocket voice pipeline (QuerySessionManager Durable Object)
- Deepgram Nova-3 (speech-to-text) via Workers AI (`@cf/deepgram/nova-3`)
- Deepgram Aura-2 (text-to-speech) via Workers AI (`@cf/deepgram/aura-2`)
- 8-event WebSocket protocol for real-time audio streaming
- Optional: Pipecat smart-turn-v2 model available (not currently implemented)

**Architecture Note**: See `docs/architecture/ADR-001-voice-pipeline-implementation.md` for why custom Durable Object implementation was chosen over Cloudflare Realtime Agents SDK.

**Knowledge Graph:**
- FalkorDB GraphRAG SDK (Python)
- LiteLLM integration (multi-model support)
- Cypher query generation
- Ontology auto-detection

---

## 2. System Architecture

### 2.1 High-Level Architecture

```

                    User (Browser/Mobile)                     
                   
    Web Interface   WebRTC Voice          
    (Pages)                       Capture/Playback      
                   

                        
                        | HTTPS/WSS

              Cloudflare Edge Network (Global)                
                                                               
    
     Durable Objects      |

      QuerySessionManager (Custom Implementation)
      - WebSocket connections & protocol (8 events)
      - Audio chunking & buffering (WebM)
      - Workers AI integration (STT/TTS)
      - Session state management
      - FalkorDB connection pool                       
         
   
                                                             
   
     Workers              |                               
         
      API Endpoints                                    
      - /api/capture (voice note)                      
      - /api/query (voice question)                    
      - /api/graph (visualize KG)                      
         
   
                                                             
   
     Workers AI           |
    - Deepgram Nova-3 (STT)
    - Deepgram Aura-2 (TTS)
    - @cf/meta/llama-3.1-8b-instruct (entity, Q&A)
    - Optional: @cf/pipecat/smart-turn-v2 (not implemented)             
   
                                                             
   
     Storage              |                               
    - D1: users, sessions, metadata                       
    - KV: query cache, config                             
    - R2: audio recordings (optional)                     
   

                        
                        | External Service

                    FalkorDB (Knowledge Graph)                
                                                               
    
    GraphRAG SDK                                           
    - Knowledge graph storage                              
    - Ontology management                                  
    - Cypher query generation                              
    - GraphRAG retrieval                                   
    
                                                               
  Deploy: FalkorDB Cloud (managed service)
  - Starter tier: $15/mo (recommended for MVP)
  - Pro tier: $50/mo (for scale)
  - 99.95% SLA with automatic failover                          

```

### 2.2 Data Flow: Voice Note Capture

```
User speaks -> WebSocket connection
       |
QuerySessionManager (Durable Object)
       |
Deepgram Nova-3 STT (Workers AI) -> "I met with Sarah about the Python FastAPI project"
       |
@cf/meta/llama-3.1-8b-instruct entity extraction -> Entities: [Person: Sarah, Project: Python FastAPI, Topic: Meeting]
       |
FalkorDB GraphRAG SDK
       |
Knowledge Graph Update:
  - Create/merge Node: Person(name: Sarah)
  - Create/merge Node: Project(name: Python FastAPI, tech: Python)
  - Create/merge Node: Meeting(date: 2025-11-10)
  - Create Relationship: (Meeting)-[:WITH]->(Person)
  - Create Relationship: (Meeting)-[:ABOUT]->(Project)
       |
Store in D1: note_id, timestamp, transcript, audio_url
       |
Return success to user
```

### 2.3 Data Flow: Voice Query

```
User asks -> "What did I discuss with Sarah last week?"
       |
WebRTC stream -> Deepgram STT
       |
Natural language question -> FalkorDB GraphRAG SDK
       |
Cypher query generation:
MATCH (m:Meeting)-[:WITH]->(p:Person {name: "Sarah"})
WHERE m.date >= date() - duration('P7D')
RETURN m, p
       |
Execute query -> Results: [Meeting about Python FastAPI on Nov 3]
       |
@cf/meta/llama-3.1-8b-instruct answer generation with context
       |
"Last week on November 3rd, you met with Sarah to discuss the Python FastAPI project."
       |
Deepgram TTS -> Audio response
       |
Stream back to user via WebRTC
```

---

## 3. Functional Requirements

### 3.1 User Management

#### 3.1.1 User Registration
**ID**: FR-UM-001
**Priority**: High
**Description**: Users can create an account to start their personal knowledge graph.

**Requirements**:
- Email and password registration
- Email verification
- Create user workspace in FalkorDB (isolated graph)
- Initialize empty knowledge graph with base ontology
- Store user metadata in D1

**Acceptance Criteria**:
- User successfully registers with valid email
- Verification email sent within 5 seconds
- Isolated knowledge graph created in FalkorDB
- User can log in immediately after verification

---

#### 3.1.2 User Authentication
**ID**: FR-UM-002
**Priority**: High
**Description**: Secure login with session management.

**Requirements**:
- Email/password login
- JWT session tokens (24-hour expiration)
- Session stored in KV
- Rate limiting (5 attempts per 15 minutes)

**Acceptance Criteria**:
- Valid credentials grant access
- Sessions persist across refreshes
- Invalid credentials rejected after 5 attempts
- Secure password hashing (bcrypt)

---

### 3.2 Voice Note Capture

#### 3.2.1 Voice Recording
**ID**: FR-NC-001
**Priority**: Critical
**Description**: Users can record voice notes by speaking naturally.

**Requirements**:
- Click "Record" button to start
- WebRTC audio capture (Opus codec)
- Real-time waveform visualization
- Maximum 5-minute recording length
- "Stop" and "Cancel" options
- Automatic silence detection (stop after 3 seconds of silence)
- Live transcription display during recording

**Technical Stack**:
- Browser MediaRecorder API
- WebRTC -> Durable Object WebSocket
- Deepgram Nova-3 for real-time STT
- Audio buffering in Durable Object

**Acceptance Criteria**:
- Recording starts within 500ms of clicking Record
- Waveform displays in real-time
- Transcription appears with <2 second latency
- Audio stops automatically after 3 seconds silence
- User can cancel without saving

**Implementation Reference**:
- Durable Objects: https://developers.cloudflare.com/durable-objects/
- Workers AI (Deepgram): https://developers.cloudflare.com/workers-ai/models/
- WebSocket API: https://developers.cloudflare.com/workers/runtime-apis/websockets/

---

#### 3.2.2 Entity Extraction
**ID**: FR-NC-002
**Priority**: Critical
**Description**: Automatically extract entities and relationships from voice notes.

**Requirements**:
- Extract entities: People, Projects, Topics, Dates, Locations, Organizations, Technologies
- Extract relationships: met_with, discussed, worked_on, located_at, happened_on
- Use `@cf/meta/llama-3.1-8b-instruct` via Workers AI for extraction
- Handle ambiguity (e.g., "John" -> resolve to existing "John Smith" in graph)
- Confidence scores for entities (>0.8 threshold)
- User confirmation for ambiguous entities

**Entity Schema Examples**:
```cypher
// Person
CREATE (p:Person {
  name: "Sarah Johnson",
  first_mentioned: "2025-11-10T10:30:00Z",
  mention_count: 5
})

// Project
CREATE (proj:Project {
  name: "Python FastAPI Migration",
  technology: "Python",
  framework: "FastAPI",
  status: "in_progress"
})

// Meeting
CREATE (m:Meeting {
  date: "2025-11-10",
  topic: "API architecture discussion",
  duration_minutes: 45
})

// Relationships
CREATE (m)-[:WITH]->(p)
CREATE (m)-[:ABOUT]->(proj)
```

**Acceptance Criteria**:
- Entities extracted within 3 seconds of recording stop
- >85% accuracy for common entity types
- Relationships correctly identified
- Ambiguous entities flagged for user confirmation
- Knowledge graph updated atomically

**Reference Implementations**:
- FalkorDB GraphRAG SDK: https://github.com/FalkorDB/GraphRAG-SDK
- LLM entity extraction patterns

---

#### 3.2.3 Knowledge Graph Update
**ID**: FR-NC-003
**Priority**: Critical
**Description**: Update knowledge graph with extracted entities and relationships.

**Requirements**:
- Create new entities if not exists
- Merge with existing entities (fuzzy matching)
- Create relationships between entities
- Update entity properties (e.g., mention_count++)
- Handle conflicts (user chooses if ambiguous)
- Transactional updates (all-or-nothing)
- Maintain temporal ordering (first_seen, last_seen timestamps)

**Graph Operations**:
```python
from graphrag_sdk import KnowledgeGraph, Ontology

# Initialize
kg = KnowledgeGraph(ontology=auto_ontology)

# Add entities
kg.process_text("""
I met with Sarah about the Python FastAPI project.
We discussed migrating the REST API from Flask.
""")

# Entities created:
# - Person: Sarah
# - Project: Python FastAPI
# - Technology: Flask, FastAPI
# - Action: Migration
# - Event: Meeting
```

**Acceptance Criteria**:
- Entities merged correctly (no duplicates)
- Relationships created accurately
- Graph remains consistent (ACID properties)
- Query performance <100ms for simple lookups
- Support for 10,000+ entities per user

---

#### 3.2.4 Note Persistence
**ID**: FR-NC-004
**Priority**: High
**Description**: Store voice notes with metadata and optional audio.

**Requirements**:
- Store in D1:
  - note_id, user_id, timestamp, transcript, entities_json
  - processing_status (pending/completed/failed)
- Store audio in R2 (optional, user preference):
  - Key: `{user_id}/audio/{note_id}.opus`
  - Retention: 90 days (configurable)
- Link to knowledge graph nodes (note_id stored as property)

**D1 Schema**:
```sql
CREATE TABLE voice_notes (
    note_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    transcript TEXT NOT NULL,
    audio_r2_key TEXT,
    entities_extracted JSON,
    relationships_created JSON,
    processing_status TEXT DEFAULT 'pending',
    confidence_score REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_notes_user ON voice_notes(user_id);
CREATE INDEX idx_notes_created ON voice_notes(created_at);
```

**Acceptance Criteria**:
- Notes saved to D1 within 1 second
- Audio uploaded to R2 in background
- Processing status accurate
- Full-text search on transcripts works

---

### 3.3 Voice Query System

#### 3.3.1 Voice Question Input
**ID**: FR-VQ-001
**Priority**: Critical
**Description**: Users can ask questions via voice about their knowledge.

**Requirements**:
- "Ask" button to trigger query mode
- WebRTC audio streaming (same as capture)
- Real-time STT (Deepgram Nova-3)
- Live transcription display
- Support for follow-up questions (conversation context)
- Maximum 1-minute question length

**Example Questions**:
- "What did I discuss with Sarah last week?"
- "Show me all my notes about Python projects"
- "When did I last work on the FastAPI migration?"
- "Who have I met this month?"
- "What are my open action items?"

**Acceptance Criteria**:
- Question transcribed within 2 seconds
- Conversation context maintained (3 previous exchanges)
- Complex questions handled (multi-entity queries)
- Clear error messages for unclear questions

---

#### 3.3.2 Cypher Query Generation
**ID**: FR-VQ-002
**Priority**: Critical
**Description**: Convert natural language questions to Cypher queries.

**Requirements**:
- Use FalkorDB GraphRAG SDK query generation
- Leverage ontology for entity/relationship types
- Handle temporal queries (last week, this month, recently)
- Support aggregations (count, list, summarize)
- Query validation before execution
- Fallback to general search if Cypher generation fails

**Example Conversions**:
```python
# Question: "What did I discuss with Sarah last week?"
# Generated Cypher:
MATCH (m:Meeting)-[:WITH]->(p:Person {name: "Sarah"})
WHERE m.date >= date() - duration('P7D')
RETURN m.topic, m.date, m.notes
ORDER BY m.date DESC

# Question: "Show me all Python projects"
# Generated Cypher:
MATCH (proj:Project)-[:USES_TECHNOLOGY]->(t:Technology {name: "Python"})
RETURN proj.name, proj.status, proj.description

# Question: "Who have I met this month?"
# Generated Cypher:
MATCH (m:Meeting)-[:WITH]->(p:Person)
WHERE m.date >= date({year: date().year, month: date().month, day: 1})
RETURN DISTINCT p.name, count(m) as meeting_count
ORDER BY meeting_count DESC
```

**Acceptance Criteria**:
- 90%+ query generation accuracy for common patterns
- Handles temporal expressions correctly
- Validates queries before execution
- Provides explanation of generated query (optional debug mode)

**Reference Implementations**:
- FalkorDB GraphRAG SDK Cypher generation
- LangChain graph query patterns

---

#### 3.3.3 GraphRAG Retrieval
**ID**: FR-VQ-003
**Priority**: Critical
**Description**: Execute graph queries and retrieve contextual results.

**Requirements**:
- Execute Cypher query on FalkorDB
- Retrieve subgraph (nodes + relationships)
- Include relevant context (connected entities)
- Sort by relevance (recency, relationship strength)
- Return structured results (JSON)
- Cache frequent queries in KV (1 hour TTL)

**Retrieval Strategy**:
```python
# Multi-hop retrieval for context
# 1. Find direct match entities
# 2. Expand to connected entities (1-2 hops)
# 3. Rank by relevance (PageRank, betweenness)
# 4. Return top-K results (default: 10)

from graphrag_sdk import KnowledgeGraph

kg = KnowledgeGraph()
results = kg.query(
    "What did I discuss with Sarah?",
    mode="chat",  # conversational mode
    max_results=10
)
```

**Acceptance Criteria**:
- Queries execute within 500ms (uncached)
- Queries execute within 100ms (cached)
- Relevant context included (not just direct matches)
- Results ranked by relevance
- Handles empty results gracefully

**Reference Implementations**:
- FalkorDB GraphRAG accuracy benchmarks (90%+)

---

#### 3.3.4 Natural Language Answer Generation
**ID**: FR-VQ-004
**Priority**: Critical
**Description**: Generate natural language answers from graph results.

**Requirements**:
- Use `@cf/meta/llama-3.1-8b-instruct` via Workers AI
- Include retrieved graph context in prompt
- Generate conversational, human-like responses
- Cite sources (which notes/entities)
- Handle "I don't know" gracefully (no hallucinations)
- Support follow-up questions with context

**Answer Generation Prompt Template**:
```
System: You are a helpful personal knowledge assistant. Answer questions based on the user's knowledge graph.

Context from knowledge graph:
{graph_results}

User question: {user_question}

Instructions:
- Answer based ONLY on the provided context
- If no relevant information exists, say "I don't have any notes about that"
- Be concise but informative
- Include specific dates/names/details when available
- Cite which notes the information came from

Answer:
```

**Acceptance Criteria**:
- Answers generated within 2 seconds
- No hallucinations (only uses graph data)
- Conversational tone (not robotic)
- Includes citations (note timestamps)
- Gracefully handles missing information

---

#### 3.3.5 Voice Response
**ID**: FR-VQ-005
**Priority**: High
**Description**: Speak answers back to user via TTS.

**Requirements**:
- Use Deepgram Aura-1 or Aura-2 for TTS (Workers AI)
- Stream audio response via WebRTC
- Display text transcript simultaneously
- Natural voice (not robotic)
- Support pause/resume playback
- Allow users to skip to text-only mode

**Acceptance Criteria**:
- Audio starts playing within 1 second of answer generation
- Voice sounds natural and clear
- Text and audio stay synchronized
- User can skip to text-only
- Works on all major browsers

---

### 3.4 Knowledge Graph Management

#### 3.4.1 Graph Visualization
**ID**: FR-KG-001
**Priority**: Medium
**Description**: Visual representation of personal knowledge graph.

**Requirements**:
- Interactive graph visualization
- Node types color-coded (Person=blue, Project=green, Topic=orange, etc.)
- Relationship labels displayed
- Click node to see details
- Zoom, pan, drag nodes
- Filter by entity type
- Search for specific entities
- Export graph as image (PNG/SVG)

**Visualization Library Options**:
- D3.js (customizable, powerful)
- Vis.js (easier, pre-built graph layouts)
- Cytoscape.js (biology-focused but good for general graphs)

**Acceptance Criteria**:
- Graph loads within 3 seconds for <1000 nodes
- Interactive controls responsive (<100ms)
- Color coding clear and consistent
- Mobile-friendly (touch gestures)

**Reference Implementations**:
- Neo4j Bloom visualization patterns
- FalkorDB graph visualization examples

---

#### 3.4.2 Entity Management
**ID**: FR-KG-002
**Priority**: Medium
**Description**: Manual entity creation, editing, merging, deletion.

**Requirements**:
- Create entities manually (form input)
- Edit entity properties
- Merge duplicate entities
- Delete entities (cascade to relationships)
- Undo entity operations (24-hour history)
- Bulk operations (tag multiple entities)

**Entity Operations**:
```python
# Create
CREATE (p:Person {name: "John Doe", email: "john@example.com"})

# Update
MATCH (p:Person {name: "John Doe"})
SET p.email = "john.doe@example.com", p.updated_at = timestamp()

# Merge duplicates
MATCH (p1:Person {name: "John"}), (p2:Person {name: "John Doe"})
CALL apoc.refactor.mergeNodes([p1, p2]) YIELD node
RETURN node

# Delete (cascade)
MATCH (p:Person {name: "John Doe"})
DETACH DELETE p
```

**Acceptance Criteria**:
- CRUD operations complete within 1 second
- Merge preserves all relationships
- Delete cascades correctly
- Undo works for 24 hours
- No orphaned nodes

---

#### 3.4.3 Relationship Management
**ID**: FR-KG-003
**Priority**: Medium
**Description**: Create, edit, delete relationships between entities.

**Requirements**:
- Create relationships (select entities + type)
- Edit relationship properties (strength, notes)
- Delete relationships
- Visualize all relationships for an entity
- Suggest new relationships (ML-based)

**Relationship Types**:
- WORKED_WITH (Person-Person)
- DISCUSSED (Meeting-Topic)
- USES_TECHNOLOGY (Project-Technology)
- LOCATED_AT (Person/Project-Location)
- HAPPENED_ON (Event-Date)
- OWNS (Person-Project)
- MENTIONED_IN (Entity-Note)

**Acceptance Criteria**:
- Relationships created/deleted instantly
- Suggestions >70% useful
- Properties editable
- Graph consistency maintained

---

#### 3.4.4 Ontology Management
**ID**: FR-KG-004
**Priority**: Low
**Description**: Define and modify knowledge graph schema/ontology.

**Requirements**:
- **Automatic ontology loading** from existing knowledge graphs (FalkorDB GraphRAG SDK v0.5+)
- View current ontology (entity types, relationship types)
- Add new entity types (e.g., "Book", "Recipe")
- Add new relationship types
- Define entity properties schema
- Import ontology from template
- Export ontology as JSON

**Default Ontology**:
```json
{
  "entity_types": [
    {"type": "Person", "properties": ["name", "email", "phone"]},
    {"type": "Project", "properties": ["name", "status", "technology"]},
    {"type": "Meeting", "properties": ["date", "topic", "attendees"]},
    {"type": "Topic", "properties": ["name", "category"]},
    {"type": "Technology", "properties": ["name", "version"]},
    {"type": "Location", "properties": ["name", "address"]},
    {"type": "Organization", "properties": ["name", "industry"]}
  ],
  "relationship_types": [
    {"type": "WORKED_WITH", "from": "Person", "to": "Person"},
    {"type": "DISCUSSED", "from": "Meeting", "to": "Topic"},
    {"type": "USES_TECHNOLOGY", "from": "Project", "to": "Technology"},
    {"type": "ATTENDED", "from": "Person", "to": "Meeting"},
    {"type": "OWNS", "from": "Person", "to": "Project"}
  ]
}
```

**Acceptance Criteria**:
- Ontology modifications reflected immediately
- Templates available for common domains
- Export/import works correctly
- Backward compatible with existing data

**Reference Implementations**:
- FalkorDB ontology auto-detection
- GraphRAG SDK ontology patterns

---

### 3.5 Multi-Source Data Ingestion

#### 3.5.1 URL Ingestion
**ID**: FR-IN-001
**Priority**: Medium
**Description**: Import knowledge from web URLs.

**Requirements**:
- Paste URL to import content
- Fetch webpage content (respect robots.txt)
- Extract main content (remove ads, navigation)
- Extract entities from content
- Add to knowledge graph
- Link to source URL (citation)
- Support for: articles, documentation, Wikipedia

**Technical Implementation**:
```python
from graphrag_sdk import Source

# Create source from URL
source = Source.from_url(
    "https://example.com/article",
    extract_text=True
)

# Process with FalkorDB GraphRAG SDK
kg.process_source(source)
```

**Acceptance Criteria**:
- URLs processed within 10 seconds
- Main content extracted accurately (>90%)
- Entities extracted from content
- Source URL stored for citation
- Handles paywalls gracefully (user warning)

---

#### 3.5.2 File Upload
**ID**: FR-IN-002
**Priority**: Medium
**Description**: Import knowledge from uploaded files.

**Requirements**:
- Upload files: PDF, TXT, DOCX, MD
- Extract text content
- Extract entities and relationships
- Add to knowledge graph with file reference
- Maximum file size: 10MB
- Batch processing for multiple files

**Supported Formats**:
- **PDF**: Text extraction, OCR if needed
- **TXT/MD**: Plain text processing
- **DOCX**: Text extraction with formatting
- **CSV**: Structured data import (future)
- **JSON**: Direct graph import (future)

**Acceptance Criteria**:
- Files processed within 30 seconds
- Text extraction accuracy >95%
- Entities extracted correctly
- File stored in R2 with reference
- Batch uploads work (up to 10 files)

**Reference Implementations**:
- FalkorDB GraphRAG SDK supports: PDF, JSONL, CSV, HTML, TEXT, URLs

---

#### 3.5.3 Text Paste
**ID**: FR-IN-003
**Priority**: High
**Description**: Quick paste of text content for processing.

**Requirements**:
- Text area for pasting content
- Process immediately on submit
- Extract entities and relationships
- Add to knowledge graph
- Support for up to 10,000 characters
- Markdown rendering for display

**Use Cases**:
- Meeting notes (paste from other apps)
- Copy-paste from emails
- Research notes
- Book excerpts
- Code snippets with context

**Acceptance Criteria**:
- Text processed within 5 seconds
- Entities extracted accurately
- Markdown rendered correctly
- Character limit enforced

---

### 3.6 Search and Discovery

#### 3.6.1 Full-Text Search
**ID**: FR-SD-001
**Priority**: Medium
**Description**: Search across all notes and entities.

**Requirements**:
- Search bar always visible
- Search notes transcripts (D1 full-text)
- Search entity names and properties
- Autocomplete suggestions
- Fuzzy matching (typo tolerance)
- Search filters: date range, entity type
- Results ranked by relevance

**Search Implementation**:
```sql
-- D1 Full-Text Search
CREATE VIRTUAL TABLE notes_fts USING fts5(
    note_id,
    transcript,
    entities_text,
    content='voice_notes'
);

-- Search query
SELECT * FROM notes_fts
WHERE notes_fts MATCH 'python OR fastapi'
ORDER BY rank
LIMIT 20;
```

**Acceptance Criteria**:
- Search results return within 500ms
- Autocomplete appears within 200ms
- Fuzzy matching works for common typos
- Filters work correctly
- Highlighting of matched terms

---

#### 3.6.2 Related Entities
**ID**: FR-SD-002
**Priority**: Low
**Description**: Discover related entities via graph traversal.

**Requirements**:
- "Related" tab on entity detail pages
- Show entities connected within 2 hops
- Rank by relationship strength (edge weight)
- Filter by relationship type
- Visualize connection path

**Example Queries**:
```cypher
// Find entities related to "Sarah"
MATCH (sarah:Person {name: "Sarah"})-[r*1..2]-(related)
RETURN DISTINCT related, type(r), length(r) as distance
ORDER BY distance, related.mention_count DESC
LIMIT 20
```

**Acceptance Criteria**:
- Related entities load within 1 second
- Results ranked sensibly
- Connection path visualized
- Works for all entity types

---

#### 3.6.3 Temporal Browse
**ID**: FR-SD-003
**Priority**: Low
**Description**: Browse notes chronologically.

**Requirements**:
- Timeline view of notes
- Group by: day, week, month
- Scroll infinite loading
- Filter by date range
- Calendar heatmap (activity visualization)

**Acceptance Criteria**:
- Timeline loads smoothly
- Infinite scroll works
- Date filters responsive
- Heatmap shows activity patterns

---

### 3.7 User Experience & Interface

#### 3.7.1 Web Interface
**ID**: FR-UX-001
**Priority**: High
**Description**: Clean, minimal web UI hosted on Cloudflare Pages.

**Requirements**:
- Single-page app (SPA) with routing
- Responsive design (mobile-first)
- Dark mode support
- Keyboard shortcuts
- Accessibility (WCAG 2.1 AA)
- Fast load time (<2 seconds)

**Pages**:
1. **Home/Dashboard**: Recent notes, quick record button, search bar
2. **Graph View**: Interactive visualization
3. **Notes List**: Chronological list of all notes
4. **Entity Detail**: Single entity with relationships
5. **Settings**: User preferences, integrations
6. **Search Results**: Full-text search results

**Tech Stack Options**:
- **React** + Vite (popular, fast)
- **Svelte** (smaller bundle, faster)
- **Vanilla JS** + Web Components (minimal)

**Acceptance Criteria**:
- Page load <2 seconds
- Smooth animations (60fps)
- Works on Chrome, Safari, Firefox
- Mobile responsive
- Dark mode toggle works

---

#### 3.7.2 Voice Interface
**ID**: FR-UX-002
**Priority**: Critical
**Description**: Voice-first interaction design.

**Requirements**:
- Large, prominent "Record" button
- Visual feedback during recording (waveform, pulsing)
- Live transcription display
- Push-to-talk option (hold button)
- Voice activation option ("Hey GraphMind")
- Clear status indicators (listening, processing, speaking)
- Error states clearly communicated

**Design Principles**:
- **Minimal clicks**: Record in 1 click
- **Clear feedback**: Always show what's happening
- **Forgiving**: Easy to cancel/retry
- **Fast**: Minimize latency at every step

**Acceptance Criteria**:
- Record button large, easy to hit
- Visual feedback immediate
- Status always clear
- Errors recoverable

---

#### 3.7.3 Progressive Web App (PWA)
**ID**: FR-UX-003
**Priority**: Low
**Description**: Installable PWA for offline access.

**Requirements**:
- Service Worker for caching
- Offline mode (view cached notes)
- Install prompts (mobile, desktop)
- App icon and splash screen
- Push notifications (future)

**Acceptance Criteria**:
- Installable on iOS, Android, Desktop
- Offline viewing works
- Cache invalidates appropriately
- Manifest.json properly configured

---

## 4. Non-Functional Requirements

### 4.1 Performance

**NFR-PF-001: Response Time**
- Voice transcription latency: <2 seconds
- Entity extraction: <3 seconds
- Graph query execution: <500ms (uncached), <100ms (cached)
- Answer generation: <2 seconds
- TTS audio playback: <1 second to start
- Page load time: <2 seconds
- Graph visualization: <3 seconds for <1000 nodes

**NFR-PF-002: Scalability**
- Support 10,000+ entities per user
- Support 1,000+ notes per user
- Handle 100+ concurrent voice sessions (per Durable Object)
- FalkorDB scales to millions of nodes/relationships

**NFR-PF-003: Throughput**
- 100 voice captures per hour per user
- 50 voice queries per hour per user
- 10 concurrent users per Durable Object

---

### 4.2 Reliability

**NFR-RL-001: Availability**
- Target: 99.9% uptime (8.76 hours downtime/year)
- FalkorDB availability: 99.95% (managed service)
- Cloudflare Workers: 99.99% (SLA)

**NFR-RL-002: Data Durability**
- FalkorDB: Redis persistence (RDB + AOF)
- D1: Automatic replication, daily backups
- R2: 99.999999999% durability
- No data loss for committed transactions

**NFR-RL-003: Error Handling**
- Graceful degradation (voice -> text fallback)
- Retry logic for transient failures (3 retries, exponential backoff)
- User-friendly error messages
- Automatic error logging

---

### 4.3 Security

**NFR-SC-001: Authentication**
- JWT tokens with 24-hour expiration
- Secure password hashing (bcrypt, cost factor 12)
- Session management in KV
- Rate limiting (login, API calls)

**NFR-SC-002: Data Privacy**
- User data isolated (separate FalkorDB namespaces)
- End-to-end encryption for voice in transit (WebRTC)
- Audio storage encryption at rest (R2)
- No cross-user data access
- GDPR-compliant data deletion

**NFR-SC-003: API Security**
- All endpoints require authentication
- CORS properly configured
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)
- No sensitive data in logs

---

### 4.4 Cost Efficiency

**NFR-CE-001: Infrastructure Costs**

**Target: ~$20/month for production deployment** (100 notes/month, 50 queries/month)

**Cloudflare Costs (Free Tier -> Paid)**:
- Workers: FREE (100,000 requests/day) -> $5/mo base (includes Workers, Pages, KV, Durable Objects)
- Workers AI: FREE during beta (no request limits published) -> Pricing TBA
- D1: FREE (5GB storage, 5M reads/day, 100K writes/day) -> $0.75/GB-month storage, $0.001/M rows read, $1.00/M rows written
- KV: Included in Workers Paid plan ($5/mo base)
- R2: FREE (10GB storage, 1M Class A ops) -> $0.015/GB/mo storage
- Pages: FREE (500 builds/month) -> FREE
- Durable Objects: Included in Workers Paid plan -> $0.15/million requests

**FalkorDB Deployment** (see [deployment options](technical/falkordb-deployment.md)):
- **Development**: Self-hosted Docker (localhost) - $0/month
- **Production Option A**: Self-hosted VPS - $10-25/month (recommended for cost)
- **Production Option B**: FalkorDB Cloud Starter - $15/month (recommended for managed service)
- **Production Option C**: FalkorDB Cloud Pro - $50/month (for production scale)

**Total Cost Estimate**:
- **Local Development**: $0/month (Self-hosted Docker + Cloudflare free tiers + Workers AI free during beta)
- **Production Light (VPS)**: $15-30/month (Self-hosted VPS $10-25 + Cloudflare Workers Paid $5)
- **Production Light (Managed)**: $20/month (FalkorDB Cloud Starter $15 + Cloudflare Workers Paid $5)
- **Production Heavy (Managed)**: $55+/month (FalkorDB Cloud Pro $50 + Cloudflare $5-20)

**Note**: Workers AI is currently **free during beta** (as of November 2025). Pricing will be announced when it exits beta. Cost estimates may change once Workers AI pricing is finalized.

**Cost Optimizations**:
- Aggressive caching in KV (reduce FalkorDB queries)
- Batch entity extraction (reduce LLM calls)
- Voice storage optional (save R2 costs)
- Production deployment decision TBD (self-hosted VPS vs FalkorDB Cloud)

---

### 4.5 Usability

**NFR-US-001: Ease of Use**
- Record voice note in 1 click
- Query knowledge in 1 click
- No training required (natural conversation)
- Mobile-friendly (works on phone)

**NFR-US-002: Accessibility**
- WCAG 2.1 AA compliance
- Screen reader support
- Keyboard navigation
- High contrast mode
- Transcripts for all audio

---

### 4.6 Maintainability

**NFR-MT-001: Code Quality**
- TypeScript for type safety
- Unit tests (>80% coverage)
- Integration tests for critical flows
- Documentation for all components
- Follow Cloudflare Workers best practices

**NFR-MT-002: Observability**
- Structured logging (Cloudflare Workers Analytics)
- Error tracking and alerting
- Performance monitoring
- Usage metrics (notes created, queries run)

---

## 5. Database Schemas

### 5.1 D1 Schema (SQLite)

```sql
-- Users
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    falkordb_namespace TEXT NOT NULL, -- isolated graph per user
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_users_email ON users(email);

-- Voice Notes
CREATE TABLE voice_notes (
    note_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    transcript TEXT NOT NULL,
    audio_r2_key TEXT, -- optional audio storage
    entities_extracted JSON, -- cached entity list
    relationships_created JSON, -- cached relationship list
    processing_status TEXT DEFAULT 'pending', -- pending, completed, failed
    confidence_score REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_notes_user ON voice_notes(user_id);
CREATE INDEX idx_notes_created ON voice_notes(created_at);
CREATE INDEX idx_notes_status ON voice_notes(processing_status);

-- Full-text search
CREATE VIRTUAL TABLE notes_fts USING fts5(
    note_id UNINDEXED,
    transcript,
    entities_text,
    content='voice_notes',
    content_rowid='rowid'
);

-- Voice Queries (conversation history)
CREATE TABLE voice_queries (
    query_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    question TEXT NOT NULL,
    cypher_query TEXT,
    graph_results JSON,
    answer TEXT NOT NULL,
    audio_r2_key TEXT,
    session_id TEXT, -- for conversation threading
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_queries_user ON voice_queries(user_id);
CREATE INDEX idx_queries_session ON voice_queries(session_id);
CREATE INDEX idx_queries_created ON voice_queries(created_at);

-- Sessions
CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_type TEXT, -- 'note_capture', 'voice_query', 'chat'
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- User Settings
CREATE TABLE user_settings (
    user_id TEXT PRIMARY KEY,
    audio_storage_enabled BOOLEAN DEFAULT FALSE,
    tts_voice_id TEXT DEFAULT 'aura-2', -- Options: 'aura-1', 'aura-2'
    theme TEXT DEFAULT 'light',
    language TEXT DEFAULT 'en',
    settings_json JSON,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

### 5.2 FalkorDB Schema (Graph)

```cypher
// Ontology Definition

// Entity Types
:Person {name, email, phone, first_mentioned, mention_count}
:Project {name, description, status, technology, started_date}
:Meeting {date, time, topic, attendees[], duration_minutes}
:Topic {name, category, description}
:Technology {name, version, category}
:Location {name, address, city, country}
:Organization {name, industry, website}
:Note {note_id, timestamp, transcript_snippet}
:Date {date, year, month, day}
:ActionItem {description, status, due_date, priority}

// Relationship Types
(:Person)-[:WORKED_WITH]->(:Person)
(:Person)-[:ATTENDED]->(:Meeting)
(:Person)-[:WORKS_ON]->(:Project)
(:Person)-[:KNOWS_ABOUT]->(:Topic)
(:Person)-[:WORKS_AT]->(:Organization)
(:Person)-[:LOCATED_AT]->(:Location)
(:Meeting)-[:DISCUSSED]->(:Topic)
(:Meeting)-[:ABOUT]->(:Project)
(:Meeting)-[:HAPPENED_ON]->(:Date)
(:Project)-[:USES_TECHNOLOGY]->(:Technology)
(:Project)-[:RELATED_TO]->(:Topic)
(:Note)-[:MENTIONS]->(:Person|:Project|:Topic|:Technology)
(:Note)-[:CREATED_ON]->(:Date)
(:ActionItem)-[:ASSIGNED_TO]->(:Person)
(:ActionItem)-[:RELATED_TO]->(:Project|:Meeting)

// Example Data
CREATE (sarah:Person {
    name: "Sarah Johnson",
    email: "sarah@example.com",
    first_mentioned: datetime(),
    mention_count: 5
})

CREATE (fastapi:Project {
    name: "FastAPI Migration",
    description: "Migrate REST API from Flask to FastAPI",
    status: "in_progress",
    technology: "Python",
    started_date: date("2025-10-15")
})

CREATE (meeting:Meeting {
    date: date("2025-11-10"),
    time: time("14:30"),
    topic: "API Architecture Discussion",
    attendees: ["Sarah Johnson", "User"],
    duration_minutes: 45
})

CREATE (python:Technology {
    name: "Python",
    version: "3.11",
    category: "Programming Language"
})

CREATE (note:Note {
    note_id: "note_abc123",
    timestamp: datetime(),
    transcript_snippet: "Met with Sarah about FastAPI migration..."
})

// Relationships
CREATE (meeting)-[:WITH]->(sarah)
CREATE (meeting)-[:ABOUT]->(fastapi)
CREATE (fastapi)-[:USES_TECHNOLOGY]->(python)
CREATE (note)-[:MENTIONS]->(sarah)
CREATE (note)-[:MENTIONS]->(fastapi)
CREATE (sarah)-[:WORKS_ON]->(fastapi)

// Indexes for Performance
CREATE INDEX FOR (p:Person) ON (p.name)
CREATE INDEX FOR (proj:Project) ON (proj.name)
CREATE INDEX FOR (m:Meeting) ON (m.date)
CREATE INDEX FOR (n:Note) ON (n.note_id)
```

### 5.3 KV Storage Schema

```typescript
// Query Cache
// Key: `query_cache:{query_hash}`
{
  query: "What did I discuss with Sarah?",
  cypher: "MATCH (m:Meeting)-[:WITH]->(p:Person {name: 'Sarah'})...",
  results: [...],
  cached_at: 1699622400,
  ttl: 3600 // 1 hour
}

// User Sessions
// Key: `session:{session_id}`
{
  user_id: "usr_123",
  session_type: "voice_query",
  created_at: 1699622400,
  expires_at: 1699708800,
  conversation_context: [...]
}

// Entity Resolution Cache
// Key: `entity_resolve:{entity_name_lowercase}`
{
  canonical_name: "Sarah Johnson",
  entity_id: "person_abc123",
  aliases: ["Sarah", "Sarah J.", "SJ"],
  confidence: 0.95
}

// Rate Limiting
// Key: `ratelimit:{user_id}:{endpoint}`
{
  count: 42,
  reset_at: 1699626000
}
```

### 5.4 R2 Storage Structure

```
/{user_id}/
  /audio/
    /notes/
      /{note_id}.opus
    /queries/
      /{query_id}.opus
  /uploads/
    /documents/
      /{file_id}.pdf
    /images/
      /{image_id}.png
  /exports/
    /graph_{timestamp}.json
    /notes_{timestamp}.csv
```

---

## 6. API Specifications

### 6.1 Authentication Endpoints

#### POST /api/auth/register
```typescript
Request: {
  email: string;
  password: string;
  name?: string;
}

Response: {
  success: boolean;
  user_id: string;
  message: "Verification email sent";
}
```

#### POST /api/auth/login
```typescript
Request: {
  email: string;
  password: string;
}

Response: {
  success: boolean;
  token: string; // JWT
  user: {
    user_id: string;
    email: string;
    name: string;
  };
}
```

---

### 6.2 Voice Note Endpoints

#### POST /api/notes/start-recording
```typescript
Request: {
  // Empty body, auth via Bearer token
}

Response: {
  session_id: string;
  websocket_url: string;
  expires_at: number;
}
```

#### WebSocket: /ws/notes/:session_id
```typescript
// Client -> Server
{
  type: "audio_chunk";
  data: string; // base64 Opus audio
  sequence: number;
}

// Server -> Client
{
  type: "transcript_partial";
  text: string;
  confidence: number;
}

{
  type: "entities_extracted";
  entities: Array<{
    type: string;
    name: string;
    confidence: number;
  }>;
  relationships: Array<{
    from: string;
    to: string;
    type: string;
  }>;
}

{
  type: "note_created";
  note_id: string;
  transcript: string;
}
```

#### GET /api/notes
```typescript
Response: {
  notes: Array<{
    note_id: string;
    transcript: string;
    entities: string[];
    created_at: string;
    audio_url?: string;
  }>;
  total: number;
  page: number;
}
```

---

### 6.3 Voice Query Endpoints

#### POST /api/query/start
```typescript
Request: {
  session_id?: string; // for follow-up questions
}

Response: {
  query_session_id: string;
  websocket_url: string;
  expires_at: number;
}
```

#### WebSocket: /ws/query/:session_id
```typescript
// Client -> Server
{
  type: "audio_chunk";
  data: string; // base64 audio
}

{
  type: "stop_recording";
}

// Server -> Client
{
  type: "question_transcribed";
  question: string;
}

{
  type: "cypher_generated";
  cypher: string;
  explanation: string;
}

{
  type: "results_retrieved";
  results: any[];
  result_count: number;
}

{
  type: "answer_generated";
  answer: string;
  sources: string[]; // note_ids
}

{
  type: "audio_response";
  audio_url: string; // or stream chunks
}
```

---

### 6.4 Knowledge Graph Endpoints

#### GET /api/graph
```typescript
Response: {
  nodes: Array<{
    id: string;
    type: string;
    properties: Record<string, any>;
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: string;
    properties: Record<string, any>;
  }>;
}
```

#### GET /api/graph/entity/:entity_id
```typescript
Response: {
  entity: {
    id: string;
    type: string;
    properties: Record<string, any>;
  };
  relationships: Array<{
    related_entity: any;
    relationship_type: string;
    direction: "incoming" | "outgoing";
  }>;
  mentioned_in_notes: string[]; // note_ids
}
```

#### POST /api/graph/entity
```typescript
Request: {
  type: string;
  properties: Record<string, any>;
}

Response: {
  entity_id: string;
  created: boolean;
}
```

#### DELETE /api/graph/entity/:entity_id
```typescript
Response: {
  deleted: boolean;
  relationships_removed: number;
}
```

---

### 6.5 Ingestion Endpoints

#### POST /api/ingest/url
```typescript
Request: {
  url: string;
}

Response: {
  job_id: string;
  status: "processing";
  estimated_time_seconds: number;
}
```

#### POST /api/ingest/file
```typescript
Request: multipart/form-data
  file: File;

Response: {
  job_id: string;
  status: "processing";
  file_id: string;
}
```

#### POST /api/ingest/text
```typescript
Request: {
  text: string;
  source?: string;
}

Response: {
  entities_extracted: number;
  relationships_created: number;
  processing_time_ms: number;
}
```

---

## 7. Implementation Phases

### Phase 1: Foundation (Weeks 1-3)
**Goal**: Basic infrastructure and voice capture

**Deliverables**:
- [x] Cloudflare Workers + Pages setup
- [x] D1 database schema
- [x] User registration & authentication
- [x] FalkorDB Cloud connection setup
- [x] Basic web UI (home page, record button)
- [x] Voice recording (WebRTC -> Durable Object)
- [x] Speech-to-text (Deepgram via Workers AI)
- [x] Text display (no entity extraction yet)

**Success Criteria**:
- User can register and log in
- User can record voice and see transcript
- Transcript stored in D1

---

### Phase 2: Entity Extraction & Knowledge Graph (Weeks 4-6)
**Goal**: Build knowledge graph from voice notes

**Deliverables**:
- [x] Entity extraction (Llama 3.1 via Workers AI)
- [x] FalkorDB GraphRAG SDK integration
- [x] Ontology definition (Person, Project, Meeting, etc.)
- [x] Knowledge graph updates (create/merge entities)
- [x] Graph visualization (basic)
- [x] Entity detail pages

**Success Criteria**:
- Entities extracted from voice notes
- Knowledge graph populated correctly
- User can view graph visualization
- Entities clickable with details

---

### Phase 3: Voice Query System (Weeks 7-9)
**Goal**: Query knowledge graph via voice

**Deliverables**:
- [x] Voice query input (WebRTC)
- [x] Cypher query generation (FalkorDB GraphRAG SDK)
- [x] Graph query execution
- [x] Answer generation (Llama 3.1)
- [x] Text-to-speech response (Deepgram Aura-1)
- [x] Conversation context (follow-up questions)

**Success Criteria**:
- User can ask questions via voice
- System generates accurate answers
- Answers spoken back via TTS
- Follow-up questions work

---

### Phase 4: Polish & Features (Weeks 10-12)
**Goal**: Production-ready with additional features

**Deliverables**:
- [x] Multi-source ingestion (URL, file, text)
- [x] Full-text search
- [x] Entity/relationship management
- [x] Graph visualization improvements
- [x] PWA support
- [x] Dark mode
- [x] Mobile optimization
- [x] Performance tuning
- [x] Error handling & UX polish

**Success Criteria**:
- All core features working smoothly
- Performance targets met
- Mobile-friendly
- User-tested and refined

---

### Phase 5: Advanced Features (Future)
**Goal**: Additional capabilities

**Possible Features**:
- Multi-user collaboration (shared graphs)
- Voice commands ("Create a reminder", "Add to calendar")
- Integration with external services (Google Calendar, Gmail, Slack)
- Advanced analytics (insights, patterns, trends)
- Export/import (Obsidian, Notion, Roam Research)
- Mobile apps (React Native)
- Multi-language support (i18n)
- Custom ontologies per user

---

## 8. Technical Risks & Mitigations

### 8.1 FalkorDB Integration Risk
**Risk**: FalkorDB is external dependency (not Cloudflare-native)
**Impact**: High
**Probability**: Medium

**Mitigations**:
- Use FalkorDB Cloud for managed service (99.95% SLA)
- Implement connection pooling in Durable Objects
- Cache frequent queries in KV
- Build abstraction layer (easy to swap graph DB)
- Consider Neo4j as backup option

---

### 8.2 Voice Latency Risk
**Risk**: Voice pipeline latency >3 seconds feels slow
**Impact**: High
**Probability**: Low

**Mitigations**:
- Use Cloudflare Realtime Agents (optimized for low latency)
- Stream partial transcripts (user sees progress)
- Parallel processing (STT + entity extraction)
- Aggressive caching (KV for entity resolution)
- Use Workers AI (edge computing = low latency)

**Expected Latency**:
- STT: 300ms (Deepgram Nova-3)
- Entity extraction: 2 seconds (Llama 3.1)
- Graph update: 100ms (FalkorDB)
- **Total: ~2.5 seconds** (under 3 second target)

---

### 8.3 Entity Extraction Accuracy Risk
**Risk**: <85% entity extraction accuracy hurts usability
**Impact**: Medium
**Probability**: Medium

**Mitigations**:
- Use state-of-the-art model (`@cf/meta/llama-3.1-8b-instruct`)
- Implement user confirmation for ambiguous entities
- Allow manual entity editing/merging
- Track accuracy metrics and iterate on prompts
- Consider fine-tuning on user data (future)

**FalkorDB Benchmarks**: 90%+ accuracy with GraphRAG SDK

---

### 8.4 Cost Overrun Risk
**Risk**: Cloudflare + FalkorDB costs >$50/month per user
**Impact**: Medium
**Probability**: Low

**Mitigations**:
- Aggressive caching to reduce API calls
- Batch processing (reduce per-call overhead)
- Free tiers cover development and light use
- Monitor usage and set alerts
- Start with FalkorDB Cloud starter tier ($15/mo), upgrade to pro only if needed
- Workers AI is currently free during beta (pricing TBA)

**Cost Model** (subject to change when Workers AI exits beta):
- Light use: $7-15/month
- Moderate use: $20-30/month
- Heavy use: $50/month (still cheaper than TwinMind subscription at $60/mo)

**Note**: Current cost estimates assume Workers AI remains reasonably priced after beta. If Workers AI becomes expensive, alternative LLM providers (Groq, Together AI) can be integrated via external APIs.

---

### 8.5 Privacy & Security Risk
**Risk**: User data exposure or breach
**Impact**: Critical
**Probability**: Low

**Mitigations**:
- User data isolated (separate FalkorDB namespaces)
- Audio encrypted in transit (WebRTC) and at rest (R2)
- JWT authentication with short expiration
- Rate limiting on all endpoints
- Regular security audits
- GDPR-compliant data deletion
- Open source (community security reviews)

---

## 9. Success Metrics

### 9.1 User Engagement
- **Daily Active Users (DAU)**: Target 50% of registered users
- **Notes per User per Week**: Target 10+
- **Queries per User per Week**: Target 5+
- **Session Duration**: Target 5+ minutes
- **Retention (7-day)**: Target 40%+
- **Retention (30-day)**: Target 20%+

### 9.2 Technical Performance
- **Voice transcription latency**: <2 seconds (p95)
- **Entity extraction accuracy**: >85%
- **Query answer accuracy**: >90% (user-rated)
- **System uptime**: >99.9%
- **Page load time**: <2 seconds (p95)
- **API response time**: <500ms (p95)

### 9.3 Business Metrics
- **Cost per User per Month**: ~$20 (production)
- **User Satisfaction (NPS)**: >40
- **Feature Usage**: 80%+ users use voice query
- **Data Quality**: 70%+ entities reviewed/confirmed by users
- **Export Usage**: 20%+ users export data

---

## 10. Comparison to Existing Solutions

| Feature | GraphMind (Ours) | TwinMind | Notion AI | Obsidian |
|---------|-------------------|----------|-----------|----------|
| **Voice Capture** | [x] Real-time | [x] Ambient | [ ] | [ ] |
| **Voice Query** | [x] Natural language | [x] | [ ] | [ ] |
| **Knowledge Graph** | [x] FalkorDB GraphRAG | [x] Proprietary | [ ] | [x] Graph view |
| **Open Source** | [x] 100% | [ ] | [ ] | [x] Core |
| **Self-Hostable** | [x] Yes | [ ] | [ ] | [x] |
| **Edge Computing** | [x] Cloudflare global | [ ] | [ ] | [ ] |
| **GraphRAG Accuracy** | [x] 90%+ |  Unknown | [ ] Simple RAG | [ ] |
| **Cost** | ~$20/mo | $60/mo | $10/mo | FREE-$50/mo |
| **Privacy** | [x] Your data | [ ] Their servers | [ ] Their servers | [x] Local |
| **Multi-Source** | [x] URL, file, text | [x] | [x] | [x] |
| **Mobile App** |  PWA (future) | [x] | [x] | [x] |
| **Collaboration** |  Future | [ ] | [x] | [ ] |

**Our Advantages**:
1. Open source + managed infrastructure
2. GraphRAG (90%+ accuracy vs traditional RAG)
3. Edge computing (low latency globally)
4. Voice-first (not an afterthought)
5. Privacy-first (isolated user data)
6. Developer-friendly (hackable, extensible)

---

## 11. Appendices

### Appendix A: FalkorDB GraphRAG Resources

**Official Repositories**:
- FalkorDB: https://github.com/FalkorDB/FalkorDB
- GraphRAG SDK: https://github.com/FalkorDB/GraphRAG-SDK (Current - v0.5+)
- GraphRAG SDK v2: https://github.com/FalkorDB/GraphRAG-SDK-v2 ( DEPRECATED - Use GraphRAG SDK instead)

**Documentation**:
- FalkorDB Docs: https://docs.falkordb.com/
- GraphRAG SDK Docs: https://docs.falkordb.com/graphrag-sdk.html
- Installation: `pip install graphrag_sdk`

**Tutorials**:
- LangChain Integration: https://www.falkordb.com/blog/graphrag-workflow-falkordb-langchain/
- Multi-Agent Systems: https://medium.com/@wasay.abbs/step-by-step-guide-to-develop-ai-multi-agent-system-using-falkordbs-graphrag-sdk-a1cb244162bb
- Lightning AI Studio: https://lightning.ai/muhammadqadora/studios/build-fast-accurate-genai-apps-advanced-rag-with-falkordb

**Key Features**:
- 90%+ accuracy (vs 56.2% traditional RAG)
- 5x faster query speed
- 40% infrastructure cost reduction
- Multi-agent architecture
- **Automatic ontology loading** (v0.5+) - No manual ontology setup needed
- Ontology auto-detection from existing knowledge graphs
- Supports: URLs, PDFs, JSONL, CSV, HTML, TEXT

---

### Appendix B: Cloudflare Voice AI Resources

**Official Resources**:
- Realtime Voice AI Blog: https://blog.cloudflare.com/cloudflare-realtime-voice-ai/
- Workers AI Docs: https://developers.cloudflare.com/workers-ai/
- Durable Objects Docs: https://developers.cloudflare.com/durable-objects/

**Workers AI Models**:
- Deepgram Nova-3 (STT): `@cf/deepgram/nova-3`
- Deepgram Aura-2 (TTS): `@cf/deepgram/aura-2`
- Llama 3.1-8b (Text generation): `@cf/meta/llama-3.1-8b-instruct`
- Optional: Pipecat turn detection model `@cf/pipecat/smart-turn-v2` (not currently implemented)

**Performance**:
- Total latency: 800ms (40ms input + 300ms STT + 400ms LLM + 150ms TTS)
- Free during beta
- Runs on Cloudflare's global edge network

---

### Appendix C: Example Use Cases

**1. Research Assistant**
- Capture thoughts while reading papers
- "What did that Nature paper say about CRISPR?"
- Automatic citation tracking
- Concept maps of research topics

**2. Meeting Notes**
- Record meeting highlights via voice
- "Who attended the Q4 planning meeting?"
- Automatic action item extraction
- People/project relationship tracking

**3. Learning Companion**
- Voice notes while studying
- "Explain the relationship between React hooks and state management"
- Concept graph of what you've learned
- Spaced repetition reminders

**4. Personal CRM**
- "Who did I meet in October?"
- "What's the status of the collaboration with Sarah?"
- Relationship strength visualization
- Remind me to follow up

**5. Idea Capture**
- Quick voice notes for ideas
- "Find all my ideas related to AI agents"
- Cross-pollination discovery
- Idea evolution tracking

**6. Code Documentation**
- Voice notes while coding
- "What was my approach to the caching layer?"
- Technology stack tracking
- Decision log (ADRs)

---

### Appendix D: Deployment Architecture

**Development Environment**:
```bash
# Local setup
wrangler dev                    # Cloudflare Workers local dev
docker run falkordb/falkordb    # FalkorDB local
npm run dev                     # Frontend dev server
```

**Production Environment**:
```bash
# Cloudflare
wrangler deploy                 # Deploy Workers + Durable Objects
wrangler pages deploy           # Deploy frontend
wrangler d1 migrations apply    # Run D1 migrations

# FalkorDB Cloud
# Set connection string in wrangler.toml:
# FALKORDB_URL = "your-falkordb-cloud-instance-url"
# FALKORDB_PASSWORD = "secret"
```

**CI/CD Pipeline** (GitHub Actions):
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    - npm run test
    - npm run build
    - wrangler deploy
    - wrangler pages deploy
    - wrangler d1 migrations apply
```

---

### Appendix E: Glossary

- **GraphRAG**: Graph Retrieval-Augmented Generation - using knowledge graphs to improve LLM accuracy
- **FalkorDB**: Graph database optimized for LLM knowledge graphs
- **Cypher**: Query language for graph databases
- **Ontology**: Schema definition for entities and relationships in knowledge graph
- **Entity Extraction**: NLP technique to identify people, places, things, concepts from text
- **Durable Objects**: Cloudflare's stateful serverless compute primitive
- **Workers AI**: Cloudflare's edge-hosted AI model inference platform
- **WebRTC**: Real-time communication protocol for audio/video in browsers
- **STT**: Speech-to-text (voice transcription)
- **TTS**: Text-to-speech (voice synthesis)
- **Pipecat**: Open-source Python framework for voice AI pipelines (not compatible with Cloudflare Workers; only the smart-turn-v2 model is available via Workers AI)
- **Second Brain**: Personal knowledge management system (Tiago Forte concept)

---

## 12. Sign-Off

### 12.1 Document Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | | | |
| Tech Lead | | | |
| Developer | | | |

---

### 12.2 Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-10 | Development Team | Initial draft |
| 1.1 | 2025-11-18 | Development Team | Updated architecture documentation to reflect actual implementation (custom Durable Object pipeline instead of Cloudflare Realtime Agents). See ADR-001 for rationale. |

---

**END OF DOCUMENT**

**Next Steps**:
1. Review and approve PRD
2. Set up development environment
3. Create GitHub repository
4. Start Phase 1 implementation
5. Build MVP in 3 weeks

**Questions? Feedback?** Open an issue or discussion!
