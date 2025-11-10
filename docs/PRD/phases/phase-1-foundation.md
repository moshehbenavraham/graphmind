# Phase 1: Foundation (Weeks 1-3)

**Timeline:** Weeks 1-3
**Status:** Planning
**Goal:** Basic infrastructure and voice capture

---

## Overview

This phase establishes the foundational infrastructure for GraphMind, including basic authentication, database setup, and core voice recording functionality. By the end of this phase, users should be able to register, log in, and record voice notes with transcription.

---

## Deliverables

### Infrastructure Setup
- [x] Cloudflare Workers + Pages setup
- [x] D1 database schema implementation
- [x] FalkorDB Cloud connection setup
- [x] Basic project structure and configuration

### Authentication
- [x] User registration system
- [x] User authentication (JWT-based)
- [x] Session management

### Voice Capture
- [x] Basic web UI (home page, record button)
- [x] Voice recording (WebRTC -> Durable Object)
- [x] Speech-to-text (Deepgram via Workers AI)
- [x] Text display (no entity extraction yet)

---

## Success Criteria

1. **User Registration & Login**
   - User can register with email and password
   - User receives verification email within 5 seconds
   - User can log in and receive JWT token
   - Session persists across page refreshes

2. **Voice Recording**
   - User can click record button and capture audio
   - Recording starts within 500ms
   - WebRTC connection established successfully
   - Audio streams to Durable Object

3. **Speech-to-Text**
   - Voice is transcribed using Deepgram Nova-3
   - Transcript appears with <2 second latency
   - Transcript accuracy >90% for clear speech
   - Transcript displayed in real-time

4. **Data Persistence**
   - Transcript stored in D1 database
   - User can view their previous transcripts
   - No data loss during recording

---

## Technical Requirements

### Infrastructure
- **Cloudflare Workers**: API endpoints and orchestration
- **Cloudflare Pages**: Static frontend hosting
- **Durable Objects**: Voice session management
- **D1 Database**: User data and transcript storage
- **Workers AI**: Deepgram Nova-3 for STT

### Database Schema (D1)
```sql
-- Users table
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    falkordb_namespace TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Voice notes table (basic)
CREATE TABLE voice_notes (
    note_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    transcript TEXT NOT NULL,
    processing_status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

### API Endpoints
```
POST /api/auth/register
POST /api/auth/login
POST /api/notes/start-recording
WebSocket /ws/notes/:session_id
GET /api/notes
```

---

## Development Tasks

### Week 1: Infrastructure Setup
- [ ] Initialize Cloudflare Workers project with Wrangler
- [ ] Set up Cloudflare Pages for frontend
- [ ] Create D1 database and run initial migrations
- [ ] Set up FalkorDB Cloud account and create instance
- [ ] Configure Workers AI access
- [ ] Set up environment variables and secrets (FalkorDB Cloud credentials)
- [ ] Create basic project structure (frontend + backend)

### Week 2: Authentication
- [ ] Implement user registration endpoint
- [ ] Implement password hashing (bcrypt)
- [ ] Implement JWT token generation
- [ ] Create login endpoint
- [ ] Add session management in KV
- [ ] Build registration UI component
- [ ] Build login UI component
- [ ] Add authentication middleware

### Week 3: Voice Capture
- [ ] Implement Durable Object for voice sessions
- [ ] Set up WebRTC audio capture in frontend
- [ ] Create WebSocket connection for audio streaming
- [ ] Integrate Deepgram Nova-3 via Workers AI
- [ ] Implement real-time transcription
- [ ] Build voice recording UI (record button, waveform)
- [ ] Display live transcript
- [ ] Save transcript to D1
- [ ] Create notes list view

---

## Dependencies

### External Services
- **Cloudflare Account**: Workers Paid plan ($5/mo) for Durable Objects
- **FalkorDB Cloud**: Starter tier ($15/mo) - create account at cloud.falkordb.com
- **Workers AI**: Free during beta (Deepgram access)

### NPM Packages
```json
{
  "dependencies": {
    "@cloudflare/workers-types": "^4.0.0",
    "hono": "^3.0.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0"
  },
  "devDependencies": {
    "wrangler": "^3.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

---

## Testing Strategy

### Unit Tests
- User registration validation
- Password hashing correctness
- JWT token generation/validation
- Audio chunk buffering logic

### Integration Tests
- End-to-end registration flow
- Login and session creation
- Voice recording -> transcription -> storage
- WebSocket connection stability

### Manual Testing
- Test on Chrome, Safari, Firefox
- Test microphone permissions
- Test audio quality
- Test transcript accuracy with various accents

---

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| WebRTC compatibility issues | High | Low | Test on major browsers, provide fallback |
| Deepgram STT latency >2s | Medium | Low | Use Workers AI edge locations, monitor latency |
| D1 performance issues | Medium | Low | Add indexes, monitor query times |
| FalkorDB Cloud connection fails | High | Low | Connection pooling in DO, retry logic, 99.95% SLA |

---

## Deliverable Checklist

- [ ] Users can register with email/password
- [ ] Users can log in and receive JWT token
- [ ] Users can click record button
- [ ] Audio is captured via WebRTC
- [ ] Audio is transcribed using Deepgram
- [ ] Transcript appears in real-time (<2s latency)
- [ ] Transcript is saved to D1
- [ ] Users can view their previous notes
- [ ] Basic UI is responsive and functional
- [ ] All success criteria met

---

## Next Phase

After Phase 1 completion, proceed to **Phase 2: Entity Extraction & Knowledge Graph** where we'll add intelligent entity extraction and begin building the knowledge graph.

---

**Phase Owner:** Development Team
**Last Updated:** 2025-11-10
**Status:** Ready for Implementation
