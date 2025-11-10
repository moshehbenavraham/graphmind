# Functional Requirements: Voice Note Capture

**Category:** Voice Recording & Entity Extraction
**Priority:** Critical
**Status:** Approved
**Owner:** Development Team

---

## Overview

This document specifies the core voice note capture functionality of GraphMind, including audio recording, real-time transcription, entity extraction, and knowledge graph updates. This is the primary input mechanism for capturing knowledge.

---

## Requirements

### FR-NC-001: Voice Recording

**Priority:** Critical
**Status:** Required for MVP

#### Description
Users can record voice notes by speaking naturally into their device microphone.

#### Requirements
- Click "Record" button to start recording
- WebRTC audio capture (Opus codec preferred)
- Real-time waveform visualization during recording
- Maximum 5-minute recording length
- "Stop" and "Cancel" options
- Automatic silence detection (stop after 3 seconds of silence)
- Live transcription display during recording
- Audio quality indication (mic level meter)
- Browser microphone permission handling

#### User Flow
```
1. User clicks "Record" button
2. Browser requests microphone permission (if not granted)
3. User grants permission
4. Recording starts, waveform displays
5. User speaks naturally
6. Live transcript appears in real-time
7. User clicks "Stop" or silence detected
8. Recording ends
9. Full transcript displayed
10. Entity extraction begins automatically
```

#### Acceptance Criteria
- [ ] Recording starts within 500ms of clicking Record
- [ ] Waveform displays in real-time (60fps)
- [ ] Transcription appears with <2 second latency
- [ ] Audio quality indicator shows mic levels
- [ ] Recording stops automatically after 3 seconds of silence
- [ ] User can stop recording manually at any time
- [ ] User can cancel recording (audio discarded)
- [ ] Works on Chrome, Safari, Firefox (desktop & mobile)
- [ ] Clear error messages for permission denied
- [ ] 5-minute limit enforced (warning at 4:30)

#### Technical Specifications

**WebRTC Configuration:**
```javascript
const constraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 1 // mono
  }
};

const stream = await navigator.mediaDevices.getUserMedia(constraints);
```

**Audio Format:**
- Codec: Opus (primary) or WebM
- Sample rate: 48kHz
- Bit rate: 32 kbps (voice optimized)
- Channels: 1 (mono)

**API Endpoint:**
```typescript
POST /api/notes/start-recording

Headers: {
  Authorization: "Bearer {token}"
}

Response: {
  session_id: string,
  websocket_url: string,
  expires_at: number
}
```

**WebSocket Protocol:**
```typescript
// Client -> Server (audio chunks)
{
  type: "audio_chunk",
  data: string, // base64 Opus audio
  sequence: number,
  timestamp: number
}

// Server -> Client (live transcript)
{
  type: "transcript_partial",
  text: string,
  confidence: number,
  is_final: boolean
}

// Client -> Server (stop recording)
{
  type: "stop_recording"
}

// Client -> Server (cancel recording)
{
  type: "cancel_recording"
}
```

#### UI Components
- **Record Button**: Large, circular, red when recording
- **Waveform Visualizer**: Real-time audio levels
- **Timer**: Shows recording duration (MM:SS)
- **Transcript Panel**: Live updating text
- **Stop/Cancel Buttons**: Clear actions
- **Status Indicator**: "Listening...", "Processing...", "Complete"

#### Reference Implementations
- Cloudflare Realtime Agents: https://blog.cloudflare.com/cloudflare-realtime-voice-ai/
- Pipecat Quickstart: https://github.com/pipecat-ai/pipecat-quickstart
- Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API

---

### FR-NC-002: Entity Extraction

**Priority:** Critical
**Status:** Required for MVP (Phase 2)

#### Description
Automatically extract entities and relationships from voice notes using AI.

#### Requirements
- Extract entity types:
  - **Person**: Names, roles, contact info
  - **Project**: Names, descriptions, status
  - **Meeting**: Dates, topics, attendees
  - **Topic**: Themes, subjects, concepts
  - **Technology**: Tools, frameworks, languages
  - **Location**: Places, addresses
  - **Organization**: Companies, institutions
  - **Date**: Temporal references
- Extract relationships between entities:
  - WORKED_WITH (Person-Person)
  - DISCUSSED (Meeting-Topic)
  - USES_TECHNOLOGY (Project-Technology)
  - ATTENDED (Person-Meeting)
  - LOCATED_AT (Entity-Location)
- Use `@cf/meta/llama-3.1-8b-instruct` via Workers AI
- Handle ambiguity (e.g., "John" -> resolve to existing "John Smith")
- Confidence scores for entities (>0.8 threshold)
- User confirmation for ambiguous entities (<0.8 confidence)

#### Entity Schema Examples
```cypher
// Person
CREATE (p:Person {
  name: "Sarah Johnson",
  email: "sarah@example.com",
  first_mentioned: datetime("2025-11-10T10:30:00Z"),
  mention_count: 5
})

// Project
CREATE (proj:Project {
  name: "Python FastAPI Migration",
  description: "Migrate REST API from Flask to FastAPI",
  technology: "Python",
  framework: "FastAPI",
  status: "in_progress",
  started_date: date("2025-10-15")
})

// Meeting
CREATE (m:Meeting {
  date: date("2025-11-10"),
  time: time("14:30"),
  topic: "API architecture discussion",
  attendees: ["Sarah Johnson", "Current User"],
  duration_minutes: 45
})

// Relationships
CREATE (m)-[:WITH]->(p)
CREATE (m)-[:ABOUT]->(proj)
CREATE (proj)-[:USES_TECHNOLOGY]->(:Technology {name: "Python"})
```

#### Acceptance Criteria
- [ ] Entities extracted within 3 seconds of recording stop
- [ ] >85% accuracy for common entity types
- [ ] Relationships correctly identified
- [ ] Ambiguous entities flagged for user confirmation
- [ ] Knowledge graph updated atomically (all-or-nothing)
- [ ] Handles complex sentences with multiple entities
- [ ] Extracts temporal information correctly

#### Technical Specifications

**Extraction Prompt:**
```typescript
const ENTITY_EXTRACTION_PROMPT = `
Extract entities and relationships from the following voice note transcript.

Transcript: "{transcript}"

Extract the following entity types:
1. Person (name, role, email, phone)
2. Project (name, description, status, technology)
3. Meeting (date, time, topic, attendees, duration)
4. Topic (name, category, description)
5. Technology (name, version, category)
6. Location (name, address, city, country)
7. Organization (name, industry, website)
8. Date (date, context)

For each entity, provide:
- type: entity type
- name: canonical name
- properties: relevant properties
- confidence: 0.0-1.0 (how confident you are)

Also extract relationships between entities:
- from: source entity name
- to: target entity name
- type: relationship type (WORKED_WITH, DISCUSSED, USES_TECHNOLOGY, etc.)
- confidence: 0.0-1.0

Return ONLY valid JSON (no markdown, no explanation):
{
  "entities": [
    {
      "type": "Person",
      "name": "Sarah Johnson",
      "properties": {
        "role": "Project Manager"
      },
      "confidence": 0.95
    }
  ],
  "relationships": [
    {
      "from": "Meeting about FastAPI",
      "to": "Sarah Johnson",
      "type": "WITH",
      "confidence": 0.98
    }
  ]
}
`;
```

**API Endpoint:**
```typescript
POST /api/notes/:note_id/extract-entities

Headers: {
  Authorization: "Bearer {token}"
}

Response: {
  entities: Array<{
    type: string,
    name: string,
    properties: Record<string, any>,
    confidence: number
  }>,
  relationships: Array<{
    from: string,
    to: string,
    type: string,
    confidence: number
  }>,
  ambiguous_entities: Array<{
    extracted_name: string,
    possible_matches: Array<{
      existing_name: string,
      similarity_score: number
    }>
  }>,
  processing_time_ms: number
}
```

**WebSocket Events:**
```typescript
// Server -> Client (after recording stops)
{
  type: "entities_extracted",
  entities: Entity[],
  relationships: Relationship[],
  requires_confirmation: boolean,
  ambiguous_entities: AmbiguousEntity[]
}

// Client -> Server (user confirmation)
{
  type: "confirm_entities",
  confirmed: string[], // entity names
  merged: Array<{
    extracted: string,
    merge_with: string
  }>,
  rejected: string[]
}
```

#### Entity Resolution
```typescript
// Fuzzy matching for entity deduplication
import { compareTwoStrings } from 'string-similarity';

function resolveEntity(extractedName: string, existingEntities: Entity[]): {
  match: Entity | null,
  confidence: number
} {
  const matches = existingEntities.map(entity => ({
    entity,
    score: compareTwoStrings(
      extractedName.toLowerCase(),
      entity.name.toLowerCase()
    )
  }));

  const bestMatch = matches.sort((a, b) => b.score - a.score)[0];

  if (bestMatch.score > 0.85) {
    return { match: bestMatch.entity, confidence: bestMatch.score };
  }

  return { match: null, confidence: 0 };
}
```

#### Reference Implementations
- FalkorDB GraphRAG SDK: https://github.com/FalkorDB/GraphRAG-SDK
- LiteLLM for multi-model support
- String similarity algorithms for entity resolution

---

### FR-NC-003: Knowledge Graph Update

**Priority:** Critical
**Status:** Required for MVP (Phase 2)

#### Description
Update the knowledge graph with extracted entities and relationships while maintaining consistency and preventing duplicates.

#### Requirements
- Create new entities if they don't exist
- Merge with existing entities (fuzzy matching, user confirmation)
- Create relationships between entities
- Update entity properties (e.g., mention_count++, last_mentioned timestamp)
- Handle conflicts (user chooses if ambiguous)
- Transactional updates (all-or-nothing)
- Maintain temporal ordering (first_seen, last_seen timestamps)
- Link entities to source note (bidirectional reference)

#### Acceptance Criteria
- [ ] Entities merged correctly (no duplicates)
- [ ] Relationships created accurately
- [ ] Graph remains consistent (ACID properties)
- [ ] Query performance <100ms for simple lookups
- [ ] Supports 10,000+ entities per user
- [ ] Transaction rollback on error
- [ ] Proper error messages for conflicts

#### Technical Specifications

**Graph Operations (FalkorDB GraphRAG SDK):**
```python
from graphrag_sdk import KnowledgeGraph, Ontology

# Initialize knowledge graph
kg = KnowledgeGraph(
    name=f"user_{user_id}",
    ontology=auto_ontology,
    model="@cf/meta/llama-3.1-8b-instruct"
)

# Process text and extract entities
result = kg.process_text(
    text=transcript,
    metadata={
        "note_id": note_id,
        "source": "voice_note",
        "created_at": timestamp
    }
)

# Entities and relationships automatically created
# in FalkorDB with ontology-based structure
```

**Manual Entity Creation (if needed):**
```cypher
// Create entity with merge logic
MERGE (p:Person {name: $name})
ON CREATE SET
  p.first_mentioned = datetime(),
  p.mention_count = 1,
  p.created_from_note = $note_id
ON MATCH SET
  p.last_mentioned = datetime(),
  p.mention_count = p.mention_count + 1
SET p.email = $email
RETURN p
```

**Create Relationship:**
```cypher
// Create relationship between entities
MATCH (m:Meeting {note_id: $note_id})
MATCH (p:Person {name: $person_name})
MERGE (m)-[r:WITH]->(p)
ON CREATE SET
  r.created_at = datetime(),
  r.source_note = $note_id
RETURN r
```

**Link to Source Note:**
```cypher
// Link entities to the note they were extracted from
MATCH (n:Note {note_id: $note_id})
MATCH (e) WHERE e.name IN $entity_names
MERGE (n)-[:MENTIONS]->(e)
```

#### Transaction Safety
```typescript
// Pseudo-code for transactional update
async function updateKnowledgeGraph(
  entities: Entity[],
  relationships: Relationship[],
  noteId: string
): Promise<void> {
  const transaction = kg.beginTransaction();

  try {
    // Create/merge entities
    for (const entity of entities) {
      await transaction.createEntity(entity);
    }

    // Create relationships
    for (const rel of relationships) {
      await transaction.createRelationship(rel);
    }

    // Link to source note
    await transaction.linkToNote(noteId, entities);

    // Commit transaction
    await transaction.commit();
  } catch (error) {
    // Rollback on error
    await transaction.rollback();
    throw error;
  }
}
```

---

### FR-NC-004: Note Persistence

**Priority:** High
**Status:** Required for MVP

#### Description
Store voice notes with metadata, transcript, and optional audio in durable storage.

#### Requirements
- Store in D1:
  - note_id, user_id, timestamp, transcript
  - entities_json (extracted entities)
  - relationships_json (extracted relationships)
  - processing_status (pending/completed/failed)
  - confidence_score (overall extraction confidence)
- Store audio in R2 (optional, user preference):
  - Key: `{user_id}/audio/{note_id}.opus`
  - Retention: 90 days (configurable)
- Link to knowledge graph nodes (note_id stored as property)
- Full-text search indexing (D1 FTS5)

#### D1 Schema
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

-- Full-text search
CREATE VIRTUAL TABLE notes_fts USING fts5(
    note_id UNINDEXED,
    transcript,
    entities_text,
    content='voice_notes',
    content_rowid='rowid'
);
```

#### Acceptance Criteria
- [ ] Notes saved to D1 within 1 second
- [ ] Audio uploaded to R2 in background (non-blocking)
- [ ] Processing status accurate and updated in real-time
- [ ] Full-text search on transcripts works
- [ ] Notes retrievable by user_id, date range, status
- [ ] Supports pagination (20 notes per page)

#### API Endpoints
```typescript
GET /api/notes

Headers: {
  Authorization: "Bearer {token}"
}

Query params: {
  page?: number,
  limit?: number,
  from_date?: string,
  to_date?: string,
  status?: string
}

Response: {
  notes: Array<{
    note_id: string,
    transcript: string,
    entities: string[],
    created_at: string,
    audio_url?: string,
    confidence_score: number
  }>,
  total: number,
  page: number,
  pages: number
}
```

```typescript
GET /api/notes/:note_id

Headers: {
  Authorization: "Bearer {token}"
}

Response: {
  note_id: string,
  transcript: string,
  entities_extracted: Entity[],
  relationships_created: Relationship[],
  audio_url?: string,
  audio_duration_seconds: number,
  confidence_score: number,
  created_at: string,
  processing_status: string
}
```

```typescript
DELETE /api/notes/:note_id

Headers: {
  Authorization: "Bearer {token}"
}

Response: {
  success: boolean,
  message: "Note deleted",
  entities_updated: number // entities with updated mention_count
}
```

---

## Non-Functional Requirements

### Performance
- Recording start latency: <500ms
- Live transcription latency: <2 seconds
- Entity extraction: <3 seconds
- Note persistence: <1 second
- Audio upload (background): <10 seconds for 5-minute audio

### Reliability
- No audio data loss during recording
- Transactional graph updates (ACID)
- Retry logic for failed extractions (3 attempts)
- Graceful degradation (save transcript even if extraction fails)

### Accuracy
- Transcription accuracy: >90% (clear speech, English)
- Entity extraction accuracy: >85%
- Entity resolution accuracy: >90% (fuzzy matching)

### Usability
- Clear visual feedback at each step
- Error messages actionable (not technical jargon)
- Works on mobile (touch-friendly)
- Accessible (keyboard navigation, screen readers)

---

## Dependencies

- **Cloudflare Workers**: API and orchestration
- **Cloudflare Durable Objects**: WebSocket session management
- **Workers AI**: Deepgram Nova-3 (STT), Llama 3.1-8b (entity extraction)
- **Cloudflare D1**: Note storage
- **Cloudflare R2**: Audio storage (optional)
- **Cloudflare KV**: Entity resolution cache
- **FalkorDB**: Knowledge graph storage

---

## Related Documents

- [Phase 1: Foundation](../../phases/phase-1-foundation.md)
- [Phase 2: Knowledge Graph](../../phases/phase-2-knowledge-graph.md)
- [Database Schemas](../../technical/database-schemas.md)
- [API Specifications](../../technical/api-specifications.md)

---

**Last Updated:** 2025-11-10
**Review Status:** Approved
**Implementation Phase:** Phase 1-2
