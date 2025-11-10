# Next Spec: Wrangler Configuration & Project Setup

**Generated**: 2025-11-10
**Phase**: Phase 1 - Foundation
**Priority**: P1 (Next to Build)
**Estimated Context**: ~8,000 tokens
**Dependencies**: None (starting from scratch)
**Status**: Ready to Implement

---

## What We're Building

We're establishing the foundational Cloudflare Workers project structure with Wrangler configuration, D1 database setup, and basic project scaffolding. This is the absolute first step required before any feature development can begin - without this foundation, we can't deploy Workers, store data, or connect to external services.

## Why This Next

This is the logical next step because:

- **Dependency satisfaction**: No prerequisites - this is the starting point
- **Enables future work**: Blocks ALL other development (authentication, voice capture, GraphRAG)
- **Phase requirement**: Phase 1 Foundation explicitly requires "Cloudflare Workers + Pages setup" and "D1 database schema"
- **Risk mitigation**: Establishes correct project structure early, prevents costly refactoring later

---

## Scope (Single Context Window)

### ✅ Included in This Spec

- Wrangler project initialization with TypeScript support
- `wrangler.toml` configuration for Workers, D1, KV, R2, Durable Objects
- D1 database creation and initial migrations (users, sessions tables)
- Basic project structure (src/, migrations/, tests/ directories)
- Environment variable configuration (.env.example)
- Package.json with required dependencies
- Basic README with setup instructions
- Testing that wrangler dev runs successfully

### ❌ Explicitly Excluded (Future Specs)

- Authentication implementation - Will be in next spec after foundation
- Voice capture system - Phase 1 later component
- FalkorDB integration - Requires auth to be in place first
- Frontend UI - Will come after backend structure is solid
- Entity extraction - Phase 2 component
- Deployment to production - Local dev setup only for now

### 📊 Token Estimate

**Estimated Implementation**: ~8,000 tokens

Breakdown:
- Wrangler setup & configuration: ~2K tokens
- D1 migrations & schema: ~2K tokens
- Project structure & files: ~2K tokens
- Documentation & testing: ~2K tokens

---

## User Stories for This Spec

### Story 1: Developer Setup (P1)

**As a** GraphMind developer
**I want** a properly configured Cloudflare Workers project
**So that** I can start building features with all required services available

**Acceptance Criteria**:
- [ ] `wrangler.toml` exists with all bindings configured
- [ ] `wrangler dev` starts local development server successfully
- [ ] D1 database created and accessible
- [ ] Environment variables documented in .env.example
- [ ] Project structure matches GraphMind architecture

### Story 2: Database Foundation (P1)

**As a** developer
**I want** the core D1 database schema in place
**So that** I can store users, sessions, and notes when features are built

**Acceptance Criteria**:
- [ ] Users table created with correct schema
- [ ] Sessions table created
- [ ] Voice notes table (basic structure) created
- [ ] Migrations run successfully with `wrangler d1 migrations apply`
- [ ] Can query empty tables via wrangler d1 execute

---

## Technical Approach

### Architecture Overview

This establishes the foundation layer of GraphMind:

```
Developer Environment
       |
    wrangler.toml (configuration)
       |
       ├─> Cloudflare Workers (API layer - not yet implemented)
       ├─> D1 Database (users, notes, sessions)
       ├─> KV Namespace (future caching)
       ├─> R2 Bucket (future audio storage)
       └─> Durable Objects (future voice sessions)
```

### Cloudflare Components

**Workers**:
- No endpoints yet - just configuration for future Workers
- Bindings: D1, KV, R2, AI (Workers AI)

**D1 (SQLite)**:
- Database name: `graphmind-db`
- Tables: `users`, `sessions`, `voice_notes` (basic)
- Migrations directory: `migrations/`
- Key queries: Create tables, add indexes

**KV (Key-Value)**:
- Namespace: `GRAPHMIND_KV`
- Purpose: Future session storage, entity cache, rate limiting
- Not used yet, but configured

**R2 (Object Storage)**:
- Bucket: `graphmind-audio`
- Purpose: Future audio file storage (optional user preference)
- Not used yet, but configured

**Durable Objects**:
- Configured in wrangler.toml but not implemented yet
- Future: VoiceSessionManager class

### FalkorDB (Not in This Spec)

FalkorDB connection will be established in a future spec after authentication is in place. For now, we'll just document the connection string format in .env.example.

---

## Implementation Steps

### 1. Setup & Configuration

- Install Wrangler globally or use npx (project-local recommended)
- Initialize TypeScript configuration
- Create package.json with dependencies
- Set up .gitignore for Cloudflare projects

### 2. Wrangler Configuration

- Create `wrangler.toml` with:
  - name = "graphmind-api"
  - main = "src/index.js" (or .ts)
  - compatibility_date = "2024-11-10"
  - D1 database binding
  - KV namespace binding
  - R2 bucket binding
  - Durable Objects binding (configured, not implemented)
  - Workers AI binding

### 3. D1 Database Setup

- Create D1 database: `wrangler d1 create graphmind-db`
- Create migrations directory
- Write migration 0001_initial_schema.sql:
  - CREATE TABLE users
  - CREATE TABLE sessions
  - CREATE TABLE voice_notes (basic)
  - CREATE INDEXES
- Apply migration: `wrangler d1 migrations apply graphmind-db --local`

### 4. Project Structure

```
/
├── src/
│   └── index.js (placeholder Worker)
├── migrations/
│   └── 0001_initial_schema.sql
├── tests/ (placeholder)
├── wrangler.toml
├── package.json
├── .env.example
├── .gitignore
└── README.md (update with setup steps)
```

### 5. Testing & Validation

- Run `wrangler dev` and verify it starts
- Run `wrangler d1 execute graphmind-db --local --command "SELECT name FROM sqlite_master WHERE type='table';"`
- Verify all tables exist
- Test environment variable loading

---

## File Structure

New files to create:

```
/
├── wrangler.toml
├── package.json
├── .env.example
├── src/
│   └── index.js (basic Worker handler)
├── migrations/
│   └── 0001_initial_schema.sql
└── README.md (updated)
```

---

## Success Criteria

This spec is complete when:

- [ ] `wrangler.toml` exists with all required bindings
- [ ] D1 database `graphmind-db` created (locally)
- [ ] Initial migration 0001_initial_schema.sql applied successfully
- [ ] Tables `users`, `sessions`, `voice_notes` exist in D1
- [ ] `wrangler dev` starts without errors
- [ ] Can execute SQL queries against local D1 database
- [ ] `.env.example` documents all required environment variables
- [ ] Project structure matches GraphMind architecture
- [ ] README.md updated with setup instructions
- [ ] Basic Worker responds to HTTP requests (even if just "Hello World")

---

## Dependencies

### Prerequisites (Must Exist)

- Node.js 18+ installed - Status: ✅ (assumed in dev environment)
- npm or pnpm installed - Status: ✅ (assumed)
- Cloudflare account - Status: ✅ (based on CLAUDE.md API token requirement)
- Cloudflare API token - Status: ✅ (documented in CLAUDE.md)

### Enables Future Work

Once this is complete, we can build:
- User authentication system (POST /api/auth/register, /login)
- Voice capture endpoints (POST /api/notes/start-recording)
- FalkorDB connection setup (requires auth to secure namespaces)
- Frontend UI (needs API endpoints to call)
- Durable Objects implementation (VoiceSessionManager)

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Wrangler version compatibility issues | Low | Medium | Pin wrangler version in package.json, test locally |
| D1 local mode vs production differences | Medium | Low | Document differences, test migrations in both modes |
| Missing Cloudflare credentials | Low | High | Clear .env.example documentation, setup guide |
| Incorrect binding names breaking future code | Low | Medium | Follow Cloudflare naming conventions, document in README |

---

## Testing Approach

### Manual Testing Checklist

- [ ] Run `npm install` successfully
- [ ] Run `wrangler whoami` to verify authentication
- [ ] Run `wrangler d1 create graphmind-db` (local)
- [ ] Run `wrangler d1 migrations apply graphmind-db --local`
- [ ] Run `wrangler d1 execute graphmind-db --local --command "SELECT * FROM users;"`
- [ ] Run `wrangler dev` and visit http://localhost:8787
- [ ] Verify response from basic Worker
- [ ] Check all bindings accessible in Worker (env.DB, env.KV, etc.)

### Integration Testing

- [ ] Verify D1 binding works in Worker context
- [ ] Verify environment variables load correctly
- [ ] Test wrangler.toml syntax is valid

### Performance Testing

Not applicable for setup - performance testing will come with actual features.

---

## D1 Schema (Initial Migration)

### Migration: 0001_initial_schema.sql

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

CREATE INDEX idx_users_email ON users(email);

-- Sessions table
CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_type TEXT, -- 'note_capture', 'voice_query', 'chat'
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Voice notes table (basic structure for now)
CREATE TABLE voice_notes (
    note_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    transcript TEXT NOT NULL,
    processing_status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_notes_user ON voice_notes(user_id);
CREATE INDEX idx_notes_created ON voice_notes(created_at);
```

---

## Wrangler.toml Configuration

```toml
name = "graphmind-api"
main = "src/index.js"
compatibility_date = "2024-11-10"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "graphmind-db"
database_id = "" # Will be populated after wrangler d1 create

# KV Namespace
[[kv_namespaces]]
binding = "KV"
id = "" # Will be populated after wrangler kv:namespace create

# R2 Bucket
[[r2_buckets]]
binding = "AUDIO_BUCKET"
bucket_name = "graphmind-audio"

# Durable Objects (configured but not implemented yet)
[[durable_objects.bindings]]
name = "VOICE_SESSION"
class_name = "VoiceSessionManager"
script_name = "graphmind-api"

# Workers AI
[ai]
binding = "AI"

# Environment variables (secrets managed via wrangler secret)
[vars]
ENVIRONMENT = "development"
```

---

## Next After This

Once this spec is complete, the next logical steps will be:

1. **Authentication System** - User registration and login (POST /api/auth/register, /login) with JWT tokens and bcrypt password hashing
2. **FalkorDB Connection Setup** - Connect to FalkorDB Cloud with connection pooling in Durable Objects
3. **Basic Frontend Structure** - Cloudflare Pages setup with home page and record button

Running `/nextspec` again after completion will re-analyze and recommend "Authentication System" as the next step.

---

## References

### PRD Documentation
- **Phase Doc**: docs/PRD/phases/phase-1-foundation.md
- **Requirements**: docs/PRD/REQUIREMENTS-PRD.md (Section 2.1 - Architecture, Section 5.1 - D1 Schema)
- **Technical Specs**: docs/PRD/technical/database-schemas.md

### Existing Specs
- None yet (this is the first spec)

### External Documentation
- Cloudflare Wrangler Docs: https://developers.cloudflare.com/workers/wrangler/
- D1 Database Docs: https://developers.cloudflare.com/d1/
- Workers AI Docs: https://developers.cloudflare.com/workers-ai/
- Cloudflare KV Docs: https://developers.cloudflare.com/kv/
- R2 Docs: https://developers.cloudflare.com/r2/

---

## Notes

**Important Considerations**:

1. **Local vs Production**: D1 has a local mode (`--local` flag) and remote mode. For now, we're setting up local only. Production database will be created separately when deploying.

2. **API Token vs OAuth**: Per CLAUDE.md, GraphMind uses project-specific Wrangler with API tokens (not global OAuth). The `.env.example` should document CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.

3. **No Sudo**: Per CLAUDE.md, we can't use sudo. If any package requires sudo, we'll need to ask the user to install it manually.

4. **FalkorDB Not Yet**: We're NOT connecting to FalkorDB in this spec. That will come after authentication is in place to properly secure user namespaces.

5. **TypeScript Option**: While the PRD doesn't mandate TypeScript, it's mentioned in NFR-MT-001 (Code Quality). For now, we'll start with JavaScript and can migrate to TypeScript later if needed.

**Trade-offs Made**:

- Starting with JavaScript instead of TypeScript for faster initial setup
- Using local D1 only initially (production database setup deferred)
- Basic Worker structure (minimal routing, no framework yet) - will add Hono or similar later
- No tests yet - will add testing infrastructure after basic features exist

---

**Ready to implement?** This is a foundational spec - start implementation directly:

1. Run the commands to initialize Wrangler
2. Create the wrangler.toml configuration
3. Set up D1 and apply migrations
4. Test that `wrangler dev` works
5. After completion, run `/nextspec` to get "Authentication System" as the next spec
