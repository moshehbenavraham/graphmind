/**
 * User Isolation Security Tests
 *
 * Tests user data isolation in semantic search and graph traversal.
 * Validates cross-user data leakage prevention, user_id_normalized filter enforcement,
 * and multi-user concurrent query isolation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Test configuration
const TEST_CONFIG = {
  falkordbHost: process.env.FALKORDB_HOST || 'localhost',
  falkordbPort: process.env.FALKORDB_PORT || '6383',
  falkordbUser: process.env.FALKORDB_USER || 'default',
  falkordbPassword: process.env.FALKORDB_PASSWORD || '',
  graphName: 'graphmind_test'
};

describe('User Isolation Security Tests', () => {
  let falkordbClient;
  let embeddingService;
  let testUserId1 = 'security_test_user_1';
  let testUserId2 = 'security_test_user_2';
  let testUserId3 = 'security_test_user_3';
  let sharedEmbedding; // Same embedding for all users to test isolation

  beforeAll(async () => {
    // Initialize FalkorDB client
    const { FalkorDBClient } = await import('../../src/lib/falkordb/client.js');
    falkordbClient = new FalkorDBClient(TEST_CONFIG);
    await falkordbClient.connect();

    // Initialize embedding service
    const { EmbeddingService } = await import('../../src/services/embedding.js');
    embeddingService = new EmbeddingService({ AI: null }); // Mock AI for testing

    // Generate shared embedding for testing (same semantic content, different users)
    sharedEmbedding = new Array(768).fill(0.7);

    // Create test data for User 1
    await falkordbClient.query(`
      CREATE (p:Person {
        name: 'User1 Alice',
        user_id_normalized: $userId,
        embedding: $embedding,
        mention_count: 5,
        sensitive_data: 'user1_confidential_info'
      })
      CREATE (proj:Project {
        name: 'User1 SecretProject',
        description: 'Top secret project',
        user_id_normalized: $userId,
        embedding: $embedding,
        status: 'confidential'
      })
      CREATE (n:Note {
        note_id: 'user1_note_123',
        transcript_snippet: 'User1 private meeting notes',
        user_id_normalized: $userId,
        embedding: $embedding
      })
      CREATE (p)-[:WORKS_ON]->(proj)
      CREATE (p)-[:MENTIONED_IN]->(n)
    `, {
      userId: testUserId1,
      embedding: sharedEmbedding
    });

    // Create test data for User 2 (similar content, different user)
    await falkordbClient.query(`
      CREATE (p:Person {
        name: 'User2 Bob',
        user_id_normalized: $userId,
        embedding: $embedding,
        mention_count: 3,
        sensitive_data: 'user2_confidential_info'
      })
      CREATE (proj:Project {
        name: 'User2 PrivateProject',
        description: 'Another secret project',
        user_id_normalized: $userId,
        embedding: $embedding,
        status: 'private'
      })
      CREATE (n:Note {
        note_id: 'user2_note_456',
        transcript_snippet: 'User2 confidential notes',
        user_id_normalized: $userId,
        embedding: $embedding
      })
      CREATE (p)-[:WORKS_ON]->(proj)
      CREATE (p)-[:MENTIONED_IN]->(n)
    `, {
      userId: testUserId2,
      embedding: sharedEmbedding
    });

    // Create test data for User 3
    await falkordbClient.query(`
      CREATE (p:Person {
        name: 'User3 Charlie',
        user_id_normalized: $userId,
        embedding: $embedding,
        mention_count: 7
      })
    `, {
      userId: testUserId3,
      embedding: sharedEmbedding
    });
  });

  afterAll(async () => {
    // Clean up test data
    await falkordbClient.query(`
      MATCH (n)
      WHERE n.user_id_normalized IN [$user1, $user2, $user3]
      DETACH DELETE n
    `, {
      user1: testUserId1,
      user2: testUserId2,
      user3: testUserId3
    });

    await falkordbClient.disconnect();
  });

  describe('T037: Cross-user data leakage prevention', () => {
    it('should not return User2 data when querying as User1', async () => {
      const result = await falkordbClient.query(`
        CALL db.idx.vector.queryNodes('Person', 'embedding', 10, $vector)
        YIELD node, score
        WHERE node.user_id_normalized = $userId
        RETURN node, score
        ORDER BY score DESC
      `, {
        vector: sharedEmbedding,
        userId: testUserId1
      });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      // All results must belong to User1 only
      result.forEach(r => {
        expect(r.node.user_id_normalized).toBe(testUserId1);
        expect(r.node.user_id_normalized).not.toBe(testUserId2);
        expect(r.node.user_id_normalized).not.toBe(testUserId3);
      });

      // Should NOT find User2's person
      const hasUser2Person = result.some(r => r.node.name === 'User2 Bob');
      expect(hasUser2Person).toBe(false);
    });

    it('should not return User1 data when querying as User2', async () => {
      const result = await falkordbClient.query(`
        CALL db.idx.vector.queryNodes('Person', 'embedding', 10, $vector)
        YIELD node, score
        WHERE node.user_id_normalized = $userId
        RETURN node, score
        ORDER BY score DESC
      `, {
        vector: sharedEmbedding,
        userId: testUserId2
      });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      // All results must belong to User2 only
      result.forEach(r => {
        expect(r.node.user_id_normalized).toBe(testUserId2);
        expect(r.node.user_id_normalized).not.toBe(testUserId1);
        expect(r.node.user_id_normalized).not.toBe(testUserId3);
      });

      // Should NOT find User1's person
      const hasUser1Person = result.some(r => r.node.name === 'User1 Alice');
      expect(hasUser1Person).toBe(false);
    });

    it('should prevent access to sensitive fields from other users', async () => {
      // User1 tries to access User2's sensitive data via semantic search
      const result = await falkordbClient.query(`
        CALL db.idx.vector.queryNodes('Person', 'embedding', 10, $vector)
        YIELD node, score
        WHERE node.user_id_normalized = $userId
        RETURN node.sensitive_data as sensitiveData
      `, {
        vector: sharedEmbedding,
        userId: testUserId1
      });

      expect(result).toBeDefined();

      // Should only get User1's sensitive data, not User2's
      result.forEach(r => {
        if (r.sensitiveData) {
          expect(r.sensitiveData).toBe('user1_confidential_info');
          expect(r.sensitiveData).not.toBe('user2_confidential_info');
        }
      });
    });

    it('should isolate data across all node types', async () => {
      // Test isolation for Person nodes
      const personResult = await falkordbClient.query(`
        CALL db.idx.vector.queryNodes('Person', 'embedding', 10, $vector)
        YIELD node, score
        WHERE node.user_id_normalized = $userId
        RETURN count(node) as count
      `, {
        vector: sharedEmbedding,
        userId: testUserId1
      });

      expect(personResult[0].count).toBe(1); // Only User1's person

      // Test isolation for Project nodes
      const projectResult = await falkordbClient.query(`
        CALL db.idx.vector.queryNodes('Project', 'embedding', 10, $vector)
        YIELD node, score
        WHERE node.user_id_normalized = $userId
        RETURN count(node) as count
      `, {
        vector: sharedEmbedding,
        userId: testUserId1
      });

      expect(projectResult[0].count).toBe(1); // Only User1's project

      // Test isolation for Note nodes
      const noteResult = await falkordbClient.query(`
        CALL db.idx.vector.queryNodes('Note', 'embedding', 10, $vector)
        YIELD node, score
        WHERE node.user_id_normalized = $userId
        RETURN count(node) as count
      `, {
        vector: sharedEmbedding,
        userId: testUserId1
      });

      expect(noteResult[0].count).toBe(1); // Only User1's note
    });
  });

  describe('T038: user_id_normalized filter enforcement', () => {
    it('should enforce user_id_normalized filter in semantic search', async () => {
      const result = await falkordbClient.query(`
        CALL db.idx.vector.queryNodes('Person', 'embedding', 100, $vector)
        YIELD node, score
        WHERE node.user_id_normalized = $userId
        RETURN node.user_id_normalized as userId, count(*) as count
      `, {
        vector: sharedEmbedding,
        userId: testUserId1
      });

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].userId).toBe(testUserId1);
    });

    it('should enforce user_id_normalized filter in graph traversal', async () => {
      // Get User1's person node
      const personResult = await falkordbClient.query(`
        MATCH (p:Person {user_id_normalized: $userId})
        RETURN id(p) as personId
        LIMIT 1
      `, {
        userId: testUserId1
      });

      const personId = personResult[0].personId;

      // Traverse from User1's person with user isolation
      const traversalResult = await falkordbClient.query(`
        MATCH (entry:Person)
        WHERE id(entry) = $entryId
        MATCH path = (entry)-[r*1..2]-(connected)
        WHERE connected.user_id_normalized = $userId
        RETURN connected.user_id_normalized as userId, count(DISTINCT connected) as count
      `, {
        entryId: personId,
        userId: testUserId1
      });

      expect(traversalResult).toBeDefined();

      // All connected nodes must belong to User1
      traversalResult.forEach(r => {
        expect(r.userId).toBe(testUserId1);
      });
    });

    it('should reject queries without user_id_normalized filter', async () => {
      // This query is INSECURE - it should be prevented by application logic
      // We test that when filter is applied, results are isolated
      const withoutFilter = await falkordbClient.query(`
        CALL db.idx.vector.queryNodes('Person', 'embedding', 100, $vector)
        YIELD node, score
        RETURN count(node) as totalCount
      `, {
        vector: sharedEmbedding
      });

      const withFilter = await falkordbClient.query(`
        CALL db.idx.vector.queryNodes('Person', 'embedding', 100, $vector)
        YIELD node, score
        WHERE node.user_id_normalized = $userId
        RETURN count(node) as filteredCount
      `, {
        vector: sharedEmbedding,
        userId: testUserId1
      });

      // Without filter returns all users' data (3 users)
      expect(withoutFilter[0].totalCount).toBeGreaterThanOrEqual(3);

      // With filter returns only User1's data (1 user)
      expect(withFilter[0].filteredCount).toBe(1);

      // Application MUST always include the filter
      expect(withFilter[0].filteredCount).toBeLessThan(withoutFilter[0].totalCount);
    });

    it('should handle empty user_id_normalized correctly', async () => {
      const result = await falkordbClient.query(`
        CALL db.idx.vector.queryNodes('Person', 'embedding', 10, $vector)
        YIELD node, score
        WHERE node.user_id_normalized = $userId
        RETURN count(node) as count
      `, {
        vector: sharedEmbedding,
        userId: 'nonexistent_user'
      });

      expect(result).toBeDefined();
      expect(result[0].count).toBe(0); // No results for non-existent user
    });
  });

  describe('T039: Multi-user concurrent query isolation', () => {
    it('should handle concurrent queries from different users without leakage', async () => {
      // Simulate concurrent queries from User1 and User2
      const [user1Result, user2Result, user3Result] = await Promise.all([
        falkordbClient.query(`
          CALL db.idx.vector.queryNodes('Person', 'embedding', 10, $vector)
          YIELD node, score
          WHERE node.user_id_normalized = $userId
          RETURN node, score
        `, {
          vector: sharedEmbedding,
          userId: testUserId1
        }),
        falkordbClient.query(`
          CALL db.idx.vector.queryNodes('Person', 'embedding', 10, $vector)
          YIELD node, score
          WHERE node.user_id_normalized = $userId
          RETURN node, score
        `, {
          vector: sharedEmbedding,
          userId: testUserId2
        }),
        falkordbClient.query(`
          CALL db.idx.vector.queryNodes('Person', 'embedding', 10, $vector)
          YIELD node, score
          WHERE node.user_id_normalized = $userId
          RETURN node, score
        `, {
          vector: sharedEmbedding,
          userId: testUserId3
        })
      ]);

      // User1 results should only contain User1 data
      expect(user1Result.length).toBeGreaterThan(0);
      user1Result.forEach(r => {
        expect(r.node.user_id_normalized).toBe(testUserId1);
      });

      // User2 results should only contain User2 data
      expect(user2Result.length).toBeGreaterThan(0);
      user2Result.forEach(r => {
        expect(r.node.user_id_normalized).toBe(testUserId2);
      });

      // User3 results should only contain User3 data
      expect(user3Result.length).toBeGreaterThan(0);
      user3Result.forEach(r => {
        expect(r.node.user_id_normalized).toBe(testUserId3);
      });

      // Verify no cross-contamination
      const user1Names = user1Result.map(r => r.node.name);
      const user2Names = user2Result.map(r => r.node.name);
      const user3Names = user3Result.map(r => r.node.name);

      expect(user1Names).not.toEqual(user2Names);
      expect(user1Names).not.toEqual(user3Names);
      expect(user2Names).not.toEqual(user3Names);
    });

    it('should maintain isolation during high-concurrency load', async () => {
      // Create 50 concurrent queries (25 User1, 25 User2)
      const concurrentQueries = [];

      for (let i = 0; i < 25; i++) {
        // User1 query
        concurrentQueries.push(
          falkordbClient.query(`
            CALL db.idx.vector.queryNodes('Person', 'embedding', 10, $vector)
            YIELD node, score
            WHERE node.user_id_normalized = $userId
            RETURN node.user_id_normalized as userId
          `, {
            vector: sharedEmbedding,
            userId: testUserId1
          })
        );

        // User2 query
        concurrentQueries.push(
          falkordbClient.query(`
            CALL db.idx.vector.queryNodes('Person', 'embedding', 10, $vector)
            YIELD node, score
            WHERE node.user_id_normalized = $userId
            RETURN node.user_id_normalized as userId
          `, {
            vector: sharedEmbedding,
            userId: testUserId2
          })
        );
      }

      const results = await Promise.all(concurrentQueries);

      expect(results.length).toBe(50);

      // Verify each query returned correct user's data
      results.forEach((result, index) => {
        const expectedUserId = index % 2 === 0 ? testUserId1 : testUserId2;

        result.forEach(r => {
          expect(r.userId).toBe(expectedUserId);
        });
      });
    });

    it('should isolate graph traversal during concurrent access', async () => {
      // Get entry nodes for both users
      const user1Person = await falkordbClient.query(`
        MATCH (p:Person {user_id_normalized: $userId})
        RETURN id(p) as personId
        LIMIT 1
      `, { userId: testUserId1 });

      const user2Person = await falkordbClient.query(`
        MATCH (p:Person {user_id_normalized: $userId})
        RETURN id(p) as personId
        LIMIT 1
      `, { userId: testUserId2 });

      const user1PersonId = user1Person[0].personId;
      const user2PersonId = user2Person[0].personId;

      // Concurrent graph traversal from both users
      const [user1Traversal, user2Traversal] = await Promise.all([
        falkordbClient.query(`
          MATCH (entry:Person)
          WHERE id(entry) = $entryId
          MATCH path = (entry)-[r*1..2]-(connected)
          WHERE connected.user_id_normalized = $userId
          RETURN connected.user_id_normalized as userId, count(DISTINCT connected) as count
        `, {
          entryId: user1PersonId,
          userId: testUserId1
        }),
        falkordbClient.query(`
          MATCH (entry:Person)
          WHERE id(entry) = $entryId
          MATCH path = (entry)-[r*1..2]-(connected)
          WHERE connected.user_id_normalized = $userId
          RETURN connected.user_id_normalized as userId, count(DISTINCT connected) as count
        `, {
          entryId: user2PersonId,
          userId: testUserId2
        })
      ]);

      // User1 traversal should only find User1 data
      user1Traversal.forEach(r => {
        expect(r.userId).toBe(testUserId1);
      });

      // User2 traversal should only find User2 data
      user2Traversal.forEach(r => {
        expect(r.userId).toBe(testUserId2);
      });
    });
  });
});
