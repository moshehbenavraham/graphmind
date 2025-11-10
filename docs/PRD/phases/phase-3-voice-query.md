# Phase 3: Voice Query System (Weeks 7-9)

## ✅ Implementation Status

**Phase Progress**: 0% complete
**Status**: 🔲 Not Started
**Last Updated**: 2025-11-10

### Completed Items

None yet.

### In Progress

None yet.

### Remaining

- 🔲 Voice Query Input System
- 🔲 GraphRAG Integration
- 🔲 Cypher Query Generation
- 🔲 Answer Generation with LLM
- 🔲 Text-to-Speech Output
- 🔲 Conversation Context Management

---

**Timeline:** Weeks 7-9
**Status:** Not Started
**Goal:** Query knowledge graph via voice

---

## Overview

This phase brings GraphMind to life as a true conversational AI assistant. Users can ask questions about their knowledge using natural voice input, and the system will intelligently query the knowledge graph, generate contextual answers, and speak them back using text-to-speech.

---

## Deliverables

### Voice Query Input
- [x] Voice query recording interface
- [x] WebRTC audio streaming
- [x] Real-time transcription (Deepgram Nova-3)
- [x] Question intent detection
- [x] Conversation context management

### Query Processing
- [x] Natural language to Cypher query generation
- [x] Graph query execution
- [x] Result ranking and relevance scoring
- [x] Context retrieval (multi-hop graph traversal)

### Answer Generation
- [x] Natural language answer generation (Llama 3.1)
- [x] Source citation (which notes/entities)
- [x] "I don't know" handling (no hallucinations)
- [x] Follow-up question support

### Voice Response
- [x] Text-to-speech (Deepgram Aura-1/Aura-2)
- [x] Audio streaming via WebRTC
- [x] Text display synchronized with audio
- [x] Pause/resume/skip controls

---

## Success Criteria

1. **Voice Input**
   - Question transcribed within 2 seconds
   - Supports complex multi-entity queries
   - Handles conversational follow-ups
   - Clear error messages for unclear questions

2. **Query Generation**
   - 90%+ accuracy for common query patterns
   - Handles temporal queries (last week, this month)
   - Supports aggregations (count, list, summarize)
   - Validates queries before execution

3. **Answer Quality**
   - >90% user satisfaction with answers
   - No hallucinations (only uses graph data)
   - Includes specific details (dates, names)
   - Cites source notes

4. **Response Time**
   - Total query-to-answer latency <5 seconds
   - Voice response starts playing <1 second after answer generation
   - Cached queries return <2 seconds

5. **Conversation Context**
   - Follow-up questions reference previous exchanges
   - Maintains context for 3+ exchanges
   - "What else?" and "Tell me more" work correctly

---

## Technical Requirements

### Voice Query Flow

```
User speaks question
    |
WebRTC capture -> Deepgram STT
    |
Natural language question -> FalkorDB GraphRAG SDK
    |
Cypher query generation
    |
Execute query on FalkorDB
    |
Retrieve graph results + context
    |
Llama 3.1 answer generation
    |
Deepgram TTS -> Audio response
    |
Stream to user via WebRTC
```

### Query Generation Examples

```cypher
-- Question: "What did I discuss with Sarah last week?"
MATCH (m:Meeting)-[:WITH]->(p:Person {name: "Sarah"})
WHERE m.date >= date() - duration('P7D')
RETURN m.topic, m.date, m.notes
ORDER BY m.date DESC

-- Question: "Show me all Python projects"
MATCH (proj:Project)-[:USES_TECHNOLOGY]->(t:Technology {name: "Python"})
RETURN proj.name, proj.status, proj.description

-- Question: "Who have I met this month?"
MATCH (m:Meeting)-[:WITH]->(p:Person)
WHERE m.date >= date({year: date().year, month: date().month, day: 1})
RETURN DISTINCT p.name, count(m) as meeting_count
ORDER BY meeting_count DESC
```

### Answer Generation Prompt

```typescript
const ANSWER_PROMPT = `
You are a helpful personal knowledge assistant. Answer questions based on the user's knowledge graph.

Context from knowledge graph:
{graph_results}

Previous conversation:
{conversation_context}

User question: {user_question}

Instructions:
- Answer based ONLY on the provided context
- If no relevant information exists, say "I don't have any notes about that"
- Be concise but informative (2-3 sentences max)
- Include specific dates/names/details when available
- Cite which notes the information came from
- Use conversational, natural language
- For follow-up questions, reference previous context

Answer:
`;
```

---

## Development Tasks

### Week 7: Voice Query Input & Processing
- [ ] Create voice query UI component (Ask button)
- [ ] Implement WebRTC capture for queries
- [ ] Add real-time transcription display
- [ ] Create query session management (Durable Object)
- [ ] Implement conversation context tracking
- [ ] Add question intent detection
- [ ] Build query history view
- [ ] Add "stop listening" functionality

### Week 8: Cypher Generation & GraphRAG
- [ ] Integrate FalkorDB GraphRAG query generation
- [ ] Design prompt for NL -> Cypher conversion
- [ ] Implement temporal query handling (last week, this month)
- [ ] Add aggregation support (count, list, etc.)
- [ ] Create query validation logic
- [ ] Implement multi-hop context retrieval
- [ ] Add query result ranking
- [ ] Cache frequent queries in KV
- [ ] Build query debugging UI (optional)

### Week 9: Answer Generation & TTS
- [ ] Design answer generation prompt
- [ ] Implement answer generation with Llama 3.1
- [ ] Add source citation logic
- [ ] Implement "I don't know" detection
- [ ] Integrate Deepgram Aura TTS
- [ ] Build audio streaming response
- [ ] Synchronize text and audio display
- [ ] Add playback controls (pause/resume/skip)
- [ ] Test with various question types
- [ ] Performance optimization

---

## Database Updates (D1)

```sql
-- Voice queries table
CREATE TABLE voice_queries (
    query_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT,
    question TEXT NOT NULL,
    cypher_query TEXT,
    graph_results JSON,
    answer TEXT NOT NULL,
    audio_r2_key TEXT,
    sources JSON, -- note_ids and entities referenced
    latency_ms INTEGER,
    user_rating INTEGER, -- 1-5 stars for answer quality
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_queries_user ON voice_queries(user_id);
CREATE INDEX idx_queries_session ON voice_queries(session_id);
CREATE INDEX idx_queries_created ON voice_queries(created_at);

-- Query sessions (conversation context)
CREATE TABLE query_sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    context JSON, -- conversation history
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

---

## API Endpoints

### POST /api/query/start
Start a new query session.

```typescript
Request: {
  session_id?: string // for follow-up questions
}

Response: {
  query_session_id: string,
  websocket_url: string,
  expires_at: number
}
```

### WebSocket: /ws/query/:session_id

```typescript
// Client -> Server
{
  type: "audio_chunk",
  data: string // base64 audio
}

{
  type: "stop_recording"
}

// Server -> Client
{
  type: "question_transcribed",
  question: string
}

{
  type: "cypher_generated",
  cypher: string,
  explanation: string
}

{
  type: "results_retrieved",
  results: any[],
  result_count: number
}

{
  type: "answer_generated",
  answer: string,
  sources: string[] // note_ids
}

{
  type: "audio_response",
  audio_chunk: string // base64 audio stream
}
```

### GET /api/query/history
Get user's query history.

```typescript
Response: {
  queries: Array<{
    query_id: string,
    question: string,
    answer: string,
    created_at: string,
    user_rating?: number
  }>,
  total: number,
  page: number
}
```

### POST /api/query/:query_id/rate
Rate the quality of an answer.

```typescript
Request: {
  rating: number // 1-5
}

Response: {
  success: boolean
}
```

---

## KV Caching Strategy

```typescript
// Query cache
// Key: `query_cache:{query_hash}`
{
  query: "What did I discuss with Sarah?",
  cypher: "MATCH (m:Meeting)-[:WITH]->...",
  results: [...],
  answer: "Last week on November 3rd...",
  cached_at: 1699622400,
  ttl: 3600 // 1 hour
}

// Conversation context
// Key: `conversation:{session_id}`
{
  session_id: "sess_123",
  user_id: "usr_456",
  exchanges: [
    {
      question: "What did I discuss with Sarah?",
      answer: "Last week...",
      timestamp: 1699622400
    },
    {
      question: "What else did we talk about?",
      answer: "You also discussed...",
      timestamp: 1699622460
    }
  ],
  ttl: 3600 // 1 hour
}
```

---

## Testing Strategy

### Functional Testing
- Test common question patterns
  - "What did I discuss with X?"
  - "Show me all Y"
  - "When did I last Z?"
  - "Who have I met this month?"
- Test temporal queries
- Test aggregations
- Test follow-up questions
- Test "I don't know" cases

### Accuracy Testing
Create test dataset of 100 questions with expected answers:
- Measure answer accuracy
- Target: >90% user satisfaction
- Test with various graph sizes (10, 100, 1000+ entities)

### Performance Testing
- End-to-end latency (<5 seconds)
- STT latency (<2 seconds)
- Query generation (<1 second)
- Graph query execution (<500ms)
- Answer generation (<2 seconds)
- TTS start latency (<1 second)

### Conversation Context Testing
- Test 3+ exchange conversations
- Test context retention
- Test ambiguous pronoun resolution ("What else?", "Tell me more")

---

## Example Conversations

### Example 1: Simple Query
```
User: "What did I discuss with Sarah last week?"

System:
- Transcribes question
- Generates Cypher: MATCH (m:Meeting)-[:WITH]->(p:Person {name: "Sarah"})...
- Retrieves: Meeting on Nov 3, topic: "Python FastAPI Migration"
- Generates answer: "Last week on November 3rd, you met with Sarah to discuss the Python FastAPI Migration project."
- Speaks answer via TTS
```

### Example 2: Follow-up Question
```
User: "What did I discuss with Sarah?"
System: "You discussed the Python FastAPI Migration project on November 3rd."

User: "What else did we talk about?"
System: [Uses conversation context to know "we" = "you and Sarah"]
        "You also discussed API architecture and the migration timeline."
```

### Example 3: No Information
```
User: "What did I discuss with Bob?"
System: [Searches graph, finds no entity named "Bob"]
        "I don't have any notes about Bob. Would you like to add a note about them?"
```

---

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Query generation <90% accuracy | High | Medium | Iterative prompt engineering, fallback to keyword search |
| Total latency >5 seconds | High | Medium | Parallel processing, caching, optimize each step |
| TTS voice quality poor | Medium | Low | Use Aura-2 (newer), test voice options |
| Context tracking fails | Medium | Low | Robust session management, test edge cases |
| Graph queries timeout | High | Low | Query optimization, indexes, timeout handling |

---

## Deliverable Checklist

- [ ] Voice query input works smoothly
- [ ] Questions transcribed accurately
- [ ] Cypher queries generated correctly (>90% accuracy)
- [ ] Graph queries execute successfully
- [ ] Answers are accurate and cited
- [ ] No hallucinations
- [ ] TTS responses sound natural
- [ ] Follow-up questions work
- [ ] Conversation context maintained
- [ ] Performance targets met (<5s total)
- [ ] All success criteria met

---

## Next Phase

After Phase 3 completion, proceed to **Phase 4: Polish & Features** where we'll add multi-source ingestion, full-text search, and production-ready polish.

---

## Resources

- FalkorDB GraphRAG SDK: https://github.com/FalkorDB/GraphRAG-SDK
- Deepgram Aura TTS: https://developers.deepgram.com/docs/tts-models
- Workers AI Llama: https://developers.cloudflare.com/workers-ai/
- Pipecat Voice AI: https://docs.pipecat.ai/

---

**Phase Owner:** Development Team
**Last Updated:** 2025-11-10
**Status:** Ready for Implementation
