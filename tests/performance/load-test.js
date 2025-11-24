/**
 * Concurrent Load Performance Tests (T087-T091)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const TEST_CONFIG = {
  falkordbHost: process.env.FALKORDB_HOST || 'localhost',
  falkordbPort: process.env.FALKORDB_PORT || '6380',
  falkordbUser: process.env.FALKORDB_USER || 'default',
  falkordbPassword: process.env.FALKORDB_PASSWORD || '',
  graphName: 'graphmind_test'
};

describe('Concurrent Load Performance Tests', () => {
  let falkordbClient;
  let testUserId = 'perf_load_user';
  let latencyMeasurements = [];
  let errorCount = 0;

  beforeAll(async () => {
    const { FalkorDBClient } = await import('../../src/lib/falkordb/client.js');
    falkordbClient = new FalkorDBClient(TEST_CONFIG);
    await falkordbClient.connect();

    // Create test data
    for (let i = 0; i < 100; i++) {
      await falkordbClient.query(`
        CREATE (p:Person {name: $name, user_id_normalized: $userId, embedding: $emb, mention_count: 1})
      `, {
        name: `LoadPerson${i}`,
        userId: testUserId,
        emb: new Array(768).fill(0).map((_, idx) => i * 0.01 + idx * 0.0001)
      });
    }
  });

  afterAll(async () => {
    await falkordbClient.query(`MATCH (n) WHERE n.user_id_normalized = $userId DETACH DELETE n`, { userId: testUserId });
    await falkordbClient.disconnect();
  });

  describe('T088: Simulate 100+ concurrent semantic searches', () => {
    it('should handle 100 concurrent queries', async () => {
      const concurrentQueries = 100;
      const queries = [];

      for (let i = 0; i < concurrentQueries; i++) {
        const queryEmbedding = new Array(768).fill(0).map((_, idx) => i * 0.01 + idx * 0.0001);

        const queryPromise = (async () => {
          const startTime = Date.now();
          try {
            await falkordbClient.query(`
              CALL db.idx.vector.queryNodes('Person', 'embedding', 10, $vector)
              YIELD node, score
              WHERE node.user_id_normalized = $userId AND score >= 0.65
              RETURN node, score
              ORDER BY score DESC
            `, {
              vector: queryEmbedding,
              userId: testUserId
            });

            const latency = Date.now() - startTime;
            latencyMeasurements.push(latency);
          } catch (error) {
            errorCount++;
            console.error(`Query ${i} failed:`, error.message);
          }
        })();

        queries.push(queryPromise);
      }

      await Promise.all(queries);

      console.log(`Completed ${concurrentQueries} concurrent queries`);
      console.log(`Successful: ${latencyMeasurements.length}, Failed: ${errorCount}`);

      expect(latencyMeasurements.length).toBeGreaterThan(0);
    });
  });

  describe('T089: Measure latency under concurrent load (P50, P95, P99)', () => {
    it('should calculate percentiles under load', () => {
      const sorted = [...latencyMeasurements].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.50)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const mean = sorted.reduce((sum, val) => sum + val, 0) / sorted.length;

      console.log('\n=== Concurrent Load Latency ===');
      console.log(`Mean: ${mean.toFixed(2)}ms, P50: ${p50}ms, P95: ${p95}ms, P99: ${p99}ms`);
      console.log('===============================\n');

      expect(p50).toBeGreaterThan(0);
    });
  });

  describe('T090: Measure error rate under concurrent load', () => {
    it('should calculate error rate', () => {
      const totalQueries = latencyMeasurements.length + errorCount;
      const errorRate = (errorCount / totalQueries) * 100;

      console.log(`\n=== Error Rate ===`);
      console.log(`Total Queries: ${totalQueries}`);
      console.log(`Errors: ${errorCount}`);
      console.log(`Error Rate: ${errorRate.toFixed(2)}%`);
      console.log('==================\n');

      expect(errorRate).toBeDefined();
    });
  });

  describe('T091: Verify system maintains performance targets under load (<5% error rate)', () => {
    it('should have error rate below 5%', () => {
      const totalQueries = latencyMeasurements.length + errorCount;
      const errorRate = (errorCount / totalQueries) * 100;

      console.log(`Error Rate: ${errorRate.toFixed(2)}% (Target: <5%)`);

      expect(errorRate).toBeLessThan(5);
    });
  });
});
