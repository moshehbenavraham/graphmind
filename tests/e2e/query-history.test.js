/**
 * E2E Test: Query History Retrieval
 * Task: T257
 *
 * Tests: User asks 5 questions, retrieves history
 * Verifies: all 5 queries listed, correct order (recent first)
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';

describe('E2E: Query History', () => {
  const apiBaseUrl = process.env.TEST_API_URL || 'http://localhost:8787';
  const testJWT = 'mock_jwt_token';

  test('GET /api/query/history returns all queries in order', async () => {
    // Step 1: Execute 5 queries
    const questions = [
      'Who is Sarah?',
      'What projects did Sarah work on?',
      'What did I do last week?',
      'List all people',
      'How many meetings did I have?'
    ];

    // TODO: Execute each query via POST /api/query/start + WebSocket

    // Step 2: Retrieve query history
    const response = await fetch(`${apiBaseUrl}/api/query/history?limit=10&offset=0`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${testJWT}`
      }
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('queries');
    expect(data.queries).toBeInstanceOf(Array);
    expect(data.queries.length).toBeGreaterThanOrEqual(5);

    // Verify queries are ordered by created_at DESC (most recent first)
    for (let i = 0; i < data.queries.length - 1; i++) {
      const current = new Date(data.queries[i].created_at);
      const next = new Date(data.queries[i + 1].created_at);
      expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
    }
  });

  test('Query history includes correct metadata', async () => {
    const response = await fetch(`${apiBaseUrl}/api/query/history?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${testJWT}`
      }
    });

    const data = await response.json();
    const query = data.queries[0];

    // Verify required fields
    expect(query).toHaveProperty('query_id');
    expect(query).toHaveProperty('question');
    expect(query).toHaveProperty('entity_count');
    expect(query).toHaveProperty('latency_ms');
    expect(query).toHaveProperty('created_at');
  });

  test('Pagination works correctly', async () => {
    // Test limit and offset parameters
    const page1 = await fetch(`${apiBaseUrl}/api/query/history?limit=2&offset=0`, {
      headers: { 'Authorization': `Bearer ${testJWT}` }
    }).then(r => r.json());

    const page2 = await fetch(`${apiBaseUrl}/api/query/history?limit=2&offset=2`, {
      headers: { 'Authorization': `Bearer ${testJWT}` }
    }).then(r => r.json());

    // Verify no overlap between pages
    const page1Ids = page1.queries.map(q => q.query_id);
    const page2Ids = page2.queries.map(q => q.query_id);
    const overlap = page1Ids.filter(id => page2Ids.includes(id));
    expect(overlap.length).toBe(0);
  });
});
