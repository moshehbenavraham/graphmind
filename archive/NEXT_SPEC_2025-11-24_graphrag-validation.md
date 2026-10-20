# Next Spec: GraphRAG 2.0 - Vector Search Validation & Production Deployment

**Phase**: Phase 3 - Voice Query (Completion & Validation)
**Priority**: P1 (Next to Build)
**Estimated Context**: ~15,000 tokens
**Dependencies**:
- ✅ Vector infrastructure implemented (EmbeddingService, indexes, backfill endpoint)
- ✅ Query logic implemented (queryNodesByVector, executeGraphRAG pipeline)
- ✅ Configuration complete (REST API port, API key auth, environment variables)
**Status**: Ready to Implement

---

## What We're Building

This spec covers the validation, testing, and production deployment of the GraphRAG 2.0 vector-native architecture. We're completing the remaining 4 tasks from `docs/architecture/graph-rag-2.0.md` to ensure the vector search system works end-to-end in production.

## Why This Next

The vector infrastructure is 85% complete - all components are implemented but **not yet validated**. This is the logical next step because:

- **Dependency on**: Vector infrastructure (EmbeddingService, indexes, traversal) - all implemented
- **Enables**: True semantic search for voice queries ("Who works on AI?" finds GraphMind project)
- **Phase requirement**: Phase 3 completion requires validated GraphRAG pipeline
- **Current blocker**: Without validation, we can't verify that vector search actually improves query accuracy

**From graph-rag-2.0.md Section 5 (Remaining Tasks)**:
1. Verify Backfill Process - Test embedding generation for existing nodes
2. End-to-End Testing - Test vector search with sample queries, verify graph traversal
3. Performance Validation - Measure latency for vector search + traversal
4. Production Deployment - Set secrets, re-enable authentication, deploy Workers

---

## Scope (Single Context Window)

**Included**:
- Backfill process validation (test embedding generation for all 4 node types)
- End-to-end vector search testing (10+ sample queries)
- Graph traversal verification (ensure context retrieval works)
- Performance benchmarking (measure vector search + traversal latency)
- Production deployment preparation (secrets, authentication, deployment)
- Integration with existing QuerySessionManager flow

**Explicitly Excluded** (for later specs):
- Frontend UI for vector search results
- Advanced vector search features (hybrid search, re-ranking)
- Multi-model embedding support
- Vector index tuning and optimization

**Estimated Tokens**: ~15,000 tokens

---

## User Stories (for this spec)

### Story 1: Validate Vector Search Accuracy (P1)
As a developer, I need to validate that vector search returns semantically relevant nodes so that users get accurate answers to natural language questions.

**Acceptance Criteria**:
- [ ] Backfill endpoint generates embeddings for all existing nodes without errors
- [ ] Vector search query "Who works on AI?" returns relevant Project nodes with score ≥ 0.65
- [ ] Graph traversal from vector matches returns connected Person/Meeting/Topic nodes
- [ ] End-to-end test suite covers 10+ semantic query scenarios
- [ ] All vector indexes are queryable (Person, Project, Note, Topic)

### Story 2: Performance Validation (P1)
As a product owner, I need to measure vector search performance so that we can confirm it meets our latency targets (<500ms uncached).

**Acceptance Criteria**:
- [ ] Vector search latency measured for cold queries (<500ms target)
- [ ] Graph traversal latency measured (should be <100ms with indexes)
- [ ] End-to-end GraphRAG pipeline latency documented
- [ ] Performance comparison vs. old text-to-Cypher approach
- [ ] Load test with 100+ concurrent vector searches

### Story 3: Production Deployment (P1)
As a DevOps engineer, I need to deploy the GraphRAG 2.0 system to production so that users can benefit from semantic search.

**Acceptance Criteria**:
- [ ] `FALKORDB_REST_API_KEY` set via `npx wrangler secret put`
- [ ] Authentication re-enabled for backfill endpoint
- [ ] Updated Workers deployed with vector search code
- [ ] Smoke tests pass in production environment
- [ ] Rollback plan documented in case of issues

---

## Technical Approach

This spec focuses on **validation and deployment** of the existing GraphRAG 2.0 implementation. The architecture follows the pipeline defined in `docs/architecture/graph-rag-2.0.md`:

```
User Query → Embedding Generation (Workers AI)
           ↓
     Vector Search (FalkorDB)
     [Person, Project, Note, Topic indexes]
           ↓
     Top 10 Semantic Matches (score ≥ 0.65)
           ↓
     Graph Traversal (1-hop from entry points)
           ↓
     Context Aggregation (vector results + neighbors)
           ↓
     Answer Generation (Llama 3.1-8b with context)
```

### Cloudflare Components
- **Workers AI**: `@cf/baai/bge-base-en-v1.5` (embedding model)
- **Workers**: Backfill endpoint, QuerySessionManager integration
- **D1**: Store embeddings metadata (optional)
- **KV**: Cache vector search results (1-hour TTL)

### FalkorDB Integration
- **Vector Indexes**: 4 indexes (Person, Project, Note, Topic) with dimension=768, similarity=cosine
- **Vector Search**: `CALL db.idx.vector.queryNodes()` procedure
- **Graph Traversal**: Cypher queries to expand context from entry points
- **REST API**: Port 3001 with API key authentication

### Testing Strategy
1. **Unit Tests**: Test EmbeddingService, queryNodesByVector wrapper
2. **Integration Tests**: Test backfill process, vector search with real FalkorDB
3. **End-to-End Tests**: Test full GraphRAG pipeline (query → embedding → search → traversal → answer)
4. **Performance Tests**: Benchmark vector search latency, load testing
5. **Production Smoke Tests**: Verify deployment in production environment

---

## Implementation Steps

### 1. Backfill Validation
- Create test script to call `/api/admin/backfill-embeddings` endpoint
- Verify embeddings are generated for all node types (Person, Project, Note, Topic)
- Check FalkorDB for embedding properties on nodes
- Validate embedding dimensions (should be 768)

### 2. Vector Search Testing
- Write test queries that require semantic understanding:
  - "Who works on artificial intelligence?" (should find AI projects)
  - "Tell me about machine learning" (should find ML-related nodes)
  - "What meetings discussed data science?" (should find relevant meetings)
- Verify vector search returns results with scores ≥ 0.65
- Test all 4 node type indexes

### 3. Graph Traversal Testing
- Take top vector search results as entry points
- Execute traversal queries to find connected nodes
- Verify connected nodes are relevant (e.g., Person nodes connected to Project nodes)
- Test 1-hop and 2-hop traversal

### 4. End-to-End Pipeline Testing
- Integrate vector search into QuerySessionManager flow
- Test full pipeline: user question → embedding → vector search → traversal → answer
- Compare answer quality vs. old text-to-Cypher approach
- Validate context aggregation (vector matches + graph neighbors)

### 5. Performance Benchmarking
- Measure vector search latency (cold queries)
- Measure graph traversal latency
- Measure end-to-end pipeline latency
- Run load tests with 100+ concurrent searches
- Document performance improvements

### 6. Production Deployment
- Set `FALKORDB_REST_API_KEY` secret in Cloudflare
- Re-enable authentication for backfill endpoint
- Deploy updated Workers with vector search code
- Run production smoke tests
- Monitor for errors and performance issues

---

## Success Criteria

This spec is complete when:

- [ ] Backfill process successfully generates embeddings for 100% of existing nodes
- [ ] Vector search returns semantically relevant results (verified with 10+ test queries)
- [ ] Graph traversal retrieves connected context from vector entry points
- [ ] End-to-end GraphRAG pipeline latency is <500ms (uncached)
- [ ] Performance benchmarks show improvement over old text-to-Cypher approach
- [ ] Production deployment succeeds with all smoke tests passing
- [ ] Documentation updated with vector search usage examples
- [ ] Rollback plan documented and tested

---

## Next After This

Once this spec is complete, the next logical steps will be:
1. **Feature 011 Completion**: Resume frontend deployment (currently blocked by entity resolution bug)
2. **Phase 4 Features**: Multi-source ingestion, UI polish, advanced search
3. **Vector Search Enhancements**: Hybrid search (vector + keyword), re-ranking, multi-model embeddings

---

## References

- **Architecture Doc**: [docs/architecture/graph-rag-2.0.md](/home/aiwithapex/projects/graphmind/docs/architecture/graph-rag-2.0.md)
- **PRD Phase 3**: [docs/PRD/phases/phase-3-voice-query.md](/home/aiwithapex/projects/graphmind/docs/PRD/phases/phase-3-voice-query.md)
- **Implementation Report**: [docs/PRD/IMPLEMENTATION_REPORT.md](/home/aiwithapex/projects/graphmind/docs/PRD/IMPLEMENTATION_REPORT.md)
- **Security Audit**: [docs/graph-query-audit.md](/home/aiwithapex/projects/graphmind/docs/graph-query-audit.md)
- **FalkorDB Vector Search Docs**: https://docs.falkordb.com/vector-search.html

---

## Technical Notes

### Existing Implementation Files
- `src/services/embedding.js` - EmbeddingService class (158 lines)
- `src/workers/api/admin/backfill-embeddings.js` - Backfill endpoint (122 lines)
- `src/lib/falkordb/client.js` - queryNodesByVector() wrapper (32 lines)
- `src/durable-objects/QuerySessionManager.js` - executeGraphRAG() pipeline (84 lines)
- `src/lib/graph/cypher-templates.js` - traversalQueryTemplate() (15 lines)
- `scripts/vector-index.js` - Vector index creation script (91 lines)

### Key Configuration
- **Embedding Model**: `@cf/baai/bge-base-en-v1.5` (768 dimensions)
- **Vector Indexes**: Person.embedding, Project.embedding, Note.embedding, Topic.embedding
- **Similarity Function**: Cosine similarity
- **Threshold**: 0.65 (scores below this are filtered out)
- **Limit**: Top 10 results per node type (40 total across 4 types)

### Known Issues (From graph-rag-2.0.md)
- ✅ Port configuration fixed (6380 → 3001)
- ✅ API key authentication added
- ✅ FalkorDBConnectionPool preserves apiKey in config
- 🔲 Backfill endpoint authentication needs re-enabling for production
- 🔲 Performance benchmarks pending (expected 250x improvement)
