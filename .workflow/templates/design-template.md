# Technical Design: [FEATURE NAME]

**Created**: [DATE]
**Status**: Draft
**Spec Reference**: [Link to spec.md]

---

## Architecture Overview

[High-level text-based diagram showing component interactions]

```
User (Browser/WebRTC)
    ↓
Cloudflare Realtime Agent (if voice)
    ↓
Workers (API Endpoints)
    ↓
Durable Objects (Session/Connection Management)
    ↓
Data Layer:
├── D1 (User data, sessions, transcripts)
├── FalkorDB (Knowledge graph)
├── KV (Cache, sessions)
└── R2 (Audio files, optional)
    ↓
Workers AI (Deepgram STT/TTS, Llama 3.1)
```

---

## Cloudflare Stack Decisions

### Workers (API Endpoints)

**Endpoints Required**:

#### `POST /api/[endpoint-name]`
- **Purpose**: [What this endpoint does]
- **Auth**: Required/Optional (JWT)
- **Rate Limit**: [X requests/minute]
- **Request**: `{ "field": "type" }`
- **Response**: `{ "field": "type" }`

#### `GET /api/[endpoint-name]`
- **Purpose**: [What this endpoint does]
- **Auth**: Required/Optional
- **Cache**: KV cache (TTL: X seconds)
- **Response**: `{ "field": "type" }`

**Additional endpoints**: [List any other endpoints]

---

### Durable Objects

#### [DurableObjectClass] (if needed)
- **Purpose**: [WebSocket session management / connection pooling / state coordination]
- **State Managed**: [What state this DO maintains]
- **Lifecycle**: [When created/destroyed]
- **Concurrency**: [How many instances expected]

**Example**: `VoiceSessionManager` for WebSocket connections

---

### D1 (SQLite)

**Tables Used**:

#### `[table_name]`
```sql
CREATE TABLE [table_name] (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  [field_name] TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_[table]_user_id ON [table_name](user_id);
```

**Queries for This Feature**:
1. [Query description] - `SELECT ... FROM ... WHERE ...`
2. [Query description] - `INSERT INTO ... VALUES ...`

**Migrations Required**: Yes/No
- If yes: [Description of what needs to be migrated]

---

### KV (Key-Value Store)

**Namespaces**: [GRAPHMIND_CACHE, GRAPHMIND_SESSIONS, etc.]

**Keys Used**:
- `entity:[entity_id]` - Entity cache (TTL: 1 hour)
- `query:[query_hash]` - Query result cache (TTL: 1 hour)
- `session:[session_id]` - Session data (TTL: 24 hours)

**Cache Strategy**:
- [When to cache]
- [When to invalidate]
- [Fallback behavior]

---

### R2 (Object Storage)

**Buckets**: [graphmind-audio-dev, graphmind-audio-prod]

**File Organization**:
```
{user_id}/
  audio/
    notes/
      {note_id}.mp3
    queries/
      {query_id}.mp3
```

**Access Pattern**: [How files are uploaded/retrieved]
**Encryption**: [Yes/No and method]

---

## FalkorDB Schema

### Node Types

#### :[NodeLabel]
```cypher
CREATE (:NodeLabel {
  id: 'unique-id',
  name: 'string',
  user_id: 'string',  // For user data isolation
  created_at: timestamp(),
  [additional_properties]
})
```

**Properties**:
- `id`: [Description]
- `name`: [Description]
- `user_id`: [Required for user isolation]

**Indexes**:
```cypher
CREATE INDEX FOR (n:NodeLabel) ON (n.user_id);
CREATE INDEX FOR (n:NodeLabel) ON (n.name);
```

### Relationships

#### -[:RELATIONSHIP_TYPE]->
```cypher
CREATE (a:NodeA)-[:RELATIONSHIP_TYPE {
  weight: float,
  created_at: timestamp()
}]->(b:NodeB)
```

**Properties**: [Description of relationship properties]

### Key Cypher Queries

#### Query 1: [Query Purpose]
```cypher
MATCH (n:NodeLabel {user_id: $userId})
WHERE n.name CONTAINS $searchTerm
RETURN n
LIMIT 10
```

#### Query 2: [Query Purpose]
```cypher
MATCH (start:NodeA {id: $startId})-[:REL*1..3]->(related)
WHERE start.user_id = $userId
RETURN related
```

#### Query 3: Entity Extraction
```cypher
MERGE (e:Entity {name: $entityName, user_id: $userId})
ON CREATE SET e.created_at = timestamp()
ON MATCH SET e.updated_at = timestamp()
RETURN e
```

### GraphRAG SDK Integration

**Version**: graphrag_sdk v0.5+
**Ontology**: Auto-detection (no manual setup)
**Context Window**: [How much context to include in queries]
**Caching**: Entity resolution in KV, query results in KV

---

## Voice AI Pipeline

### Speech-to-Text

**Model**: `@cf/deepgram/nova-3`
**Configuration**:
- Streaming: Yes/No
- Language: en-US
- Model tier: Nova-3 (highest accuracy)

**Latency Target**: <2 seconds (p95)
**Error Handling**: [How to handle poor audio quality]

---

### Text-to-Speech

**Model**: `@cf/deepgram/aura-1` or `aura-2`
**Configuration**:
- Voice: [Voice ID]
- Streaming: Yes
- Speed: 1.0

**Latency Target**: <1 second to start playback
**Error Handling**: [Fallback approach]

---

### Entity Extraction

**Model**: `@cf/meta/llama-3.1-8b-instruct`
**Prompt**:
```
Extract entities and relationships from this transcript:
[transcript]

Return JSON format:
{
  "entities": [{"name": "...", "type": "..."}],
  "relationships": [{"from": "...", "to": "...", "type": "..."}]
}
```

**Batch Processing**: [When to batch vs real-time]
**Accuracy Target**: [Expected extraction quality]

---

### Turn Detection

**Pipecat Configuration**:
- Model: `smart-turn-v2`
- Silence threshold: [X ms]
- Interruption handling: [Approach]

---

### WebRTC Flow

1. User opens app → Request session
2. Worker creates Durable Object (VoiceSessionManager)
3. WebSocket connection established
4. Audio streaming begins (WebRTC)
5. STT processes chunks → Transcript
6. Entity extraction on transcript
7. [Additional processing]
8. TTS generates response
9. Audio streams back to user

**Connection Resilience**:
- Reconnection strategy: [Automatic retry with exponential backoff]
- Buffer size: [X seconds of audio]
- Network error handling: [Graceful degradation]

---

## API Contracts

[Either inline specifications or references to files in contracts/ directory]

See `contracts/[endpoint-name].md` for detailed specifications.

---

## Data Flow

### Primary User Action: [Action Name]

1. **User Input**: [User does X]
2. **Frontend**: [Frontend sends Y to Z endpoint]
3. **Worker**: [Worker validates and processes]
4. **Durable Object** (if needed): [DO manages state]
5. **D1**: [Store/retrieve data]
6. **FalkorDB**: [Query/update graph]
7. **KV**: [Cache results]
8. **Response**: [Return data to user]

**Error Handling**:
- Step 2 fails: [Fallback behavior]
- Step 5 fails: [Fallback behavior]
- Step 6 fails: [Fallback behavior]

---

## Performance Targets

[From success criteria in spec.md]

- **Voice transcription**: <2s (p95)
- **Entity extraction**: <3s
- **Graph query**: <500ms uncached, <100ms cached
- **Answer generation**: <2s
- **TTS playback**: <1s to start
- **Page load**: <2s

**Optimization Strategy**:
- KV caching for frequently accessed data
- Connection pooling in Durable Objects
- Batch processing where applicable
- Edge caching for static assets

---

## Security Considerations

- **Authentication**: JWT validation on all protected endpoints
- **User Isolation**:
  - D1: Filter by `user_id`
  - FalkorDB: Separate namespaces or `user_id` property filtering
- **Input Validation**:
  - Sanitize all user inputs
  - Validate audio file sizes/formats
- **Rate Limiting**: [X requests/minute per user]
- **Secrets Management**: Environment variables in Wrangler, never hardcoded
- **Audio Encryption** (if R2): [Encryption method]

---

## Implementation Notes

### Dependencies
- [Other features this requires]
- [External services]

### Migration Path
- [D1 migrations needed]
- [FalkorDB schema updates]

### Deployment Considerations
- [Environment-specific configs]
- [Rollout strategy]

### Testing Approach
- Unit tests: [What to test]
- Integration tests: [What to test]
- Voice quality testing: [How to validate]
- Performance testing: [How to measure]

---

## Open Questions

[Any unresolved technical decisions]

1. [Question 1]
2. [Question 2]
