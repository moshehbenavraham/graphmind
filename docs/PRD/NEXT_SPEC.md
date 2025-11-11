# Next Spec: Voice Note Capture & Transcription System

**ARCHIVED**: This specification has been completed and implemented as Feature 004.

**Completion Date**: 2025-11-11
**Status**: ✅ READY FOR DEPLOYMENT
**Implementation Location**: [specs/004-voice-note-capture](../../specs/004-voice-note-capture)
**Validation Report**: [validation.md](../../specs/004-voice-note-capture/validation.md)

---

## Completion Summary

All 126 implementation tasks completed (100%). See Feature 004 specifications for details:
- Specification: [spec.md](../../specs/004-voice-note-capture/spec.md)
- Design: [design.md](../../specs/004-voice-note-capture/design.md)
- Tasks: [tasks.md](../../specs/004-voice-note-capture/tasks.md)
- Validation: [validation.md](../../specs/004-voice-note-capture/validation.md)

---

## Original Spec (Archived Content Below)

# Voice Note Capture & Transcription System

**Phase**: Phase 2 - Knowledge Graph & Entity Extraction
**Priority**: P1 (COMPLETED)
**Estimated Context**: ~25,000 tokens
**Dependencies**: Phase 1 complete (Auth, FalkorDB connection, D1 database)
**Status**: IMPLEMENTED (Feature 004)

---

## What We're Building

A complete voice note capture system that allows authenticated users to record voice notes through WebRTC, transcribe them in real-time using Deepgram Nova-3 via Workers AI, and store the transcripts in D1. This is the first step of Phase 2, establishing the foundation for entity extraction and knowledge graph building.

## Why This Next

**Phase 1 is 100% complete**:
- Wrangler configuration and project setup (Feature 001)
- Authentication system with JWT and bcrypt (Feature 002)
- FalkorDB connection pooling and graph infrastructure (Feature 003)

**This enables the core GraphMind workflow**:
1. User records voice notes → Transcription (THIS SPEC)
2. Transcript → Entity extraction (next spec)
3. Entities → Knowledge graph (following spec)
4. Graph → Voice queries (Phase 3)

**Phase requirement**: Voice capture is the essential first component of Phase 2, as it generates the raw transcripts that will feed the entity extraction pipeline.

---

## Scope (Single Context Window)

**Included**:
- Durable Object for voice session management (`VoiceSessionManager`)
- WebRTC audio capture frontend component
- WebSocket connection for real-time audio streaming
- Deepgram Nova-3 integration via Workers AI for STT
- Real-time transcript display and accumulation
- Voice note storage in D1 database
- Voice notes list API endpoint
- Basic voice recording UI (record button, status, transcript)

**Explicitly Excluded** (for later specs):
- Entity extraction from transcripts (Feature 005)
- Knowledge graph updates (Feature 006)
- Graph visualization (Feature 007)
- Audio file storage in R2 (deferred to Phase 4)
- Advanced voice UI features (waveform, playback controls)
- Voice query system (Phase 3)

**Estimated Tokens**: ~25,000 tokens

---

## User Stories (for this spec)

### Story 1: Record Voice Note (P1)
As a user, I want to click a record button and speak naturally so that my thoughts are captured and transcribed automatically.

**Acceptance Criteria**:
- [ ] User can click "Start Recording" button
- [ ] Microphone permission is requested and handled gracefully
- [ ] Recording starts within 500ms of button click
- [ ] Audio is captured at 16kHz sample rate (optimal for Deepgram)
- [ ] Recording status is visible to user (recording indicator, timer)
- [ ] User can stop recording at any time
- [ ] Audio chunks are streamed in real-time to backend

### Story 2: Real-Time Transcription (P1)
As a user, I want to see my words appear as text while I'm speaking so that I know the system is working and can verify accuracy.

**Acceptance Criteria**:
- [ ] Transcript appears with <2 second latency (p95)
- [ ] Transcript updates incrementally as user speaks
- [ ] Transcript accuracy >90% for clear speech
- [ ] Partial results are displayed (streaming transcription)
- [ ] Final transcript is polished and punctuated
- [ ] Errors are handled gracefully (display to user)

### Story 3: Save and View Notes (P1)
As a user, I want my voice notes saved automatically so that I can review them later and build my knowledge base over time.

**Acceptance Criteria**:
- [ ] Transcript is saved to D1 immediately after recording
- [ ] Each note has a unique ID and timestamp
- [ ] User can view a list of their previous notes
- [ ] Notes are displayed in reverse chronological order
- [ ] User can click a note to see full transcript
- [ ] Notes are isolated by user (no data leakage)

---

## Technical Approach

### Architecture Overview

```
User (Browser)
    ↓ WebRTC Audio
WebSocket Connection
    ↓ Audio Chunks
VoiceSessionManager (Durable Object)
    ↓ Buffer & Process
Workers AI (Deepgram Nova-3)
    ↓ Transcript Chunks
WebSocket (back to user)
    ↓ Display + Save
D1 Database (voice_notes table)
```

### Cloudflare Components

**Workers**:
- `POST /api/notes/start-recording` - Create session, return WebSocket URL
- `GET /api/notes` - List user's voice notes
- `GET /api/notes/:note_id` - Get specific note details
- `DELETE /api/notes/:note_id` - Delete note (soft delete)

**Durable Objects**:
- `VoiceSessionManager` - Manages WebSocket connections for voice capture
  - Handles audio chunk buffering
  - Calls Workers AI for transcription
  - Streams transcript back to client
  - Saves final transcript to D1

**D1 Tables**:
- `voice_notes` table (already defined in Phase 1 schema):
  ```sql
  CREATE TABLE voice_notes (
      note_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      transcript TEXT NOT NULL,
      processing_status TEXT DEFAULT 'pending',
      duration_seconds INTEGER,
      word_count INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_deleted BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
  );
  ```

**KV**:
- Session state caching (active recordings)
- Temporary transcript buffering

**Workers AI**:
- Model: `@cf/deepgram/nova-3` (speech-to-text)
- Audio format: PCM 16kHz mono
- Streaming: Yes (real-time transcription)

### FalkorDB (if applicable)
Not used in this spec. FalkorDB integration comes in Feature 005 (Entity Extraction).

### Voice AI Pipeline

1. **Audio Capture (Frontend)**:
   - Use `MediaRecorder` API or WebRTC `getUserMedia()`
   - Capture at 16kHz, mono, PCM format
   - Chunk size: 1-2 seconds of audio
   - Send chunks via WebSocket

2. **Audio Streaming (Durable Object)**:
   - Receive audio chunks via WebSocket
   - Buffer chunks (handle out-of-order delivery)
   - Pass to Workers AI for transcription
   - Stream results back to client

3. **Transcription (Workers AI)**:
   - Use Deepgram Nova-3: `AI.run('@cf/deepgram/nova-3', { audio: chunk })`
   - Get partial results (streaming)
   - Accumulate full transcript
   - Handle punctuation and capitalization

4. **Storage (D1)**:
   - Save completed transcript with metadata
   - Calculate duration and word count
   - Associate with user_id
   - Set processing_status to 'completed'

---

## Implementation Steps

1. **Create VoiceSessionManager Durable Object**:
   - Set up WebSocket handler
   - Implement audio chunk buffering logic
   - Add session state management
   - Integrate with Workers AI (Deepgram Nova-3)
   - Add transcript streaming back to client
   - Implement D1 save logic

2. **Build API Endpoints**:
   - `POST /api/notes/start-recording` - Create session
   - `GET /api/notes` - List notes with pagination
   - `GET /api/notes/:note_id` - Get note details
   - `DELETE /api/notes/:note_id` - Soft delete
   - Add JWT authentication middleware
   - Add rate limiting (10 recordings/hour per user)

3. **Frontend Voice Capture Component**:
   - Build record button UI component
   - Implement microphone permission handling
   - Set up WebRTC audio capture
   - Create WebSocket connection to Durable Object
   - Display recording status (timer, indicator)
   - Show real-time transcript as it arrives
   - Handle stop recording and save

4. **Frontend Notes List**:
   - Build notes list view component
   - Fetch notes from API
   - Display in reverse chronological order
   - Add search/filter (optional, nice-to-have)
   - Add delete confirmation modal
   - Handle empty state

5. **Testing & Validation**:
   - Unit tests for Durable Object logic
   - Integration tests for full recording flow
   - Test with various audio inputs (clear, noisy, accents)
   - Load testing (concurrent recordings)
   - Error handling tests (network drops, mic disconnect)

---

## Success Criteria

**Functional Requirements**:
- [ ] User can successfully record and transcribe voice notes
- [ ] Transcription latency is <2 seconds (p95)
- [ ] Transcript accuracy is >90% for clear speech
- [ ] All voice notes are saved to D1 correctly
- [ ] User can view list of previous notes
- [ ] User can delete notes (soft delete)
- [ ] No data leakage between users

**Performance Requirements**:
- [ ] Recording starts within 500ms
- [ ] WebSocket connection established within 1 second
- [ ] Real-time transcript updates (streaming)
- [ ] Notes list loads within 1 second for <1000 notes

**Quality Requirements**:
- [ ] Graceful error handling (mic permissions, network errors)
- [ ] Mobile responsive UI
- [ ] Audio chunk buffering handles network jitter
- [ ] Rate limiting prevents abuse
- [ ] Comprehensive logging for debugging

---

## Next After This

Once this spec is complete, the next logical steps will be:

1. **Feature 005: Entity Extraction Pipeline**
   - Use Llama 3.1-8b-instruct to extract entities from transcripts
   - Entity types: Person, Project, Meeting, Topic, Technology
   - Confidence scoring and validation
   - Entity resolution caching

2. **Feature 006: Knowledge Graph Building**
   - Integrate FalkorDB GraphRAG SDK
   - Create/update entities in knowledge graph
   - Entity merge logic (fuzzy matching)
   - Relationship creation between entities

3. **Feature 007: Graph Visualization**
   - Interactive graph visualization component
   - Entity detail pages
   - Node color coding by type

---

## API Specifications

### POST /api/notes/start-recording

**Request**:
```json
{
  "audio_config": {
    "sample_rate": 16000,
    "channels": 1,
    "format": "pcm"
  }
}
```

**Response**:
```json
{
  "session_id": "sess_abc123",
  "websocket_url": "wss://graphmind.workers.dev/ws/notes/sess_abc123",
  "expires_at": "2025-11-11T10:00:00Z"
}
```

### GET /api/notes

**Query Parameters**:
- `limit` (default: 20, max: 100)
- `offset` (default: 0)
- `order_by` (default: created_at desc)

**Response**:
```json
{
  "notes": [
    {
      "note_id": "note_xyz789",
      "transcript": "Today I discussed...",
      "duration_seconds": 120,
      "word_count": 250,
      "created_at": "2025-11-11T09:30:00Z"
    }
  ],
  "total": 45,
  "limit": 20,
  "offset": 0
}
```

### WebSocket Protocol (/ws/notes/:session_id)

**Client → Server**:
```json
{
  "type": "audio_chunk",
  "chunk": "<base64-encoded-audio>",
  "sequence": 123
}
```

**Server → Client**:
```json
{
  "type": "transcript_partial",
  "text": "Today I discussed the project",
  "is_final": false
}
```

```json
{
  "type": "transcript_complete",
  "note_id": "note_xyz789",
  "transcript": "Full transcript here...",
  "duration_seconds": 120,
  "word_count": 250
}
```

---

## Database Migrations

No new migrations required. The `voice_notes` table was already created in Phase 1 (Feature 001).

**Verify schema**:
```bash
npx wrangler d1 execute graphmind-db --command "SELECT sql FROM sqlite_master WHERE type='table' AND name='voice_notes';"
```

---

## References

- **PRD Phase**: [docs/PRD/phases/phase-2-knowledge-graph.md](phases/phase-2-knowledge-graph.md)
- **Phase 1 Foundation**: [docs/PRD/phases/phase-1-foundation.md](phases/phase-1-foundation.md)
- **Related Specs**:
  - [specs/001-wrangler-setup](../../specs/001-wrangler-setup)
  - [specs/002-auth-system](../../specs/002-auth-system)
  - [specs/003-falkordb-connection](../../specs/003-falkordb-connection)
- **Technical Docs**:
  - [docs/PRD/technical/database-schemas.md](technical/database-schemas.md)
  - [docs/PRD/technical/api-specifications.md](technical/api-specifications.md)

**External Resources**:
- Deepgram Nova-3: https://developers.cloudflare.com/workers-ai/models/deepgram-nova-3/
- Durable Objects: https://developers.cloudflare.com/durable-objects/
- WebRTC API: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API
- MediaRecorder API: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
