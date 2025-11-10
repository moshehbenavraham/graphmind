---
description: Create technical design for GraphMind features (Cloudflare + FalkorDB + Voice AI)
---

# Technical Design Generator

## User Input

```text
$ARGUMENTS
```

You **MAY** consider the user input if provided (optional hints or constraints).

## Overview

This command creates a technical design document that translates user requirements into GraphMind's architecture: Cloudflare edge stack, FalkorDB GraphRAG, and voice AI pipeline.

## Execution Steps

### 1. Find Feature Directory

Run the prerequisites check:
```bash
bash .workflow/scripts/check-prereqs.sh
```

Parse JSON output to get:
- `FEATURE_DIR`: Absolute path to current feature directory
- `SPEC_FILE`: Path to spec.md (must exist)

If no spec.md exists: ERROR "Run /spec first to create feature specification"

### 2. Load Context

Read the following files:
- `{SPEC_FILE}`: User stories, requirements, success criteria
- `/docs/PRD/REQUIREMENTS-PRD.md`: GraphMind architecture reference
- `/CLAUDE.md`: Technology stack and design patterns

### 3. Create Technical Design

Load template from `.workflow/templates/design-template.md` and fill sections:

#### Section 1: Architecture Overview

High-level component diagram (text-based) showing:
- User interaction layer (WebRTC → Cloudflare Realtime Agent)
- API layer (Workers endpoints)
- State management (Durable Objects)
- Data layer (D1 + FalkorDB + KV + R2)
- Voice AI pipeline (Deepgram STT/TTS, Llama 3.1)

#### Section 2: Cloudflare Stack Decisions

For each Cloudflare service, decide if/how it's used:

**Workers (API Endpoints)**
- List specific endpoints needed
- Request/response formats
- Authentication requirements (JWT)
- Rate limiting strategy

**Durable Objects**
- When to use: WebSocket sessions, connection pooling, state coordination
- Which classes needed (e.g., `VoiceSessionManager`, `FalkorDBPool`)
- State management approach

**D1 (SQLite)**
- Tables needed (refer to existing schema in docs)
- Queries for this feature
- Migration requirements

**KV (Key-Value Store)**
- Caching strategy (entity cache, query cache)
- Session data
- TTL decisions

**R2 (Object Storage)**
- Audio file storage if needed
- File organization structure
- User preference handling

#### Section 3: FalkorDB Schema

Define the knowledge graph schema:

**Node Types**
- New node labels needed (Person, Project, Meeting, etc.)
- Properties for each node type
- Validation rules

**Relationships**
- Relationship types (CONTAINS, REFERENCES, PARTICIPATED_IN, etc.)
- Direction and cardinality
- Properties on relationships

**Key Cypher Queries**
- Write 3-5 essential Cypher queries for this feature
- Include entity extraction queries
- Include retrieval/search queries
- Include graph traversal patterns

**GraphRAG Integration**
- How to use FalkorDB GraphRAG SDK
- Auto-ontology detection approach
- Context window management

#### Section 4: Voice AI Pipeline

Only if feature involves voice interaction:

**Speech-to-Text**
- Model: `@cf/deepgram/nova-3`
- Streaming vs batch
- Language/accent considerations

**Text-to-Speech**
- Model: `@cf/deepgram/aura-1` or `aura-2`
- Voice selection
- Streaming configuration

**Entity Extraction**
- Model: `@cf/meta/llama-3.1-8b-instruct`
- Prompt engineering approach
- Batch processing strategy

**Turn Detection**
- Pipecat `smart-turn-v2` configuration
- Interruption handling
- Silence thresholds

**WebRTC Flow**
- Connection establishment
- Audio codec selection
- Network resilience (reconnection, buffering)

#### Section 5: API Contracts

For each endpoint, define:

**Endpoint Specification**
```
Method: POST/GET/PUT/DELETE
Path: /api/...
Auth: Required/Optional
Rate Limit: X requests/minute

Request:
{
  "field": "type (validation rules)"
}

Response:
{
  "field": "type"
}

WebSocket Events (if applicable):
- event_name: payload
```

Create separate files in `{FEATURE_DIR}/contracts/` for complex APIs.

#### Section 6: Data Flow

Describe the complete data flow for primary user actions:
1. User action →
2. WebRTC/HTTP →
3. Worker endpoint →
4. Durable Object (if needed) →
5. D1/FalkorDB/KV operations →
6. Response generation →
7. TTS (if voice) →
8. Delivery to user

Include error handling at each step.

#### Section 7: Performance Targets

Specific targets from success criteria:
- Latency requirements (p95, p99)
- Throughput expectations
- Cache hit rates
- Caching strategy to achieve targets

#### Section 8: Security Considerations

- JWT validation approach
- User data isolation (FalkorDB namespaces)
- Input validation and sanitization
- Rate limiting and abuse prevention
- Audio file encryption (if R2 used)

#### Section 9: Implementation Notes

- Dependencies on other features
- Migration requirements (D1 migrations)
- Deployment considerations
- Testing approach

### 4. Save Design

Write the completed design to:
```
{FEATURE_DIR}/design.md
```

If API contracts are complex, create:
```
{FEATURE_DIR}/contracts/endpoint-name.md
```

### 5. Report Completion

Output:
```markdown
✅ Technical design created!

**Feature**: {FEATURE_NAME}
**Location**: {FEATURE_DIR}/design.md

**Key Decisions**:
- Cloudflare services: [list]
- FalkorDB nodes: [list]
- Voice AI: [Yes/No]
- New endpoints: [count]

**Next Steps**:
- Review architecture decisions
- Run `/tasks` to generate implementation checklist
```

## Design Principles

- **Edge-first**: Leverage Cloudflare's global network
- **Graph-native**: Think in nodes, relationships, and traversals
- **Voice-optimized**: Minimize latency, handle streaming
- **Cost-conscious**: Use free tiers during dev, efficient paid usage
- **User-isolated**: Separate data per user (namespaces, user_id filtering)
- **Async where possible**: Use Durable Objects for coordination
- **Cache aggressively**: KV for entities, queries, sessions
