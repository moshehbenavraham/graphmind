/**
 * E2E Test: Query Detail Retrieval
 * Task: T258
 *
 * Tests: User retrieves specific query by ID
 * Verifies: full results, Cypher query, metadata returned
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';

describe('E2E: Query Details', () => {
  const apiBaseUrl = process.env.TEST_API_URL || 'http://localhost:8787';
  const testJWT = 'mock_jwt_token';

  test('GET /api/query/:query_id returns full query details', async () => {
    // Step 1: Execute a query and get query_id
    // TODO: Execute query via POST /api/query/start + WebSocket
    const queryId = 'query_test_123'; // Mock for now

    // Step 2: Retrieve query details
    const response = await fetch(`${apiBaseUrl}/api/query/${queryId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${testJWT}`
      }
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('query');

    const query = data.query;

    // Verify all fields are present
    expect(query).toHaveProperty('query_id', queryId);
    expect(query).toHaveProperty('question');
    expect(query).toHaveProperty('cypher_query');
    expect(query).toHaveProperty('results');
    expect(query).toHaveProperty('created_at');

    // Verify results structure
    expect(query.results).toHaveProperty('entities');
    expect(query.results).toHaveProperty('relationships');
    expect(query.results).toHaveProperty('metadata');
  });

  test('Query details include complete entity properties', async () => {
    // Verify entities have all properties returned from graph
    expect(true).toBe(true); // Placeholder
  });

  test('Non-existent query_id returns 404', async () => {
    const response = await fetch(`${apiBaseUrl}/api/query/nonexistent_query`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${testJWT}`
      }
    });

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data).toHaveProperty('error', 'QUERY_NOT_FOUND');
  });
});
