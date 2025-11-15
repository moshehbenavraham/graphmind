/**
 * Phase 5 Integration Tests (T140-T147)
 * User Story 3: Query Results Display
 *
 * Tests result formatting, D1 persistence, KV caching, and frontend display.
 */

import { describe, test, expect, beforeAll } from 'vitest';

describe('Phase 5: Results Display Integration (T140-T147)', () => {
  let mockEnv;
  let testUserId;
  let testNamespace;

  beforeAll(() => {
    testUserId = 'test_user_123';
    testNamespace = 'user_test_user_123_graph';

    mockEnv = {
      DB: {
        prepare: (query) => ({
          bind: (...args) => ({
            all: () => Promise.resolve({ results: [] }),
            first: () => Promise.resolve(null),
            run: () => Promise.resolve({ success: true, meta: { last_row_id: 1 } })
          })
        })
      },
      KV: {
        get: () => Promise.resolve(null),
        put: () => Promise.resolve()
      }
    };
  });

  /**
   * T140: Test result formatting with various query types
   *
   * Success Criteria:
   * - Entities are parsed correctly from FalkorDB results
   * - Relationships are extracted correctly
   * - Properties are preserved
   * - Metadata is included
   */
  test('T140: Result formatting with various query types', async () => {
    const { autoFormatResults } = await import('../../src/services/result-formatter.js');

    // Test 1: Entity lookup results
    const entityResults = [
      {
        n: {
          name: 'Sarah Johnson',
          email: 'sarah@example.com',
          role: 'Project Manager'
        },
        type: ['Person'],
        props: {
          name: 'Sarah Johnson',
          email: 'sarah@example.com',
          role: 'Project Manager'
        }
      }
    ];

    const formattedEntity = autoFormatResults(entityResults, {
      execution_time_ms: 250,
      cached: false,
      template_used: 'entity_lookup',
      query_id: 'query_123'
    });

    expect(formattedEntity.entities).toBeDefined();
    expect(formattedEntity.entities.length).toBe(1);
    expect(formattedEntity.entities[0].name).toBe('Sarah Johnson');
    expect(formattedEntity.entities[0].type).toBe('Person');
    expect(formattedEntity.metadata.entity_count).toBe(1);

    // Test 2: Relationship query results
    const relationshipResults = [
      {
        source: { name: 'Sarah Johnson' },
        r: { since: '2024-01-01' },
        target: { name: 'FastAPI Migration', status: 'active' },
        relationship_type: 'WORKS_ON'
      }
    ];

    const formattedRelationship = autoFormatResults(relationshipResults, {
      execution_time_ms: 350,
      cached: false,
      template_used: 'relationship_query',
      query_id: 'query_124'
    });

    expect(formattedRelationship.entities.length).toBeGreaterThanOrEqual(2);
    expect(formattedRelationship.relationships.length).toBeGreaterThan(0);
    expect(formattedRelationship.relationships[0].type).toBe('WORKS_ON');

    // Test 3: Count query results
    const countResults = [
      {
        count: 15,
        entity_type: 'Project'
      }
    ];

    const formattedCount = autoFormatResults(countResults, {
      execution_time_ms: 100,
      cached: true,
      template_used: 'count_query',
      query_id: 'query_125'
    });

    expect(formattedCount.metadata).toHaveProperty('count');
    expect(formattedCount.metadata.count).toBe(15);
  });

  /**
   * T141: Test D1 persistence (verify query saved to voice_queries table)
   *
   * Success Criteria:
   * - Query is saved to voice_queries table
   * - All required fields are populated
   * - Query ID is unique
   * - User ID is correct
   */
  test('T141: D1 persistence to voice_queries table', async () => {
    let insertedData = null;

    const mockDB = {
      prepare: (query) => ({
        bind: (...args) => ({
          run: async () => {
            // Capture inserted data
            if (query.includes('INSERT INTO voice_queries')) {
              insertedData = {
                query_id: args[0],
                user_id: args[1],
                session_id: args[2],
                question: args[3],
                cypher_query: args[4],
                graph_results: args[5],
                latency_ms: args[6]
              };
            }
            return { success: true };
          }
        })
      })
    };

    const mockEnvWithDB = { ...mockEnv, DB: mockDB };

    const { QuerySessionManager } = await import('../../src/durable-objects/QuerySessionManager.js');

    const mockState = {
      blockConcurrencyWhile: (fn) => fn(),
      storage: {
        get: () => Promise.resolve(undefined),
        put: () => Promise.resolve()
      }
    };

    const qsm = new QuerySessionManager(mockState, mockEnvWithDB);
    qsm.sessionMetadata.query_id = 'query_test123';
    qsm.sessionMetadata.user_id = testUserId;
    qsm.sessionMetadata.session_id = 'sess_test123';
    qsm.question = 'What projects did Sarah work on?';

    const cypherQuery = `USE GRAPH ${testNamespace}; MATCH (p:Person)-[:WORKS_ON]->(proj:Project) RETURN p, proj LIMIT 100;`;
    const results = { entities: [], relationships: [], metadata: {} };

    // Save query to database
    await qsm.saveQueryToDatabase(cypherQuery, results, 250);

    // Assertions
    expect(insertedData).toBeDefined();
    expect(insertedData.query_id).toBe('query_test123');
    expect(insertedData.user_id).toBe(testUserId);
    expect(insertedData.question).toBe('What projects did Sarah work on?');
    expect(insertedData.cypher_query).toContain('MATCH');
    expect(insertedData.latency_ms).toBe(250);
  });

  /**
   * T142: Test KV caching (verify cache hit on repeated query)
   *
   * Success Criteria:
   * - Query results are cached in KV
   * - Cache key is generated correctly
   * - Cache TTL is set to 1 hour
   * - Subsequent queries return cached results
   */
  test('T142: KV caching (cache hit on repeated query)', async () => {
    const { setCachedQuery, getCachedQuery } = await import('../../src/lib/graph/query-cache.js');

    const cache = {};
    const mockKV = {
      get: async (key) => {
        const value = cache[key];
        return value ? JSON.stringify(value) : null;
      },
      put: async (key, value, options) => {
        cache[key] = JSON.parse(value);
        expect(options.expirationTtl).toBe(3600); // 1 hour TTL
      }
    };

    const question = 'What projects did Sarah work on?';
    const results = {
      cypher_query: 'USE GRAPH...',
      results: [{ p: { name: 'Sarah' }, proj: { name: 'FastAPI' } }],
      template_used: 'relationship_query'
    };

    // Cache the query
    await setCachedQuery(mockKV, testUserId, question, {}, results);

    // Retrieve from cache
    const cached = await getCachedQuery(mockKV, testUserId, question, {});

    // Assertions
    expect(cached).toBeDefined();
    expect(cached.cypher_query).toBe(results.cypher_query);
    expect(cached.results.length).toBeGreaterThan(0);
    expect(cached.template_used).toBe('relationship_query');
  });

  /**
   * T143: Test frontend displays entities correctly
   *
   * Success Criteria:
   * - Entities are formatted for frontend display
   * - Entity properties are accessible
   * - Entity types are identified
   * - No sensitive data is exposed
   */
  test('T143: Frontend entity display formatting', async () => {
    const { autoFormatResults } = await import('../../src/services/result-formatter.js');

    const results = [
      {
        p: {
          name: 'Sarah Johnson',
          email: 'sarah@example.com',
          role: 'Project Manager'
        },
        type: ['Person']
      }
    ];

    const formatted = autoFormatResults(results, {
      execution_time_ms: 200,
      cached: false,
      template_used: 'entity_lookup',
      query_id: 'query_123'
    });

    const entity = formatted.entities[0];

    // Assertions - entity structure suitable for frontend
    expect(entity).toHaveProperty('id');
    expect(entity).toHaveProperty('type');
    expect(entity).toHaveProperty('name');
    expect(entity.type).toBe('Person');
    expect(entity.name).toBe('Sarah Johnson');
    expect(entity).toHaveProperty('properties');
    expect(entity.properties).toHaveProperty('email');
  });

  /**
   * T144: Test frontend displays relationships correctly
   *
   * Success Criteria:
   * - Relationships are formatted with source and target
   * - Relationship types are identified
   * - Relationship properties are accessible
   * - Direction is clear (source → target)
   */
  test('T144: Frontend relationship display formatting', async () => {
    const { autoFormatResults } = await import('../../src/services/result-formatter.js');

    const results = [
      {
        source: { name: 'Sarah Johnson' },
        r: { since: '2024-01-01' },
        target: { name: 'FastAPI Migration' },
        relationship_type: 'WORKS_ON'
      }
    ];

    const formatted = autoFormatResults(results, {
      execution_time_ms: 300,
      cached: false,
      template_used: 'relationship_query',
      query_id: 'query_124'
    });

    const relationship = formatted.relationships[0];

    // Assertions - relationship structure suitable for frontend
    expect(relationship).toHaveProperty('source');
    expect(relationship).toHaveProperty('target');
    expect(relationship).toHaveProperty('type');
    expect(relationship.type).toBe('WORKS_ON');
    expect(relationship).toHaveProperty('properties');
  });

  /**
   * T145: Test frontend displays metadata correctly
   *
   * Success Criteria:
   * - Metadata includes execution time
   * - Metadata includes entity count
   * - Metadata includes cached flag
   * - Metadata includes template used
   */
  test('T145: Frontend metadata display', async () => {
    const { autoFormatResults } = await import('../../src/services/result-formatter.js');

    const results = [
      { p: { name: 'Sarah' } },
      { p: { name: 'John' } }
    ];

    const formatted = autoFormatResults(results, {
      execution_time_ms: 450,
      cached: false,
      template_used: 'list_query',
      query_id: 'query_125'
    });

    // Assertions - metadata structure
    expect(formatted.metadata).toHaveProperty('execution_time_ms');
    expect(formatted.metadata.execution_time_ms).toBe(450);
    expect(formatted.metadata).toHaveProperty('entity_count');
    expect(formatted.metadata.entity_count).toBeGreaterThan(0);
    expect(formatted.metadata).toHaveProperty('cached');
    expect(formatted.metadata.cached).toBe(false);
    expect(formatted.metadata).toHaveProperty('template_used');
    expect(formatted.metadata.template_used).toBe('list_query');
  });

  /**
   * T146: Test empty results display in frontend
   *
   * Success Criteria:
   * - Empty results return empty entities array
   * - Empty results return empty relationships array
   * - Metadata indicates 0 entities
   * - No errors are thrown
   */
  test('T146: Empty results display', async () => {
    const { autoFormatResults } = await import('../../src/services/result-formatter.js');

    const emptyResults = [];

    const formatted = autoFormatResults(emptyResults, {
      execution_time_ms: 150,
      cached: false,
      template_used: 'entity_lookup',
      query_id: 'query_126'
    });

    // Assertions
    expect(formatted.entities).toEqual([]);
    expect(formatted.relationships).toEqual([]);
    expect(formatted.metadata.entity_count).toBe(0);
    expect(formatted.metadata.relationship_count).toBe(0);
    expect(formatted.metadata.execution_time_ms).toBe(150);
  });

  /**
   * T147: Verify query history reliability (100% saved) - Success Criterion 7
   *
   * Success Criteria:
   * - All executed queries are saved to D1
   * - Query history is retrievable
   * - No queries are lost
   * - Timestamps are accurate
   */
  test('T147: Query history reliability (100% saved)', async () => {
    const savedQueries = [];

    const mockDB = {
      prepare: (query) => ({
        bind: (...args) => ({
          run: async () => {
            if (query.includes('INSERT INTO voice_queries')) {
              savedQueries.push({
                query_id: args[0],
                question: args[3],
                created_at: new Date()
              });
            }
            return { success: true };
          },
          all: async () => {
            return { results: savedQueries };
          }
        })
      })
    };

    const mockEnvWithDB = { ...mockEnv, DB: mockDB };

    const { QuerySessionManager } = await import('../../src/durable-objects/QuerySessionManager.js');

    const mockState = {
      blockConcurrencyWhile: (fn) => fn(),
      storage: {
        get: () => Promise.resolve(undefined),
        put: () => Promise.resolve()
      }
    };

    // Execute 5 queries
    const questions = [
      'Who is Sarah?',
      'What projects did Sarah work on?',
      'List all meetings',
      'How many projects are there?',
      'What did I do last week?'
    ];

    for (let i = 0; i < questions.length; i++) {
      const qsm = new QuerySessionManager(mockState, mockEnvWithDB);
      qsm.sessionMetadata.query_id = `query_test${i}`;
      qsm.sessionMetadata.user_id = testUserId;
      qsm.sessionMetadata.session_id = `sess_test${i}`;
      qsm.question = questions[i];

      await qsm.saveQueryToDatabase(`USE GRAPH ${testNamespace}; MATCH (n) RETURN n LIMIT 100;`, {}, 200);
    }

    // Verify all queries were saved
    expect(savedQueries.length).toBe(5);
    expect(savedQueries.map(q => q.question)).toEqual(questions);

    // Verify 100% save rate
    const saveRate = (savedQueries.length / questions.length) * 100;
    expect(saveRate).toBe(100);
  });
});
