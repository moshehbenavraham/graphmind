# GraphMind Restructuring Plan

## Why Rebuild?

The current Cloudflare Workers stack has accumulated friction:

- **Cloudflare Workers complexity** - Durable Objects choreography, edge runtime constraints, wrangler quirks, Workers AI limitations
- **FalkorDB over tunnel** - Janky local dev experience, bridging HTTP to Redis protocol, connection pool gymnastics
- **JSDoc typing** - TypeScript benefits without TypeScript tooling; worst of both worlds
- **Too many moving parts** - D1 + KV + R2 + Durable Objects + Queues + external graph DB = lots of surface area to debug

The voice pipeline and GraphRAG concepts work. The infrastructure around them is the problem.

---

## Target Stack

### Backend: FastAPI (Python)
- Use existing customized FastAPI boilerplate
- Already has Postgres + Alembic + auth patterns wired up
- Python plays nicer with AI/ML ecosystem
- Conventional, well-understood, easy to debug

### Database: Postgres + Apache AGE
- Single database for everything (relational + graph)
- AGE extension adds Cypher-compatible graph queries
- No second database to run/monitor/backup
- Existing Cypher queries from FalkorDB largely translate over
- `CREATE EXTENSION age;` and go

### Voice Pipeline (keep what worked)
- **Deepgram Nova 3** for STT - worked well, keep it
- **Deepgram Aura 2** for TTS - worked well, keep it
- WebSocket streaming pattern was solid, adapt to FastAPI

### LLM for Entity Extraction
Options:
- OpenAI API (easiest, best quality, costs money)
- Local Ollama + Llama 3.1 (free, needs local GPU)
- Groq API (fast, free tier available)
- Keep flexible, abstract behind a service interface

### Frontend
- Keep React or switch to something else? TBD
- The neo-brutalist design system was fun, could port it
- Or start fresh with simpler UI, focus on functionality first

---

## Migration Workflow

```
1. git checkout -b archive/v1-cloudflare-workers
2. git push origin archive/v1-cloudflare-workers
3. git checkout main
4. Move everything to a local subfolder (DO NOT COMMIT)
5. Use old code as reference to extract:
   - Detailed PRD
   - Feature inventory
   - What worked / what didn't
   - Cypher queries to adapt
   - Voice pipeline logic to port
6. Write comprehensive docs from the reference
7. Delete the subfolder
8. Initialize fresh with FastAPI boilerplate
```

---

## What to Preserve (Extract Before Wiping)

### Documentation
- PRD structure and phase breakdowns
- API endpoint designs (adapt to FastAPI)
- Database schema concepts (users, sessions, voice_notes, entities)

### Cypher Queries
- Entity CRUD operations
- Relationship creation patterns
- Search queries (adapt for AGE syntax if needed)

### Voice Pipeline Logic
- Audio chunking and streaming patterns
- WebSocket protocol design (8-event model was solid)
- PCM encoding/decoding approach
- Transcription → entity extraction → graph sync flow

### Entity Extraction
- LLM prompt templates for extraction
- Entity types (Person, Project, Meeting, Topic, Technology, Location, Organization)
- Relationship types (WORKED_WITH, WORKS_ON, ATTENDED, DISCUSSED, etc.)
- Confidence scoring approach
- Deduplication logic (entity merger worked well - 99.7% accuracy)

### Design System (Optional)
- Neo-brutalist tokens and primitives if we want that aesthetic
- Or document it for potential future use

---

## What to Drop

- All Cloudflare-specific code (Workers, Durable Objects, D1, KV, R2, Queues)
- FalkorDB client and REST bridge
- JSDoc typing approach (use actual Python type hints)
- Overly complex caching layers
- The wrangler.toml dance

---

## New Architecture Sketch

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend                           │
│              (React or whatever, TBD)                   │
└─────────────────┬───────────────────────────────────────┘
                  │ HTTP + WebSocket
                  ▼
┌─────────────────────────────────────────────────────────┐
│                    FastAPI Backend                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ Auth/Users  │  │ Voice API   │  │ Graph API       │ │
│  │ (existing)  │  │ (WebSocket) │  │ (Cypher/AGE)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ Deepgram    │  │ LLM Service │  │ Entity          │ │
│  │ STT/TTS     │  │ (extraction)│  │ Resolution      │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│              Postgres + Apache AGE                      │
│  ┌─────────────────────┐  ┌───────────────────────────┐ │
│  │ Relational Tables   │  │ Graph (AGE)               │ │
│  │ - users             │  │ - Entity nodes            │ │
│  │ - sessions          │  │ - Relationships           │ │
│  │ - voice_notes       │  │ - Per-user namespacing    │ │
│  │ - voice_queries     │  │   via graph names         │ │
│  └─────────────────────┘  └───────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## AGE-Specific Notes

### Setup
```sql
CREATE EXTENSION age;
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
```

### Per-User Graph Namespacing
Each user gets their own graph (like FalkorDB namespaces):
```sql
SELECT create_graph('user_123');
```

### Cypher Query Pattern
```sql
SELECT * FROM cypher('user_123', $$
  MATCH (p:Person)-[:WORKS_ON]->(proj:Project)
  RETURN p.name, proj.name
$$) AS (person_name agtype, project_name agtype);
```

### Migration Consideration
- AGE Cypher is close to Neo4j/FalkorDB Cypher but has quirks
- May need to adapt some queries
- Test the complex ones (multi-hop traversals, aggregations)

---

## Open Questions

1. **Frontend**: Keep React? Try SvelteKit? Or just API-first, build UI later?
2. **Hosting**: Where to run FastAPI? (Railway, Fly.io, VPS, self-host?)
3. **File Storage**: S3-compatible for audio files? Local disk? Postgres blobs?
4. **Background Jobs**: Celery? ARQ? Or keep it simple with sync processing initially?
5. **Real-time**: WebSockets in FastAPI work fine, but consider if we need message queue for scale

---

## Next Steps

1. Create archive branch with current codebase
2. Extract comprehensive PRD from existing code/docs
3. Document all Cypher queries and entity extraction prompts
4. Initialize FastAPI boilerplate on main
5. Set up Postgres + AGE locally
6. Port auth (probably already in boilerplate)
7. Build voice note capture endpoint
8. Build entity extraction service
9. Build graph operations layer
10. Build voice query flow
11. Frontend (whenever)

---

## Why This Stack is Better

| Concern | Old (Cloudflare) | New (FastAPI + AGE) |
|---------|------------------|---------------------|
| Local dev | Wrangler + tunnels + Docker FalkorDB | `docker-compose up`, done |
| Debugging | Distributed edge logs, Durable Object state inspection | Local Python debugger |
| Database | D1 + KV + R2 + FalkorDB (4 systems) | Postgres (1 system) |
| Type safety | JSDoc annotations | Python type hints + mypy |
| Deployment | Multiple wrangler deploys, Pages, tunnels | Single container/service |
| Cost | Workers pricing, R2, D1, external DB | Single Postgres instance |
| Ecosystem | Cloudflare-specific everything | Standard Python/FastAPI |
