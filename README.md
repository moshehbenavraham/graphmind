# GraphMind

Voice-first personal knowledge assistant with GraphRAG on Cloudflare's edge network.

## What is GraphMind?

GraphMind is an intelligent "second brain" that captures, organizes, and retrieves your personal knowledge through natural voice conversations. It combines real-time voice AI with graph-based retrieval-augmented generation (GraphRAG) to provide 90%+ accuracy in knowledge retrieval.

### Key Features

- **Voice-First Design** - Natural conversation interface for capturing and querying knowledge
- **GraphRAG Technology** - 90%+ accuracy vs 56% with traditional RAG
- **Edge-Native** - Runs on Cloudflare's global network for low latency
- **Privacy-First** - Isolated user data with FalkorDB namespaces
- **100% Open Source** - Built on open standards and technologies

### Technology Stack

- **Runtime:** Cloudflare Workers (serverless edge compute)
- **Voice AI:** Pipecat + Deepgram (STT/TTS) + Llama 3.1-8b (entity extraction)
- **Knowledge Graph:** FalkorDB + GraphRAG SDK
- **Storage:** D1 (SQLite), KV (cache), R2 (audio)
- **Frontend:** Cloudflare Pages + WebRTC

## Project Status

**Current Phase:** Phase 1 - Foundation (In Progress)

- ✅ Planning Complete
- ✅ Wrangler Configuration & Project Setup (Feature 001) - Complete
- 🚧 Phase 1 (Foundation): In Progress
- Target MVP: 12 weeks from start

See [Implementation Phases](docs/PRD/README_PRD.md#phases) for details.

## Setup

### Prerequisites

Before starting, ensure you have:
- **Node.js 18+** (verify with `node --version`)
- **npm** or **pnpm** package manager
- **Cloudflare account** with API token ([Get token here](https://dash.cloudflare.com/profile/api-tokens))

### Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd graphmind
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and fill in:
   # - CLOUDFLARE_API_TOKEN (from Cloudflare dashboard)
   # - CLOUDFLARE_ACCOUNT_ID (from Cloudflare dashboard)
   # - FalkorDB credentials (see FalkorDB Setup below)
   ```

2a. **FalkorDB Cloud Setup** (required for Feature 003+)
    ```bash
    # 1. Sign up at https://app.falkordb.cloud/
    # 2. Create a database instance (free tier for development)
    # 3. Copy your connection credentials
    # 4. Add to .env:
    FALKORDB_HOST=your-instance.falkordb.cloud
    FALKORDB_PORT=6379
    FALKORDB_USER=default
    FALKORDB_PASSWORD=your-password-here
    ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Create D1 database**
   ```bash
   npm run db:create
   ```
   Copy the `database_id` from the output and paste it into `wrangler.toml` under `[[d1_databases]]`

5. **Create KV namespace**
   ```bash
   npm run kv:create
   ```
   Copy the `id` from the output and paste it into `wrangler.toml` under `[[kv_namespaces]]`

6. **Run database migrations**
   ```bash
   npm run db:migrate:local
   ```

7. **Start development server**
   ```bash
   npm run dev
   ```

8. **Verify setup**
   Visit http://localhost:8787/ - you should see a JSON health check response with all bindings showing as available.

See **[docs/SETUP.md](docs/SETUP.md)** for complete setup instructions.

### For Claude Code Users

If you're using Claude Code to work on this project:

1. **Setup Wrangler:** Follow [docs/SETUP.md](docs/SETUP.md) for Cloudflare authentication
2. **Setup MCP Servers:** Follow [docs/MCP_SETUP.md](docs/MCP_SETUP.md) for Cloudflare MCP integration
3. **Read CLAUDE.md:** Project context for Claude Code

## Documentation

### Getting Started
- **[docs/SETUP.md](docs/SETUP.md)** - Complete development environment setup
- **[docs/MCP_SETUP.md](docs/MCP_SETUP.md)** - Cloudflare MCP servers for Claude Code
- **[CLAUDE.md](CLAUDE.md)** - Project context for AI assistants

### Product & Requirements
- **[PRD Overview](docs/PRD/README_PRD.md)** - Product requirements documentation map
- **[Product Requirements](docs/PRD/REQUIREMENTS-PRD.md)** - Complete PRD (comprehensive)
- **[Changelog](docs/CHANGELOG.md)** - Documentation version history

### Implementation Phases
- **[Phase 1: Foundation](docs/PRD/phases/phase-1-foundation.md)** (Weeks 1-3) - Auth, voice capture, transcription
- **[Phase 2: Knowledge Graph](docs/PRD/phases/phase-2-knowledge-graph.md)** (Weeks 4-6) - Entity extraction, graph building
- **[Phase 3: Voice Query](docs/PRD/phases/phase-3-voice-query.md)** (Weeks 7-9) - GraphRAG retrieval, Q&A
- **[Phase 4: Polish](docs/PRD/phases/phase-4-polish.md)** (Weeks 10-12) - Multi-source ingestion, search, UX
- **[Phase 5: Advanced](docs/PRD/phases/phase-5-advanced.md)** (Future) - Collaboration, integrations, analytics

### Technical Specifications
- **[Database Schemas](docs/PRD/technical/database-schemas.md)** - D1, FalkorDB, KV, R2
- **[API Specifications](docs/PRD/technical/api-specifications.md)** - REST + WebSocket endpoints
- **[Non-Functional Requirements](docs/PRD/requirements/non-functional-requirements.md)** - Performance, security, costs

### Project Management
- **[Success Metrics](docs/PRD/project/success-metrics.md)** - KPIs and targets
- **[Risks & Mitigations](docs/PRD/project/risks-and-mitigations.md)** - Risk register

## Architecture Overview

### Data Flow: Voice Note Capture
```
User speaks → WebRTC → Deepgram STT → Transcript
     ↓
Llama 3.1 entity extraction → Entities/Relationships
     ↓
FalkorDB GraphRAG → Knowledge Graph update
     ↓
Store in D1 → Return success
```

### Data Flow: Voice Query
```
User asks question → WebRTC → Deepgram STT → Question
     ↓
FalkorDB GraphRAG → Cypher query generation
     ↓
Execute query → Results → Llama 3.1 answer generation
     ↓
Deepgram TTS → Audio response → Stream to user
```

## Development Commands

### Local Development
```bash
# Start local dev server (with hot reload)
npm run dev

# Generate TypeScript types for Cloudflare bindings
npm run cf-typegen
```

### Database Management
```bash
# Create D1 database
npm run db:create

# Apply migrations locally
npm run db:migrate:local

# Apply migrations to remote database
npm run db:migrate

# Execute SQL against local database
npm run db:shell "SELECT * FROM users;"
```

### Key-Value Store
```bash
# Create KV namespace
npm run kv:create
```

### Deployment
```bash
# Deploy to production (requires configured wrangler.toml)
npm run deploy
```

### Testing
```bash
# Run tests (when implemented)
npm test
```

## Troubleshooting

### Port Conflicts

**Problem**: "Address already in use" error when starting dev server

**Solution**:
```bash
# Find and kill process using port 8787
lsof -ti:8787 | xargs kill -9

# Or specify a different port
npx wrangler dev --port 8788
```

### Missing Credentials

**Problem**: "Authentication error" or "API token invalid"

**Solution**:
1. Verify your `.env` file exists and has correct values
2. Get a new API token from https://dash.cloudflare.com/profile/api-tokens
3. Ensure the token has proper permissions (Edit Cloudflare Workers)
4. Check that `CLOUDFLARE_ACCOUNT_ID` matches your account

### Database Not Found

**Problem**: "Database not found" when running migrations

**Solution**:
1. Ensure you've created the database: `npm run db:create`
2. Copy the `database_id` from output into `wrangler.toml`
3. Try again: `npm run db:migrate:local`

### Wrangler Configuration Invalid

**Problem**: "Invalid configuration" error

**Solution**:
```bash
# Verify wrangler.toml syntax
npx wrangler whoami

# Check for empty binding IDs - they should be filled in after service creation
```

## Cost Structure

- **Local Development:** $0/month (FalkorDB Cloud free tier + Cloudflare free tiers)
- **Production (Light Use):** ~$20/month (FalkorDB Starter $15 + Cloudflare $5)
- **Production (Scale):** ~$55/month (FalkorDB Pro $50 + Cloudflare $5-20)

Workers AI is currently free during beta.

## Contributing

This project is in early development. Contribution guidelines will be added once Phase 1 is complete.

## Key Technologies

- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge compute platform
- [FalkorDB](https://www.falkordb.com/) - Knowledge graph database
- [GraphRAG SDK](https://github.com/FalkorDB/GraphRAG-SDK) - Graph-based RAG
- [Pipecat](https://github.com/pipecat-ai/pipecat) - Voice AI framework
- [Deepgram](https://deepgram.com/) - STT/TTS models
- [Llama 3.1-8b](https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct) - Entity extraction & Q&A

## License

MIT License (TBD - to be formalized)

## Support

- **Issues:** GitHub Issues (link TBD)
- **Documentation:** See [docs/PRD/README_PRD.md](docs/PRD/README_PRD.md)
- **Discussions:** GitHub Discussions (link TBD)

---

**Status:** Pre-Implementation | **Version:** 0.1.0 | **Last Updated:** 2025-11-10

