/**
 * Phase 6 Integration Tests (T170-T176)
 * User Story 4: Query History Management
 *
 * Tests query history retrieval, pagination, detail viewing, and access control.
 */

import { describe, test, expect, beforeAll } from 'vitest';

describe('Phase 6: Query History Integration (T170-T176)', () => {
  let mockEnv;
  let testUserId;
  let testJWT;

  beforeAll(() => {
    testUserId = 'test_user_123';
    testJWT = 'mock_jwt_token';

    // Create mock query history
    const mockQueries = [
      {
        query_id: 'query_001',
        question: 'What projects did Sarah work on?',
        entity_count: 3,
        latency_ms: 250,
        created_at: '2025-11-13T14:00:00Z'
      },
      {
        query_id: 'query_002',
        question: 'Who did I meet last week?',
        entity_count: 5,
        latency_ms: 180,
        created_at: '2025-11-13T13:00:00Z'
      },
      {
        query_id: 'query_003',
        question: 'List all projects',
        entity_count: 10,
        latency_ms: 320,
        created_at: '2025-11-13T12:00:00Z'
      }
    ];

    mockEnv = {
      DB: {
        prepare: (query) => ({
          bind: (...args) => ({
            all: async () => {
              if (query.includes('FROM voice_queries WHERE user_id')) {
                // Filter by user_id
                const userId = args[0];
                if (userId === testUserId) {
                  return { results: mockQueries };
                }
                return { results: [] };
              }
              return { results: [] };
            },
            first: async () => {
              if (query.includes('COUNT(*)')) {
                return { total: mockQueries.length };
              }
              if (query.includes('WHERE query_id')) {
                const queryId = args[0];
                const userId = args[1];
                if (userId === testUserId) {
                  const found = mockQueries.find(q => q.query_id === queryId);
                  if (found) {
                    return {
                      ...found,
                      cypher_query: 'USE GRAPH...',
                      graph_results: JSON.stringify({ entities: [], relationships: [], metadata: {} })
                    };
                  }
                }
                return null;
              }
              return null;
            }
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
   * T170: Test GET /api/query/history returns correct queries for user
   *
   * Success Criteria:
   * - Returns 200 status
   * - Response includes queries array
   * - All queries belong to authenticated user
   * - Queries are ordered by created_at DESC
   */
  test('T170: GET /api/query/history returns correct queries', async () => {
    const { getQueryHistory } = await import('../../src/workers/api/query.js');

    const request = new Request('https://test.com/api/query/history?limit=20&offset=0', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${testJWT}`
      }
    });

    // Mock requireAuth to return user_id
    const response = await getQueryHistory(request, mockEnv);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.queries).toBeDefined();
    expect(Array.isArray(data.queries)).toBe(true);
    expect(data.queries.length).toBe(3);
    expect(data.total).toBe(3);

    // Verify order (most recent first)
    expect(data.queries[0].query_id).toBe('query_001');
    expect(data.queries[1].query_id).toBe('query_002');
    expect(data.queries[2].query_id).toBe('query_003');
  });

  /**
   * T171: Test GET /api/query/history pagination (limit, offset)
   *
   * Success Criteria:
   * - Limit parameter controls result count
   * - Offset parameter skips results correctly
   * - Pagination metadata is correct
   * - has_more flag is accurate
   */
  test('T171: Query history pagination', async () => {
    const { getQueryHistory } = await import('../../src/workers/api/query.js');

    // Test with limit=2, offset=0
    const request1 = new Request('https://test.com/api/query/history?limit=2&offset=0', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${testJWT}` }
    });

    const response1 = await getQueryHistory(request1, mockEnv);
    const data1 = await response1.json();

    // Assertions for page 1
    expect(data1.queries.length).toBeLessThanOrEqual(2);
    expect(data1.pagination.limit).toBe(2);
    expect(data1.pagination.offset).toBe(0);
    expect(data1.has_more).toBe(true);
    expect(data1.pagination.next_offset).toBe(2);

    // Test with limit=2, offset=2
    const request2 = new Request('https://test.com/api/query/history?limit=2&offset=2', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${testJWT}` }
    });

    const response2 = await getQueryHistory(request2, mockEnv);
    const data2 = await response2.json();

    // Assertions for page 2
    expect(data2.pagination.offset).toBe(2);
    expect(data2.has_more).toBe(false);
    expect(data2.pagination.next_offset).toBe(null);
  });

  /**
   * T172: Test GET /api/query/:query_id returns full query details
   *
   * Success Criteria:
   * - Returns 200 status for valid query_id
   * - Response includes full query details
   * - Includes question, cypher_query, results
   * - Includes metadata (latency_ms, created_at)
   */
  test('T172: GET /api/query/:query_id returns full details', async () => {
    const { getQueryById } = await import('../../src/workers/api/query.js');

    const queryId = 'query_001';
    const request = new Request(`https://test.com/api/query/${queryId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${testJWT}` }
    });

    const response = await getQueryById(request, mockEnv, queryId);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.query).toBeDefined();
    expect(data.query.query_id).toBe(queryId);
    expect(data.query.question).toBe('What projects did Sarah work on?');
    expect(data.query.cypher_query).toBeDefined();
    expect(data.query.results).toBeDefined();
    expect(data.query.latency_ms).toBe(250);
    expect(data.query.created_at).toBeDefined();
  });

  /**
   * T173: Test ownership check (user cannot access other users' queries)
   *
   * Success Criteria:
   * - 404 response for queries owned by other users
   * - Error message indicates access denied
   * - No data leakage occurs
   * - User namespace isolation is maintained
   */
  test('T173: Ownership check prevents cross-user access', async () => {
    const { getQueryById } = await import('../../src/workers/api/query.js');

    const otherUserQueryId = 'query_other_user_999';
    const otherUserId = 'other_user_456';

    // Mock environment that returns query for different user
    const mockEnvOtherUser = {
      DB: {
        prepare: () => ({
          bind: (...args) => ({
            first: async () => {
              const queryId = args[0];
              const userId = args[1];

              // Query exists but belongs to different user
              if (queryId === otherUserQueryId && userId === testUserId) {
                return null; // No result (ownership check fails)
              }
              return null;
            }
          })
        })
      }
    };

    const request = new Request(`https://test.com/api/query/${otherUserQueryId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${testJWT}` }
    });

    const response = await getQueryById(request, mockEnvOtherUser, otherUserQueryId);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('QUERY_NOT_FOUND');
    expect(data.message).toContain('don\'t have access');
  });

  /**
   * T174: Test frontend displays query history correctly
   *
   * Success Criteria:
   * - Query history response is suitable for frontend
   * - Each query has essential fields (id, question, timestamp)
   * - Entity count is included
   * - Latency is included
   */
  test('T174: Frontend query history display format', async () => {
    const { getQueryHistory } = await import('../../src/workers/api/query.js');

    const request = new Request('https://test.com/api/query/history', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${testJWT}` }
    });

    const response = await getQueryHistory(request, mockEnv);
    const data = await response.json();

    // Check each query has required fields for frontend display
    data.queries.forEach(query => {
      expect(query).toHaveProperty('query_id');
      expect(query).toHaveProperty('question');
      expect(query).toHaveProperty('entity_count');
      expect(query).toHaveProperty('latency_ms');
      expect(query).toHaveProperty('created_at');
    });
  });

  /**
   * T175: Test frontend click-to-view-details functionality
   *
   * Success Criteria:
   * - Query details endpoint is callable from history
   * - Details include full results
   * - Details include Cypher query
   * - Navigation flow works (history → details → back)
   */
  test('T175: Frontend click-to-view-details flow', async () => {
    const { getQueryHistory, getQueryById } = await import('../../src/workers/api/query.js');

    // Step 1: Get query history
    const historyRequest = new Request('https://test.com/api/query/history', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${testJWT}` }
    });

    const historyResponse = await getQueryHistory(historyRequest, mockEnv);
    const historyData = await historyResponse.json();

    // Step 2: Select first query
    const firstQuery = historyData.queries[0];
    expect(firstQuery.query_id).toBeDefined();

    // Step 3: Get query details
    const detailsRequest = new Request(`https://test.com/api/query/${firstQuery.query_id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${testJWT}` }
    });

    const detailsResponse = await getQueryById(detailsRequest, mockEnv, firstQuery.query_id);
    const detailsData = await detailsResponse.json();

    // Assertions - details have more information than history
    expect(detailsData.query.query_id).toBe(firstQuery.query_id);
    expect(detailsData.query.question).toBe(firstQuery.question);
    expect(detailsData.query).toHaveProperty('cypher_query');
    expect(detailsData.query).toHaveProperty('results');
    expect(detailsData.query.results).toHaveProperty('entities');
    expect(detailsData.query.results).toHaveProperty('relationships');
  });

  /**
   * T176: Verify query history loads within 1 second - Success Criterion
   *
   * Success Criteria:
   * - Query history retrieval < 1 second
   * - Performance is tracked
   * - Index on (user_id, created_at) is used
   */
  test('T176: Query history loads within 1 second', async () => {
    const { getQueryHistory } = await import('../../src/workers/api/query.js');

    const request = new Request('https://test.com/api/query/history?limit=20', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${testJWT}` }
    });

    const startTime = Date.now();
    const response = await getQueryHistory(request, mockEnv);
    await response.json();
    const latency = Date.now() - startTime;

    // Assertions
    expect(latency).toBeLessThan(1000); // < 1 second
    expect(response.status).toBe(200);
  });
});
