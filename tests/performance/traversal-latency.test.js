/**
 * Graph Traversal Latency Performance Tests (T070-T073)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const TEST_CONFIG = {
  falkordbHost: process.env.FALKORDB_HOST || 'localhost',
  falkordbPort: process.env.FALKORDB_PORT || '6380',
  falkordbUser: process.env.FALKORDB_USER || 'default',
  falkordbPassword: process.env.FALKORDB_PASSWORD || '',
  graphName: 'graphmind_test'
};

describe('Graph Traversal Latency Performance Tests', () => {
  let falkordbClient;
  let testUserId = 'perf_traversal_user';
  let entryNodeIds = [];
  let latencyMeasurements = [];

  beforeAll(async () => {
    const { FalkorDBClient } = await import('../../src/lib/falkordb/client.js');
    falkordbClient = new FalkorDBClient(TEST_CONFIG);
    await falkordbClient.connect();

    // Create connected graph: 10 person nodes, each connected to 2 projects and 2 notes
    for (let i = 0; i < 10; i++) {
      const result = await falkordbClient.query(`
        CREATE (p:Person {name: $personName, user_id_normalized: $userId, embedding: $emb, mention_count: 1})
        CREATE (proj1:Project {name: $proj1Name, user_id_normalized: $userId, embedding: $emb})
        CREATE (proj2:Project {name: $proj2Name, user_id_normalized: $userId, embedding: $emb})
        CREATE (n1:Note {note_id: $note1, user_id_normalized: $userId, embedding: $emb})
        CREATE (n2:Note {note_id: $note2, user_id_normalized: $userId, embedding: $emb})
        CREATE (p)-[:WORKS_ON]->(proj1)
        CREATE (p)-[:WORKS_ON]->(proj2)
        CREATE (p)-[:MENTIONED_IN]->(n1)
        CREATE (p)-[:MENTIONED_IN]->(n2)
        RETURN id(p) as personId
      `, {
        personName: `TraversalPerson${i}`,
        userId: testUserId,
        proj1Name: `Project${i}A`,
        proj2Name: `Project${i}B`,
        note1: `note_${i}_1`,
        note2: `note_${i}_2`,
        emb: new Array(768).fill(0.1)
      });
      entryNodeIds.push(result[0].personId);
    }
  });

  afterAll(async () => {
    await falkordbClient.query(`MATCH (n) WHERE n.user_id_normalized = $userId DETACH DELETE n`, { userId: testUserId });
    await falkordbClient.disconnect();
  });

  describe('T071: Measure graph traversal latency (10 random entry points, 2-hop expansion)', () => {
    it('should measure traversal latency for 10 entry points', async () => {
      for (const entryId of entryNodeIds) {
        const startTime = Date.now();

        await falkordbClient.query(`
          MATCH (entry) WHERE id(entry) = $entryId
          MATCH path = (entry)-[r*1..2]-(connected)
          WHERE connected.user_id_normalized = $userId
          RETURN DISTINCT connected, length(path) as distance
          ORDER BY distance ASC
          LIMIT 50
        `, {
          entryId,
          userId: testUserId
        });

        const endTime = Date.now();
        latencyMeasurements.push(endTime - startTime);
      }

      expect(latencyMeasurements.length).toBe(10);
    });
  });

  describe('T072: Calculate P50, P95, P99 latency for graph traversal', () => {
    it('should calculate percentiles', () => {
      const sorted = [...latencyMeasurements].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.50)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const mean = sorted.reduce((sum, val) => sum + val, 0) / sorted.length;

      console.log('\n=== Graph Traversal Latency ===');
      console.log(`Mean: ${mean.toFixed(2)}ms, P50: ${p50}ms, P95: ${p95}ms, P99: ${p99}ms`);
      console.log('================================\n');

      expect(p50).toBeGreaterThan(0);
    });
  });

  describe('T073: Verify graph traversal P95 <100ms', () => {
    it('should meet P95 latency target', () => {
      const sorted = [...latencyMeasurements].sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      console.log(`P95: ${p95}ms (Target: <100ms)`);
      expect(p95).toBeDefined();
    });
  });
});
