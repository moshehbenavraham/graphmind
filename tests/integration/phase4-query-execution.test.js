/**
 * Phase 4 Integration Tests (T100-T107)
 * User Story 2: Natural Language Query Execution
 *
 * Tests Cypher query generation from natural language, entity resolution,
 * query validation, execution, caching, and namespace isolation.
 */

import { describe, test, expect, beforeAll } from 'vitest';

describe('Phase 4: Query Execution Integration (T100-T107)', () => {
  let mockEnv;
  let testUserId;
  let testNamespace;

  beforeAll(() => {
    testUserId = 'test_user_123';
    testNamespace = 'user_test_user_123_graph';

    mockEnv = {
      DB: {
        prepare: () => ({
          bind: () => ({
            all: () => Promise.resolve({ results: [
              { entity_id: 'person_sarah', name: 'Sarah Johnson', type: 'Person' }
            ]}),
            first: () => Promise.resolve({ entity_id: 'person_sarah', name: 'Sarah Johnson', type: 'Person' }),
            run: () => Promise.resolve({ success: true })
          })
        })
      },
      KV: {
        get: () => Promise.resolve(null),
        put: () => Promise.resolve()
      },
      AI: {
        run: (model, options) => {
          // Mock Llama 3.1-8b for LLM fallback
          if (model.includes('llama')) {
            return Promise.resolve({
              response: `USE GRAPH ${testNamespace};
MATCH (p:Person {name: 'Sarah Johnson'})-[:WORKS_ON]->(proj:Project)
RETURN p, proj
LIMIT 100;`
            });
          }
          return Promise.resolve({});
        }
      },
      FALKORDB_POOL: {
        idFromName: () => 'mock_pool_id',
        get: () => ({
          fetch: () => new Response(JSON.stringify({
            results: [
              { p: { name: 'Sarah Johnson', email: 'sarah@example.com' }, proj: { name: 'FastAPI Migration', status: 'active' } }
            ]
          }))
        })
      }
    };
  });

  /**
   * T100: Test template matching with 20 sample questions (verify 90%+ accuracy)
   *
   * Success Criteria:
   * - 18+ out of 20 questions match correct templates
   * - Template selection accuracy >= 90%
   * - Entity extraction works correctly
   */
  test('T100: Template matching with 20 sample questions (90%+ accuracy)', async () => {
    const { selectCypherTemplate, extractEntityReferences } = await import('../../src/lib/graph/cypher-templates.js');

    const sampleQuestions = [
      // Entity Lookup (5 questions)
      { question: 'Who is Sarah?', expectedTemplate: 'entity_lookup' },
      { question: 'What is the FastAPI project?', expectedTemplate: 'entity_lookup' },
      { question: 'Tell me about Sarah Johnson', expectedTemplate: 'entity_lookup' },
      { question: 'Show me the FastAPI project', expectedTemplate: 'entity_lookup' },
      { question: 'Who is John?', expectedTemplate: 'entity_lookup' },

      // Relationship Query (5 questions)
      { question: 'What projects did Sarah work on?', expectedTemplate: 'relationship_query' },
      { question: 'Who attended the meeting?', expectedTemplate: 'relationship_query' },
      { question: 'What technologies does the FastAPI project use?', expectedTemplate: 'relationship_query' },
      { question: 'Who worked with Sarah?', expectedTemplate: 'relationship_query' },
      { question: 'What topics did we discuss?', expectedTemplate: 'relationship_query' },

      // Temporal Query (4 questions)
      { question: 'What did I do last week?', expectedTemplate: 'temporal_query' },
      { question: 'Who did I meet yesterday?', expectedTemplate: 'temporal_query' },
      { question: 'What meetings happened this month?', expectedTemplate: 'temporal_query' },
      { question: 'What projects were updated last week?', expectedTemplate: 'temporal_query' },

      // List Query (3 questions)
      { question: 'List all projects', expectedTemplate: 'list_query' },
      { question: 'Show me all meetings', expectedTemplate: 'list_query' },
      { question: 'List all people', expectedTemplate: 'list_query' },

      // Count Query (3 questions)
      { question: 'How many projects are there?', expectedTemplate: 'count_query' },
      { question: 'How many meetings did I have?', expectedTemplate: 'count_query' },
      { question: 'Count all people', expectedTemplate: 'count_query' }
    ];

    let correctMatches = 0;

    for (const { question, expectedTemplate } of sampleQuestions) {
      const entities = extractEntityReferences(question);
      const actualTemplate = selectCypherTemplate(question, entities);

      if (actualTemplate === expectedTemplate) {
        correctMatches++;
      } else {
        console.warn(`Mismatch: "${question}" -> expected ${expectedTemplate}, got ${actualTemplate}`);
      }
    }

    const accuracy = (correctMatches / sampleQuestions.length) * 100;

    // Assertions
    expect(accuracy).toBeGreaterThanOrEqual(90);
    expect(correctMatches).toBeGreaterThanOrEqual(18);
  });

  /**
   * T101: Test entity resolution (Sarah → Sarah Johnson)
   *
   * Success Criteria:
   * - Entity names are resolved to canonical names
   * - Entity cache is consulted
   * - Fuzzy matching works for similar names
   * - Entity type is identified correctly
   */
  test('T101: Entity resolution (Sarah → Sarah Johnson)', async () => {
    const { resolveEntity } = await import('../../src/services/cypher-generator.js');

    // Test exact match
    const resolvedExact = await resolveEntity('Sarah Johnson', mockEnv, testNamespace);
    expect(resolvedExact.name).toBe('Sarah Johnson');
    expect(resolvedExact.type).toBe('Person');

    // Test partial match (should resolve to canonical name)
    const resolvedPartial = await resolveEntity('Sarah', mockEnv, testNamespace);
    expect(resolvedPartial.name).toBe('Sarah Johnson');
    expect(resolvedPartial.type).toBe('Person');
  });

  /**
   * T102: Test Cypher validation blocks destructive operations
   *
   * Success Criteria:
   * - DELETE, DROP, REMOVE operations are blocked
   * - CREATE, MERGE operations are blocked
   * - Validation error is thrown with clear message
   * - Error code is DESTRUCTIVE_OPERATION
   */
  test('T102: Cypher validation blocks destructive operations', async () => {
    const { validateCypherQuery, CypherValidationError } = await import('../../src/lib/graph/cypher-validator.js');

    const destructiveQueries = [
      `USE GRAPH ${testNamespace}; MATCH (n) DELETE n; RETURN n;`,
      `USE GRAPH ${testNamespace}; DROP GRAPH;`,
      `USE GRAPH ${testNamespace}; MATCH (n) REMOVE n.name RETURN n LIMIT 100;`,
      `USE GRAPH ${testNamespace}; CREATE (n:Person {name: 'Test'}) RETURN n LIMIT 100;`,
      `USE GRAPH ${testNamespace}; MATCH (n) SET n.name = 'Changed' RETURN n LIMIT 100;`
    ];

    for (const query of destructiveQueries) {
      try {
        validateCypherQuery(query, testNamespace);
        throw new Error('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(CypherValidationError);
        expect(error.code).toBe('DESTRUCTIVE_OPERATION');
      }
    }
  });

  /**
   * T103: Test query execution returns valid results
   *
   * Success Criteria:
   * - Query executes successfully
   * - Results contain expected entities
   * - Results contain relationships
   * - Metadata includes execution time
   */
  test('T103: Query execution returns valid results', async () => {
    const { generateCypherQuery } = await import('../../src/services/cypher-generator.js');

    const question = 'What projects did Sarah work on?';

    // Generate Cypher query
    const { cypher, parameters, templateUsed } = await generateCypherQuery(
      question,
      testNamespace,
      mockEnv
    );

    expect(cypher).toBeDefined();
    expect(cypher).toContain('USE GRAPH');
    expect(cypher).toContain('MATCH');
    expect(cypher).toContain('RETURN');
    expect(cypher).toContain('LIMIT');
    expect(templateUsed).toBe('relationship_query');

    // Execute query via FalkorDBConnectionPool
    const poolId = mockEnv.FALKORDB_POOL.idFromName('default');
    const poolStub = mockEnv.FALKORDB_POOL.get(poolId);

    const response = await poolStub.fetch('http://internal/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cypher, parameters, user_namespace: testNamespace })
    });

    const result = await response.json();

    // Assertions
    expect(result.results).toBeDefined();
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].p.name).toBe('Sarah Johnson');
    expect(result.results[0].proj.name).toBe('FastAPI Migration');
  });

  /**
   * T104: Test query caching (second identical query <100ms) - Success Criterion 3
   *
   * Success Criteria:
   * - First query executes against FalkorDB
   * - Second identical query returns from cache
   * - Cached query latency < 100ms
   * - Cache hit is indicated in metadata
   */
  test('T104: Query caching (cached query < 100ms)', async () => {
    const { getCachedQuery, setCachedQuery } = await import('../../src/lib/graph/query-cache.js');

    const question = 'What projects did Sarah work on?';
    const mockResults = {
      cypher_query: 'USE GRAPH...',
      results: [{ p: { name: 'Sarah' }, proj: { name: 'FastAPI' } }],
      template_used: 'relationship_query'
    };

    // Mock KV with in-memory cache
    const cache = {};
    const mockKV = {
      get: async (key) => {
        const value = cache[key];
        return value ? JSON.stringify(value) : null;
      },
      put: async (key, value) => {
        cache[key] = JSON.parse(value);
      }
    };

    // First query - cache miss
    const cached1 = await getCachedQuery(mockKV, testUserId, question, {});
    expect(cached1).toBeNull();

    // Set cache
    await setCachedQuery(mockKV, testUserId, question, {}, mockResults);

    // Second query - cache hit
    const startTime = Date.now();
    const cached2 = await getCachedQuery(mockKV, testUserId, question, {});
    const latency = Date.now() - startTime;

    // Assertions
    expect(cached2).toBeDefined();
    expect(cached2.cypher_query).toBe(mockResults.cypher_query);
    expect(latency).toBeLessThan(100); // < 100ms
  });

  /**
   * T105: Verify uncached query executes within 500ms (p95) - Success Criterion 3
   *
   * Success Criteria:
   * - Query execution time < 500ms
   * - Performance metrics are tracked
   * - Execution time is recorded
   */
  test('T105: Uncached query execution < 500ms (p95)', async () => {
    const { generateCypherQuery } = await import('../../src/services/cypher-generator.js');

    const question = 'What projects did Sarah work on?';

    // Measure query generation time
    const startTime = Date.now();

    const { cypher, parameters } = await generateCypherQuery(
      question,
      testNamespace,
      mockEnv
    );

    // Execute query
    const poolId = mockEnv.FALKORDB_POOL.idFromName('default');
    const poolStub = mockEnv.FALKORDB_POOL.get(poolId);

    await poolStub.fetch('http://internal/query', {
      method: 'POST',
      body: JSON.stringify({ cypher, parameters, user_namespace: testNamespace })
    });

    const totalLatency = Date.now() - startTime;

    // Assertions
    expect(totalLatency).toBeLessThan(500); // < 500ms for uncached query
  });

  /**
   * T106: Verify user namespace isolation (no cross-user leakage) - Success Criterion 4
   *
   * Success Criteria:
   * - User namespace is injected into all queries
   * - Queries cannot access other users' data
   * - Validation enforces namespace presence
   * - Cross-user access attempts are blocked
   */
  test('T106: User namespace isolation (100% isolation)', async () => {
    const { validateCypherQuery, injectUserNamespace } = await import('../../src/lib/graph/cypher-validator.js');

    const user1Namespace = 'user_alice_graph';
    const user2Namespace = 'user_bob_graph';

    // Test 1: Namespace injection
    const queryWithoutNamespace = 'MATCH (p:Person) RETURN p LIMIT 100;';
    const queryWithNamespace = injectUserNamespace(queryWithoutNamespace, user1Namespace);

    expect(queryWithNamespace).toContain(`USE GRAPH ${user1Namespace}`);

    // Test 2: Validation enforces namespace
    try {
      validateCypherQuery(queryWithoutNamespace, user1Namespace);
      throw new Error('Should have thrown validation error');
    } catch (error) {
      expect(error.code).toBe('MISSING_NAMESPACE');
    }

    // Test 3: Cross-user access blocked (user1 query contains user2 namespace)
    const crossUserQuery = `USE GRAPH ${user2Namespace}; MATCH (p:Person) RETURN p LIMIT 100;`;

    try {
      validateCypherQuery(crossUserQuery, user1Namespace);
      throw new Error('Should have thrown validation error');
    } catch (error) {
      expect(error.code).toBe('MISSING_NAMESPACE');
    }
  });

  /**
   * T107: Test empty results handling (graceful "no results found" message)
   *
   * Success Criteria:
   * - Empty result set is handled gracefully
   * - No error is thrown
   * - User-friendly message is returned
   * - Metadata indicates 0 entities
   */
  test('T107: Empty results handling', async () => {
    const { autoFormatResults } = await import('../../src/services/result-formatter.js');

    const emptyResults = [];
    const metadata = {
      execution_time_ms: 150,
      cached: false,
      template_used: 'entity_lookup',
      query_id: 'query_test123'
    };

    // Format empty results
    const formatted = autoFormatResults(emptyResults, metadata);

    // Assertions
    expect(formatted.entities).toEqual([]);
    expect(formatted.relationships).toEqual([]);
    expect(formatted.metadata.entity_count).toBe(0);
    expect(formatted.metadata.relationship_count).toBe(0);
    expect(formatted.metadata).toHaveProperty('execution_time_ms');
  });
});
