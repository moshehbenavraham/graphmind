# GEMINI.md

This file provides guidance to Google's Gemini when working with code in this repository.

# IMPORTANT RULES

 - This is the local dev environment and while having the awareness of the "production" version, should be focused on local development
 - You must only use valid ASCII UTF-8 LF characters in any of the files of this project
 - Never attribute anyone or add co-authors EVER in commits, code, documentations, etc
 - You can't run SUDO, don't look for alternative paths, rather pause when you'd like to use SUDO and ask the user to run commands for you

# IMPORTANT NOTES

 - You have access to several relevant MCP servers per .mcp.json
 - When implementing you should run ALL wrangler commands directly, ALL npm/packack commands, ALL bash scripts in the project - NEVER ask the user to run commands you have tools for; if a command is in your approved list, you MUST use it

## Project Overview

**GraphMind** is a voice-first personal knowledge assistant that runs on Cloudflare's edge network. It combines real-time voice AI (custom Durable Object pipeline) with graph-based retrieval-augmented generation (FalkorDB GraphRAG) to create an intelligent "second brain" that captures, organizes, and retrieves personal knowledge through natural conversation.

**Key Differentiators:**
- 100% open source, runs on Cloudflare edge
- GraphRAG (90%+ accuracy vs traditional RAG)
- Voice-first design with natural conversation
- Privacy-first with isolated user data

## Technology Stack

### Frontend
- **Cloudflare Pages** - Static hosting
- **React/Svelte** - UI framework (not yet decided)
- **WebRTC** - Voice capture/playback

### Backend
- **Cloudflare Workers** - API endpoints and orchestration
- **Cloudflare Durable Objects** - Custom voice session management (QuerySessionManager) and connection pooling
- **Workers AI** - Deepgram Nova-3 (STT), Deepgram Aura-2 (TTS), Llama 3.1-8b (entity extraction, Q&A)

### Data Storage
- **FalkorDB** - Knowledge graph database (main data store)
  - **Development**: Self-hosted Docker on localhost (sub-millisecond performance)
  - **Production**: Cloudflare Tunnel + local Docker (current) or VPS/FalkorDB Cloud (future)
  - **Access Method**: HTTP/REST API via `scripts/falkordb-rest-api.js` (bridges HTTP ↔ Redis protocol)
  - See [docs/FALKORDB_TUNNEL.md](docs/FALKORDB_TUNNEL.md) for tunnel setup
  - See [docs/PRD/technical/falkordb-deployment.md](docs/PRD/technical/falkordb-deployment.md) for deployment options
- **D1 (SQLite)** - User metadata, sessions, note transcripts
- **KV** - Caching, sessions, rate limiting
- **R2** - Audio recordings (optional, user preference)

### Voice AI Pipeline
- **Custom Durable Object** - `QuerySessionManager` handles WebSocket connections, audio streaming, session state
- **Deepgram Nova-3** - Speech-to-text via `@cf/deepgram/nova-3` (Workers AI)
- **Deepgram Aura-2** - Text-to-speech via `@cf/deepgram/aura-2` (Workers AI)
- **Llama 3.1-8b** - Entity extraction and answer generation via `@cf/meta/llama-3.1-8b-instruct`
- **WebSocket Protocol** - Custom 8-event protocol for real-time audio streaming
- **Optional**: Pipecat smart-turn-v2 model available via Workers AI (not currently implemented)

### Knowledge Graph
- **FalkorDB GraphRAG SDK** (Python, v0.5+)
- **Cypher** - Graph query language
- **Auto ontology detection** - No manual ontology setup required

## Architecture

### Data Flow: Voice Note Capture
```
User speaks → WebSocket → QuerySessionManager (Durable Object)
     ↓
Deepgram Nova-3 STT (Workers AI) → Transcript
     ↓
Llama 3.1 entity extraction → Entities/Relationships
     ↓
FalkorDB GraphRAG SDK → Knowledge Graph update
     ↓
Store in D1 → Return success
```

### Data Flow: Voice Query
```
User asks question → WebSocket → QuerySessionManager (Durable Object)
     ↓
Deepgram Nova-3 STT (Workers AI) → Natural language question
     ↓
FalkorDB GraphRAG SDK → Cypher query generation
     ↓
Execute query → Graph results → Llama 3.1 answer generation
     ↓
Deepgram Aura-2 TTS (Workers AI) → Audio response
     ↓
Upload to R2 → Signed URL → Stream to user
```

### Database Architecture
- **D1 (SQLite)**: Users, voice_notes, voice_queries, query_sessions, user_settings, entity_cache
- **FalkorDB (Graph)**: Nodes (Person, Project, Meeting, Topic, Technology, etc.) with relationships
- **KV**: Query cache, session data, entity resolution, rate limiting
- **R2**: Audio files organized by user_id/audio/notes/ and user_id/audio/queries/

## Development Commands

### Initial Setup & Authentication

**IMPORTANT:** GraphMind uses **project-specific Wrangler** with **API tokens** (not global OAuth).

```bash
# Install project dependencies (includes Wrangler)
npm install

# Get Cloudflare API Token:
# 1. Go to https://dash.cloudflare.com/profile/api-tokens
# 2. Create token with "Edit Cloudflare Workers" template
# 3. Copy token and account ID

# Create .env file from template
cp .env.example .env

# Edit .env and fill out the variables per comments

# Verify authentication
npx wrangler whoami
```

**Why this approach?**
- Version consistency across team
- Works in CI/CD
- Easier token rotation
- No global conflicts

See **docs/SETUP.md** for complete setup instructions.

### Local Development
```bash
# Start Workers local dev server
npm run dev
# Or: npx wrangler dev

# FalkorDB Setup for Local Development:
# 1. Run FalkorDB Docker container locally (recommended)
docker run -d \
  --name falkordb-local \
  -p 6380:6379 \
  -v $(pwd)/falkordb-data:/data \
  falkordb/falkordb:latest

# 2. Start REST API wrapper (bridges HTTP ↔ Redis protocol)
node scripts/falkordb-rest-api.js

# OR use the all-in-one startup script:
bash scripts/start-tunnel-services.sh

# Default .env configuration (already set):
# FALKORDB_HOST=localhost
# FALKORDB_PORT=6380
# FALKORDB_USER=default
# FALKORDB_PASSWORD=

# Performance: Sub-millisecond query times (<1ms connections, 0.32ms node creation)
# See docs/FALKORDB_TUNNEL.md for Cloudflare Tunnel setup (production)
# See docs/PRD/technical/falkordb-deployment.md for deployment options
```

### Testing
```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Test Workers locally
wrangler dev --test-scheduled
```

### Deployment
```bash
# Deploy Workers + Durable Objects
npm run deploy
# Or: npx wrangler deploy

# Deploy frontend to Pages
npx wrangler pages deploy

# Run D1 migrations on production
npx wrangler d1 migrations apply graphmind-db --env production
```

## Code Architecture

### Project Structure (when implemented)
```
/
├── src/
│   ├── workers/          # Cloudflare Workers (API endpoints)
│   ├── durable-objects/  # Voice session managers, connection pooling
│   ├── lib/
│   │   ├── auth/         # JWT, bcrypt, session management
│   │   ├── voice/        # WebRTC, STT/TTS, audio processing
│   │   ├── graph/        # FalkorDB client, Cypher generation
│   │   ├── entities/     # Entity extraction, resolution
│   │   └── db/           # D1 queries, KV operations, R2 storage
│   └── frontend/         # React/Svelte UI
├── migrations/           # D1 database migrations
├── tests/
├── wrangler.toml         # Cloudflare Workers configuration
└── package.json
```

### Key Design Patterns

**Durable Objects Usage:**
- `QuerySessionManager` - Custom implementation for WebSocket voice sessions
  - Handles WebSocket connections for voice capture/query
  - Audio chunking and buffering (WebM format)
  - Direct Workers AI integration (STT/TTS)
  - Session state management (active queries, transcripts)
  - 8-event WebSocket protocol (audio_chunk, recording_started, transcript_chunk, etc.)
- `FalkorDBConnectionPool` - Maintains persistent connections to FalkorDB
  - Development: Direct Redis protocol to localhost
  - Production: Can adapt to REST API or cloud connections

**Entity Extraction Flow:**
1. Transcript → Llama 3.1 prompt engineering for entity/relationship extraction
2. Check entity_cache (D1) and KV for fuzzy matching
3. Create/merge entities in FalkorDB
4. Update entity_cache for future lookups

**Query Generation:**
- Use FalkorDB GraphRAG SDK's built-in Cypher generation
- Leverage auto-detected ontology from existing graph
- Include conversation context for follow-up questions (stored in query_sessions)

**Performance Optimization:**
- Aggressive caching in KV (query cache TTL: 1 hour)
- Entity resolution cache to reduce FalkorDB lookups
- Batch entity extraction when possible
- Connection pooling in Durable Objects for FalkorDB

## Implementation Status

**Current Phase:** Planning / Pre-Implementation
**Target MVP:** 12 weeks

### Phase Status
- ✅ **Planning Complete** - PRD approved, architecture defined
- 🔲 **Phase 1** (Weeks 1-3) - Foundation: Infrastructure, auth, voice capture
- 🔲 **Phase 2** (Weeks 4-6) - Entity extraction and knowledge graph building
- 🔲 **Phase 3** (Weeks 7-9) - Voice query system with GraphRAG
- 🔲 **Phase 4** (Weeks 10-12) - Polish, multi-source ingestion, search

## Important Technical Details

### FalkorDB GraphRAG SDK
- **Version:** Use GraphRAG SDK v0.5+ (NOT GraphRAG-SDK-v2 which is deprecated)
- **Installation:** `pip install graphrag_sdk`
- **Key Feature:** Automatic ontology detection - no manual ontology setup required
- **Supported Sources:** URLs, PDFs, JSONL, CSV, HTML, TEXT
- **Benchmarks:** 90%+ accuracy vs 56.2% traditional RAG, 5x faster queries, 40% cost reduction

### Workers AI Models
- **STT**: `@cf/deepgram/nova-3` - Speech-to-text transcription
- **TTS**: `@cf/deepgram/aura-2` - Text-to-speech synthesis
- **LLM**: `@cf/meta/llama-3.1-8b-instruct` - Entity extraction and answer generation
- **Optional**: `@cf/pipecat/smart-turn-v2` - Turn detection model (not currently implemented)

**Note**: GraphMind uses direct Workers AI integration via `env.AI.run()`, not Cloudflare Realtime Agents SDK. See `docs/architecture/ADR-001-voice-pipeline-implementation.md` for architectural decision rationale.

### Cost Targets
- **Development:** $0/month (Self-hosted Docker + Cloudflare free tiers)
- **Production Light (VPS):** ~$15-30/month (VPS $10-25 + Cloudflare $5)
- **Production Light (Managed):** ~$20/month (FalkorDB Cloud Starter $15 + Cloudflare $5)
- **Production Heavy (Managed):** ~$55/month (FalkorDB Cloud Pro $50 + Cloudflare $5-20)

**Note:** Workers AI is currently free during beta. Pricing TBA when it exits beta.
**Production deployment decision:** TBD (VPS self-hosted vs FalkorDB Cloud)

### Performance Targets
- Voice transcription latency: <2 seconds (p95)
- Entity extraction: <3 seconds
- Graph query execution: <500ms uncached, <100ms cached
- Answer generation: <2 seconds
- TTS playback start: <1 second
- Page load: <2 seconds

### Current Performance (Development)
- **FalkorDB connection time:** <1ms (vs 8,400ms with cloud free tier)
- **Node creation:** 0.32ms
- **Relationship creation:** 0.41ms
- **Query execution:** <5ms (direct Redis protocol)

### Security Requirements
- JWT tokens with 24-hour expiration
- bcrypt password hashing (cost factor 12)
- User data isolation (separate FalkorDB namespaces per user)
- End-to-end encryption for voice (WebRTC)
- Rate limiting on all endpoints
- Input validation and parameterized queries

## API Structure

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Get JWT token
- `POST /api/auth/logout` - Invalidate session

### Voice Notes
- `POST /api/notes/start-recording` - Get WebSocket URL
- `WebSocket /ws/notes/:session_id` - Real-time transcription
- `GET /api/notes` - List notes
- `GET /api/notes/:note_id` - Get note details
- `DELETE /api/notes/:note_id` - Delete note

### Voice Queries
- `POST /api/query/start` - Start query session
- `WebSocket /ws/query/:session_id` - Real-time Q&A
- `GET /api/query/history` - Query history
- `POST /api/query/:query_id/rate` - Rate answer quality

### Knowledge Graph
- `GET /api/graph` - Get full graph
- `GET /api/graph/entity/:entity_id` - Entity details
- `POST /api/graph/entity` - Create entity
- `PUT /api/graph/entity/:entity_id` - Update entity
- `DELETE /api/graph/entity/:entity_id` - Delete entity
- `POST /api/graph/entity/:id/merge` - Merge duplicates

### Search & Ingestion
- `GET /api/search` - Full-text search
- `POST /api/ingest/url` - Ingest from URL
- `POST /api/ingest/file` - Upload and process file
- `POST /api/ingest/text` - Process pasted text

## References

### Documentation
- **PRD:** `/docs/PRD/REQUIREMENTS-PRD.md` - Complete product requirements
- **README:** `/docs/PRD/README_PRD.md` - Documentation navigation
- **Database Schemas:** `/docs/PRD/technical/database-schemas.md`
- **FalkorDB Deployment:** `/docs/PRD/technical/falkordb-deployment.md` - Architecture & options
- **API Specs:** `/docs/PRD/technical/api-specifications.md`
- **Phase 1 Details:** `/docs/PRD/phases/phase-1-foundation.md`

### External Resources
- FalkorDB: https://github.com/FalkorDB/FalkorDB
- GraphRAG SDK: https://github.com/FalkorDB/GraphRAG-SDK
- FalkorDB Docs: https://docs.falkordb.com/
- Workers AI Docs: https://developers.cloudflare.com/workers-ai/
- Durable Objects: https://developers.cloudflare.com/durable-objects/
- WebSocket API: https://developers.cloudflare.com/workers/runtime-apis/websockets/

