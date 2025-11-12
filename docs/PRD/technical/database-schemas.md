# Database Schemas

**Document Type:** Technical Specification
**Status:** Approved
**Owner:** Development Team

---

## Overview

GraphMind uses multiple data stores optimized for different purposes:
- **D1 (SQLite)**: User metadata, notes, sessions
- **FalkorDB (Graph)**: Knowledge graph entities and relationships
  - See [FalkorDB Deployment Options](falkordb-deployment.md) for configuration details
  - **Development**: Self-hosted Docker (localhost, Redis protocol)
  - **Production**: Self-hosted VPS or FalkorDB Cloud (TBD)
- **KV**: Caching and session data
- **R2**: Audio file storage

---

## 1. D1 Database Schema (SQLite)

### 1.1 Users Table

```sql
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    falkordb_namespace TEXT NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token TEXT,
    verification_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_verified ON users(email_verified);
```

**Description:** Stores user account information and authentication data.

**Key Fields:**
- `user_id`: Unique identifier (format: `usr_<uuid>`)
- `password_hash`: bcrypt hashed password (cost factor 12)
- `falkordb_namespace`: Isolated graph namespace per user
- `verification_token`: Email verification token (32 bytes)

---

### 1.2 Voice Notes Table

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
    audio_duration_seconds INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_notes_user ON voice_notes(user_id);
CREATE INDEX idx_notes_created ON voice_notes(created_at);
CREATE INDEX idx_notes_status ON voice_notes(processing_status);
```

**Description:** Stores voice note transcripts and metadata.

**Key Fields:**
- `note_id`: Unique identifier (format: `note_<uuid>`)
- `entities_extracted`: JSON array of extracted entities
- `relationships_created`: JSON array of created relationships
- `processing_status`: `pending`, `completed`, `failed`
- `confidence_score`: Overall extraction confidence (0.0-1.0)

**Example JSON:**
```json
{
  "entities_extracted": [
    {
      "type": "Person",
      "name": "Sarah Johnson",
      "properties": {"role": "Project Manager"},
      "confidence": 0.95
    }
  ],
  "relationships_created": [
    {
      "from": "Meeting",
      "to": "Sarah Johnson",
      "type": "WITH",
      "confidence": 0.98
    }
  ]
}
```

---

### 1.3 Full-Text Search

```sql
CREATE VIRTUAL TABLE notes_fts USING fts5(
    note_id UNINDEXED,
    transcript,
    entities_text,
    content='voice_notes',
    content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER notes_fts_insert AFTER INSERT ON voice_notes BEGIN
    INSERT INTO notes_fts(note_id, transcript, entities_text)
    VALUES (new.note_id, new.transcript, json_extract(new.entities_extracted, '$'));
END;

CREATE TRIGGER notes_fts_update AFTER UPDATE ON voice_notes BEGIN
    UPDATE notes_fts SET
        transcript = new.transcript,
        entities_text = json_extract(new.entities_extracted, '$')
    WHERE note_id = new.note_id;
END;

CREATE TRIGGER notes_fts_delete AFTER DELETE ON voice_notes BEGIN
    DELETE FROM notes_fts WHERE note_id = old.note_id;
END;
```

**Description:** Full-text search index for notes and entities.

**Usage Example:**
```sql
SELECT vn.*, rank
FROM notes_fts nft
JOIN voice_notes vn ON nft.note_id = vn.note_id
WHERE notes_fts MATCH 'python OR fastapi'
ORDER BY rank
LIMIT 20;
```

---

### 1.4 Voice Queries Table

```sql
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

CREATE INDEX idx_queries_user ON voice_queries(user_id);
CREATE INDEX idx_queries_session ON voice_queries(session_id);
CREATE INDEX idx_queries_created ON voice_queries(created_at);
```

**Description:** Stores voice query history and results.

**Key Fields:**
- `query_id`: Unique identifier (format: `query_<uuid>`)
- `cypher_query`: Generated Cypher query
- `graph_results`: Query results from FalkorDB
- `sources`: JSON array of note_ids referenced
- `user_rating`: Optional 1-5 star rating

---

### 1.5 Query Sessions Table

```sql
CREATE TABLE query_sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    context JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_sessions_user ON query_sessions(user_id);
CREATE INDEX idx_sessions_active ON query_sessions(last_active_at);
```

**Description:** Tracks conversation sessions for follow-up questions.

**Context JSON Example:**
```json
{
  "exchanges": [
    {
      "question": "What did I discuss with Sarah?",
      "answer": "You discussed the FastAPI project...",
      "entities_mentioned": ["Sarah Johnson", "FastAPI Project"],
      "timestamp": 1699622400
    }
  ]
}
```

---

### 1.6 User Settings Table

```sql
CREATE TABLE user_settings (
    user_id TEXT PRIMARY KEY,
    audio_storage_enabled BOOLEAN DEFAULT FALSE,
    tts_voice_id TEXT DEFAULT 'aura-2',
    theme TEXT DEFAULT 'light',
    language TEXT DEFAULT 'en',
    settings_json JSON,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

**Description:** User preferences and settings.

**Key Fields:**
- `audio_storage_enabled`: Save audio files to R2
- `tts_voice_id`: `aura-1` or `aura-2`
- `theme`: `light` or `dark`
- `settings_json`: Additional settings

---

### 1.7 Entity Cache Table

```sql
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

CREATE INDEX idx_entity_type ON entity_cache(entity_type);
CREATE INDEX idx_entity_name ON entity_cache(canonical_name);
```

**Description:** Cache for entity resolution (fuzzy matching optimization).

**Example:**
```sql
INSERT INTO entity_cache VALUES (
    'sarah_johnson',
    'Sarah Johnson',
    'Person',
    'person_abc123',
    '["Sarah", "Sarah J.", "SJ"]',
    0.95,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
```

---

## 2. FalkorDB Schema (Graph)

### 2.1 Ontology Definition

**Entity Types:**
```cypher
:Person {
    name: STRING,
    email: STRING,
    phone: STRING,
    first_mentioned: DATETIME,
    last_mentioned: DATETIME,
    mention_count: INTEGER
}

:Project {
    name: STRING,
    description: STRING,
    status: STRING, // "planning", "in_progress", "completed", "archived"
    technology: STRING,
    started_date: DATE
}

:Meeting {
    date: DATE,
    time: TIME,
    topic: STRING,
    attendees: LIST<STRING>,
    duration_minutes: INTEGER
}

:Topic {
    name: STRING,
    category: STRING,
    description: STRING
}

:Technology {
    name: STRING,
    version: STRING,
    category: STRING // "language", "framework", "tool", etc.
}

:Location {
    name: STRING,
    address: STRING,
    city: STRING,
    country: STRING
}

:Organization {
    name: STRING,
    industry: STRING,
    website: STRING
}

:Note {
    note_id: STRING,
    timestamp: DATETIME,
    transcript_snippet: STRING // First 200 chars
}

:Date {
    date: DATE,
    year: INTEGER,
    month: INTEGER,
    day: INTEGER
}

:ActionItem {
    description: STRING,
    status: STRING, // "pending", "in_progress", "completed"
    due_date: DATE,
    priority: STRING // "low", "medium", "high"
}
```

---

### 2.2 Relationship Types

```cypher
(:Person)-[:WORKED_WITH {since: DATE, last_interaction: DATE}]->(:Person)
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
(:Project)-[:OWNED_BY]->(:Person)

(:Note)-[:MENTIONS]->(:Person|:Project|:Topic|:Technology)
(:Note)-[:CREATED_ON]->(:Date)

(:ActionItem)-[:ASSIGNED_TO]->(:Person)
(:ActionItem)-[:RELATED_TO]->(:Project|:Meeting)
```

---

### 2.3 Example Data

```cypher
// Create entities
CREATE (sarah:Person {
    name: "Sarah Johnson",
    email: "sarah@example.com",
    first_mentioned: datetime("2025-11-10T10:30:00Z"),
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
    attendees: ["Sarah Johnson", "Current User"],
    duration_minutes: 45
})

CREATE (python:Technology {
    name: "Python",
    version: "3.11",
    category: "language"
})

CREATE (note:Note {
    note_id: "note_abc123",
    timestamp: datetime(),
    transcript_snippet: "Met with Sarah about FastAPI migration..."
})

// Create relationships
CREATE (meeting)-[:WITH]->(sarah)
CREATE (meeting)-[:ABOUT]->(fastapi)
CREATE (fastapi)-[:USES_TECHNOLOGY]->(python)
CREATE (note)-[:MENTIONS]->(sarah)
CREATE (note)-[:MENTIONS]->(fastapi)
CREATE (sarah)-[:WORKS_ON]->(fastapi)
```

---

### 2.4 Indexes

```cypher
// Performance optimization
CREATE INDEX FOR (p:Person) ON (p.name)
CREATE INDEX FOR (proj:Project) ON (proj.name)
CREATE INDEX FOR (m:Meeting) ON (m.date)
CREATE INDEX FOR (n:Note) ON (n.note_id)
CREATE INDEX FOR (t:Topic) ON (t.name)
CREATE INDEX FOR (tech:Technology) ON (tech.name)
```

---

## 3. KV Storage Schema

### 3.1 Query Cache

```typescript
// Key: `query_cache:{hash(query)}`
interface QueryCache {
  query: string;
  cypher: string;
  results: any[];
  answer: string;
  cached_at: number;
  ttl: number; // 3600 seconds (1 hour)
}

// Example
{
  "query": "What did I discuss with Sarah?",
  "cypher": "MATCH (m:Meeting)-[:WITH]->(p:Person {name: 'Sarah'})...",
  "results": [{...}],
  "answer": "Last week on November 3rd...",
  "cached_at": 1699622400,
  "ttl": 3600
}
```

---

### 3.2 Session Data

```typescript
// Key: `session:{token_hash}`
interface Session {
  user_id: string;
  created_at: number;
  expires_at: number;
  ip_address: string;
  user_agent: string;
}
```

---

### 3.3 Conversation Context

```typescript
// Key: `conversation:{session_id}`
interface ConversationContext {
  session_id: string;
  user_id: string;
  exchanges: Array<{
    question: string;
    answer: string;
    entities_mentioned: string[];
    timestamp: number;
  }>;
  ttl: number; // 3600 seconds
}
```

---

### 3.4 Entity Resolution Cache

```typescript
// Key: `entity_resolve:{entity_name_lowercase}`
interface EntityResolution {
  canonical_name: string;
  entity_id: string;
  entity_type: string;
  aliases: string[];
  confidence: number;
}
```

---

### 3.5 Rate Limiting

```typescript
// Key: `ratelimit:{user_id}:{endpoint}`
interface RateLimit {
  count: number;
  reset_at: number; // Unix timestamp
}
```

---

## 4. R2 Storage Structure

```
/{user_id}/
  /audio/
    /notes/
      /{note_id}.opus          # Voice note audio
    /queries/
      /{query_id}.opus         # Voice query audio
  /uploads/
    /documents/
      /{file_id}.pdf           # Uploaded documents
      /{file_id}.docx
      /{file_id}.txt
    /images/
      /{image_id}.png
      /{image_id}.jpg
  /exports/
    /graph_{timestamp}.json    # Graph exports
    /notes_{timestamp}.csv     # Note exports
```

**File Metadata:**
- Content-Type headers set appropriately
- Encryption at rest (R2 default)
- TTL for temporary files (e.g., 90 days for audio if user setting enabled)

---

## 5. Migration Strategy

### 5.1 D1 Migrations

```sql
-- migrations/0001_initial_schema.sql
-- Run with: wrangler d1 migrations apply

-- migrations/0002_add_entity_cache.sql
-- Incremental schema changes

-- migrations/0003_add_user_settings.sql
```

**Migration Process:**
1. Test migration on local D1
2. Apply to staging environment
3. Verify data integrity
4. Apply to production
5. Monitor for issues

---

### 5.2 FalkorDB Schema Evolution

**Approach:** Graph databases are schema-flexible
- Add new node types dynamically
- Add new relationship types as needed
- Update indexes for performance
- No downtime for schema changes

---

## Related Documents

- [API Specifications](./api-specifications.md)
- [REQUIREMENTS-PRD.md](../REQUIREMENTS-PRD.md) - See Appendix D for deployment architecture

---

**Last Updated:** 2025-11-10
**Review Status:** Approved
**Schema Version:** 1.0
