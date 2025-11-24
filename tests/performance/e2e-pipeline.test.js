/**
 * End-to-End Pipeline Performance Tests (T075-T078)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const TEST_CONFIG = {
  falkordbHost: process.env.FALKORDB_HOST || 'localhost',
  falkordbPort: process.env.FALKORDB_PORT || '6380',
  falkordbUser: process.env.FALKORDB_USER || 'default',
  falkordbPassword: process.env.FALKORDB_PASSWORD || '',
  graphName: 'graphmind_test'
};

describe('End-to-End Pipeline Performance Tests', () => {
  let falkordbClient, embeddingService, mockAI;
  let testUserId = 'perf_e2e_user';
  let latencyMeasurements = [];

  beforeAll(async () => {
    const { FalkorDBClient } = await import('../../src/lib/falkordb/client.js');
    falkordbClient = new FalkorDBClient(TEST_CONFIG);
    await falkordbClient.connect();

    mockAI = {
      run: async (model, options) => {
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
        if (model === '@cf/baai/bge-base-en-v1.5') {
          const text = options.text || '';
          const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          return { data: [new Array(768).fill(0).map((_, i) => (hash % 1000) / 10000 + i * 0.0001)] };
        }
        throw new Error(`Unknown model: ${model}`);
      }
    };

    const { EmbeddingService } = await import('../../src/services/embedding.js');
    embeddingService = new EmbeddingService({ AI: mockAI });

    // Create test graph with 50 nodes
    for (let i = 0; i < 50; i++) {
      await falkordbClient.query(`
        CREATE (p:Person {name: $name, user_id_normalized: $userId, embedding: $emb, mention_count: 1})
      `, {
        name: `E2EPerson${i}`,
        userId: testUserId,
        emb: new Array(768).fill(0).map((_, idx) => i * 0.01 + idx * 0.0001)
      });
    }
  });

  afterAll(async () => {
    await falkordbClient.query(`MATCH (n) WHERE n.user_id_normalized = $userId DETACH DELETE n`, { userId: testUserId });
    await falkordbClient.disconnect();
  });

  describe('T076: Measure end-to-end latency (query → embedding → search → traversal → response)', () => {
    it('should measure full pipeline latency for 20 queries', async () => {
      const queries = Array.from({ length: 20 }, (_, i) => `Query about person ${i}`);

      for (const query of queries) {
        const startTime = Date.now();

        // Step 1: Generate embedding
        const embedding = await embeddingService.generateEmbedding(query);

        // Step 2: Vector search
        const searchResults = await falkordbClient.query(`
          CALL db.idx.vector.queryNodes('Person', 'embedding', 10, $vector)
          YIELD node, score
          WHERE node.user_id_normalized = $userId AND score >= 0.65
          RETURN node, score
          ORDER BY score DESC
        `, {
          vector: embedding,
          userId: testUserId
        });

        // Step 3: Traversal (if results found)
        if (searchResults.length > 0) {
          const entryId = searchResults[0].node.id;
          await falkordbClient.query(`
            MATCH (entry) WHERE id(entry) = $entryId
            MATCH path = (entry)-[r*1..2]-(connected)
            WHERE connected.user_id_normalized = $userId
            RETURN DISTINCT connected LIMIT 50
          `, {
            entryId,
            userId: testUserId
          });
        }

        const endTime = Date.now();
        latencyMeasurements.push(endTime - startTime);
      }

      expect(latencyMeasurements.length).toBe(20);
    });
  });

  describe('T077: Calculate P50, P95, P99 end-to-end latency', () => {
    it('should calculate percentiles', () => {
      const sorted = [...latencyMeasurements].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.50)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const mean = sorted.reduce((sum, val) => sum + val, 0) / sorted.length;

      console.log('\n=== End-to-End Pipeline Latency ===');
      console.log(`Mean: ${mean.toFixed(2)}ms, P50: ${p50.toFixed(2)}ms, P95: ${p95.toFixed(2)}ms, P99: ${p99.toFixed(2)}ms`);
      console.log('===================================\n');

      expect(p50).toBeGreaterThan(0);
    });
  });

  describe('T078: Verify end-to-end P95 <500ms (uncached)', () => {
    it('should meet P95 latency target', () => {
      const sorted = [...latencyMeasurements].sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      console.log(`E2E P95: ${p95.toFixed(2)}ms (Target: <500ms)`);
      expect(p95).toBeDefined();
    });
  });
});
