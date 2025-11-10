# Functional Requirements: Voice Query System

**Category:** Conversational AI & Graph Retrieval
**Priority:** Critical
**Status:** Approved
**Owner:** Development Team

---

## Overview

The Voice Query System enables users to ask questions about their knowledge graph using natural voice input. The system transcribes questions, generates appropriate graph queries, retrieves relevant information, generates natural language answers, and speaks them back using text-to-speech.

---

## Requirements Summary

### FR-VQ-001: Voice Question Input
- Record questions via WebRTC
- Real-time transcription (Deepgram Nova-3)
- Maximum 1-minute question length
- Support for follow-up questions with context
- Question validation and clarification

### FR-VQ-002: Cypher Query Generation
- Convert natural language to Cypher queries
- Handle temporal expressions ("last week", "this month")
- Support aggregations (count, list, summarize)
- Query validation before execution
- Fallback to keyword search if Cypher fails

### FR-VQ-003: GraphRAG Retrieval
- Execute queries on FalkorDB
- Multi-hop context retrieval (1-2 hop expansion)
- Result ranking by relevance
- Cache frequent queries in KV (1-hour TTL)
- Return top-K results (default: 10)

### FR-VQ-004: Natural Language Answer Generation
- Generate conversational answers (Llama 3.1)
- Include source citations (note IDs)
- Handle "I don't know" gracefully (no hallucinations)
- Support follow-up questions with conversation context
- Concise answers (2-3 sentences preferred)

### FR-VQ-005: Voice Response
- Text-to-speech (Deepgram Aura-1/Aura-2)
- Stream audio via WebRTC
- Synchronized text display
- Pause/resume/skip controls
- Option to skip to text-only mode

---

## Example Conversations

### Simple Query
```
User: "What did I discuss with Sarah last week?"

Processing:
1. Transcribe: "What did I discuss with Sarah last week?"
2. Generate Cypher:
   MATCH (m:Meeting)-[:WITH]->(p:Person {name: "Sarah"})
   WHERE m.date >= date() - duration('P7D')
   RETURN m.topic, m.date, m.notes
3. Execute query
4. Results: Meeting on Nov 3, topic "Python FastAPI Migration"
5. Generate answer: "Last week on November 3rd, you met with Sarah
   to discuss the Python FastAPI Migration project."
6. Speak answer via TTS
```

### Follow-up Question
```
User: "What else did we talk about?"

Processing:
1. Use conversation context: "we" = "you and Sarah"
2. Expand previous query to find more topics
3. Generate answer with additional information
```

### No Information Case
```
User: "What did I discuss with Bob?"

Processing:
1. Search for entity "Bob"
2. No match found
3. Generate answer: "I don't have any notes about Bob.
   Would you like to add a note about them?"
```

---

## Technical Specifications

### API Endpoint - Start Query
```typescript
POST /api/query/start

Request: {
  session_id?: string // for follow-ups
}

Response: {
  query_session_id: string,
  websocket_url: string,
  expires_at: number
}
```

### WebSocket Protocol
```typescript
// Client -> Server: Audio chunk
{
  type: "audio_chunk",
  data: string // base64
}

// Server -> Client: Question transcribed
{
  type: "question_transcribed",
  question: string
}

// Server -> Client: Cypher generated
{
  type: "cypher_generated",
  cypher: string,
  explanation: string
}

// Server -> Client: Results retrieved
{
  type: "results_retrieved",
  results: any[],
  result_count: number
}

// Server -> Client: Answer generated
{
  type: "answer_generated",
  answer: string,
  sources: string[] // note_ids
}

// Server -> Client: Audio response
{
  type: "audio_response",
  audio_chunk: string // base64 stream
}
```

### Query Generation Prompt
```
You are an expert at converting natural language questions into Cypher queries.

Ontology:
- Entities: Person, Project, Meeting, Topic, Technology, Location, Organization
- Relationships: WORKED_WITH, DISCUSSED, USES_TECHNOLOGY, ATTENDED, LOCATED_AT

Previous conversation context:
{context}

User question: {question}

Generate a valid Cypher query to answer this question.
Only use entities and relationships from the ontology.
Handle temporal expressions correctly (last week = P7D).

Return ONLY the Cypher query, no explanation:
```

### Answer Generation Prompt
```
You are a helpful personal knowledge assistant.

Context from knowledge graph:
{graph_results}

Previous conversation:
{conversation_context}

User question: {question}

Instructions:
- Answer based ONLY on the provided context
- If no relevant information exists, say "I don't have any notes about that"
- Be concise (2-3 sentences max)
- Include specific dates/names/details when available
- Cite which notes the information came from
- Use conversational, natural language

Answer:
```

---

## Database Schema (D1)

```sql
-- Voice queries
CREATE TABLE voice_queries (
    query_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT,
    question TEXT NOT NULL,
    cypher_query TEXT,
    graph_results JSON,
    answer TEXT NOT NULL,
    audio_r2_key TEXT,
    sources JSON,
    latency_ms INTEGER,
    user_rating INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Query sessions (conversation context)
CREATE TABLE query_sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    context JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

---

## KV Caching

```typescript
// Query cache
// Key: `query_cache:{query_hash}`
{
  query: "What did I discuss with Sarah?",
  cypher: "MATCH (m:Meeting)-[:WITH]->...",
  results: [...],
  answer: "Last week on November 3rd...",
  cached_at: timestamp,
  ttl: 3600 // 1 hour
}

// Conversation context
// Key: `conversation:{session_id}`
{
  session_id: string,
  exchanges: [
    { question: string, answer: string, timestamp: number },
    ...
  ],
  ttl: 3600
}
```

---

## Performance Requirements

- Total latency (question -> answer): <5 seconds (p95)
- STT latency: <2 seconds
- Query generation: <1 second
- Graph query execution: <500ms (uncached), <100ms (cached)
- Answer generation: <2 seconds
- TTS start: <1 second

---

## Acceptance Criteria

- [ ] Voice questions transcribed accurately (>90%)
- [ ] Cypher queries generated correctly (>90% accuracy)
- [ ] Temporal queries handled properly
- [ ] Answers are accurate and cited
- [ ] No hallucinations
- [ ] TTS voices sound natural
- [ ] Follow-up questions work with context
- [ ] Performance targets met
- [ ] Works on all major browsers

---

## Related Documents

- [Phase 3: Voice Query](../../phases/phase-3-voice-query.md)
- [Voice Note Capture](./voice-note-capture.md)
- [API Specifications](../../technical/api-specifications.md)

---

**Last Updated:** 2025-11-10
**Implementation Phase:** Phase 3
