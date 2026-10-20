/**
 * Graph Traversal Integration Tests
 *
 * Tests graph traversal functionality for context expansion from semantic entry points.
 * Validates 1-hop and 2-hop traversal, user isolation, connected entity retrieval,
 * and relationship traversal accuracy.
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

describe('Graph Traversal Tests', () => {
  let falkordbClient;
  let testUserId1 = 'test_user_graph_1';
  let testUserId2 = 'test_user_graph_2';
  let testNodeIds = {
    user1: {
      person: null,
      project: null,
      note: null,
      topic: null
    },
    user2: {
      person: null,
      project: null
    }
  };

  beforeAll(async () => {
    // Initialize FalkorDB client
    const { FalkorDBClient } = await import('../../src/lib/falkordb/client.js');
    falkordbClient = new FalkorDBClient(TEST_CONFIG);
    await falkordbClient.connect();

    // Create test graph with connected entities for User 1
    // Person (Alice) -> WORKS_ON -> Project (GraphMind)
    // Person (Alice) -> MENTIONED_IN -> Note (Team Meeting)
    // Project (GraphMind) -> HAS_TOPIC -> Topic (AI)
    // Note (Team Meeting) -> MENTIONS -> Topic (AI)

    const setupUser1 = await falkordbClient.query(`
      CREATE (p:Person {
        name: 'Alice Johnson',
        user_id_normalized: $userId,
        embedding: $personEmbedding,
        mention_count: 5
      })
      CREATE (proj:Project {
        name: 'GraphMind',
        description: 'Voice-first AI knowledge assistant',
        user_id_normalized: $userId,
        embedding: $projectEmbedding,
        status: 'in_progress'
      })
      CREATE (n:Note {
        note_id: 'note_123',
        transcript_snippet: 'Team meeting about AI integration',
        user_id_normalized: $userId,
        embedding: $noteEmbedding,
        timestamp: datetime()
      })
      CREATE (t:Topic {
        name: 'AI',
        category: 'Technology',
        user_id_normalized: $userId,
        embedding: $topicEmbedding
      })
      CREATE (p)-[:WORKS_ON]->(proj)
      CREATE (p)-[:MENTIONED_IN]->(n)
      CREATE (proj)-[:HAS_TOPIC]->(t)
      CREATE (n)-[:MENTIONS]->(t)
      RETURN id(p) as personId, id(proj) as projectId, id(n) as noteId, id(t) as topicId
    `, {
      userId: testUserId1,
      personEmbedding: new Array(768).fill(0.1),
      projectEmbedding: new Array(768).fill(0.2),
      noteEmbedding: new Array(768).fill(0.3),
      topicEmbedding: new Array(768).fill(0.4)
    });

    testNodeIds.user1.person = setupUser1[0].personId;
    testNodeIds.user1.project = setupUser1[0].projectId;
    testNodeIds.user1.note = setupUser1[0].noteId;
    testNodeIds.user1.topic = setupUser1[0].topicId;

    // Create test graph for User 2 (should be isolated)
    const setupUser2 = await falkordbClient.query(`
      CREATE (p:Person {
        name: 'Bob Smith',
        user_id_normalized: $userId,
        embedding: $personEmbedding,
        mention_count: 3
      })
      CREATE (proj:Project {
        name: 'SecretProject',
        description: 'Private project',
        user_id_normalized: $userId,
        embedding: $projectEmbedding,
        status: 'in_progress'
      })
      CREATE (p)-[:WORKS_ON]->(proj)
      RETURN id(p) as personId, id(proj) as projectId
    `, {
      userId: testUserId2,
      personEmbedding: new Array(768).fill(0.5),
      projectEmbedding: new Array(768).fill(0.6)
    });

    testNodeIds.user2.person = setupUser2[0].personId;
    testNodeIds.user2.project = setupUser2[0].projectId;
  });

  afterAll(async () => {
    // Clean up test data
    await falkordbClient.query(`
      MATCH (n)
      WHERE n.user_id_normalized IN [$user1, $user2]
      DETACH DELETE n
    `, {
      user1: testUserId1,
      user2: testUserId2
    });

    await falkordbClient.disconnect();
  });

  describe('T031: 1-hop context expansion from semantic entry points', () => {
    it('should retrieve all 1-hop neighbors from Person node', async () => {
      const result = await falkordbClient.query(`
        MATCH (entry:Person)
        WHERE id(entry) = $entryId AND entry.user_id_normalized = $userId
        MATCH path = (entry)-[r]-(connected)
        WHERE connected.user_id_normalized = $userId
        RETURN DISTINCT entry, connected, type(r) as relType, length(path) as distance
        ORDER BY distance ASC
      `, {
        entryId: testNodeIds.user1.person,
        userId: testUserId1
      });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThanOrEqual(2); // Should find Project and Note

      // Verify connected nodes
      const connectedNodes = result.map(r => r.connected);
      const hasProject = connectedNodes.some(n => n.name === 'GraphMind');
      const hasNote = connectedNodes.some(n => n.note_id === 'note_123');

      expect(hasProject).toBe(true);
      expect(hasNote).toBe(true);

      // Verify all distances are 1
      result.forEach(r => {
        expect(r.distance).toBe(1);
      });

      // Verify user isolation
      result.forEach(r => {
        expect(r.connected.user_id_normalized).toBe(testUserId1);
      });
    });

    it('should retrieve relationship types correctly', async () => {
      const result = await falkordbClient.query(`
        MATCH (entry:Person)
        WHERE id(entry) = $entryId AND entry.user_id_normalized = $userId
        MATCH (entry)-[r]-(connected)
        WHERE connected.user_id_normalized = $userId
        RETURN DISTINCT type(r) as relType
      `, {
        entryId: testNodeIds.user1.person,
        userId: testUserId1
      });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThanOrEqual(2);

      const relTypes = result.map(r => r.relType);
      expect(relTypes).toContain('WORKS_ON');
      expect(relTypes).toContain('MENTIONED_IN');
    });
  });

  describe('T032: 2-hop context expansion with user isolation', () => {
    it('should retrieve all nodes within 2 hops from Person node', async () => {
      const result = await falkordbClient.query(`
        MATCH (entry:Person)
        WHERE id(entry) = $entryId AND entry.user_id_normalized = $userId
        MATCH path = (entry)-[r*1..2]-(connected)
        WHERE connected.user_id_normalized = $userId
        RETURN DISTINCT entry, connected, length(path) as distance
        ORDER BY distance ASC
      `, {
        entryId: testNodeIds.user1.person,
        userId: testUserId1
      });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThanOrEqual(3); // Should find Project, Note, Topic

      // Verify we get both 1-hop and 2-hop connections
      const distances = result.map(r => r.distance);
      expect(distances).toContain(1); // Direct connections
      expect(distances).toContain(2); // 2-hop connections

      // Verify Topic is reachable via 2 hops
      const connectedNodes = result.map(r => r.connected);
      const hasTopic = connectedNodes.some(n => n.name === 'AI');
      expect(hasTopic).toBe(true);

      // Verify user isolation at all hops
      result.forEach(r => {
        expect(r.connected.user_id_normalized).toBe(testUserId1);
      });
    });

    it('should not leak data from other users in 2-hop traversal', async () => {
      const result = await falkordbClient.query(`
        MATCH (entry:Person)
        WHERE id(entry) = $entryId AND entry.user_id_normalized = $userId
        MATCH path = (entry)-[r*1..2]-(connected)
        RETURN DISTINCT connected.user_id_normalized as connectedUserId
      `, {
        entryId: testNodeIds.user1.person,
        userId: testUserId1
      });

      expect(result).toBeDefined();

      // All connected nodes should belong to testUserId1 only
      result.forEach(r => {
        expect(r.connectedUserId).toBe(testUserId1);
        expect(r.connectedUserId).not.toBe(testUserId2);
      });
    });

    it('should limit traversal depth to 2 hops maximum', async () => {
      const result = await falkordbClient.query(`
        MATCH (entry:Person)
        WHERE id(entry) = $entryId AND entry.user_id_normalized = $userId
        MATCH path = (entry)-[r*1..2]-(connected)
        WHERE connected.user_id_normalized = $userId
        RETURN length(path) as distance
      `, {
        entryId: testNodeIds.user1.person,
        userId: testUserId1
      });

      expect(result).toBeDefined();

      // No distances should exceed 2
      result.forEach(r => {
        expect(r.distance).toBeLessThanOrEqual(2);
        expect(r.distance).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('T033: Connected entities retrieval validation', () => {
    it('should retrieve all entity types connected to entry point', async () => {
      const result = await falkordbClient.query(`
        MATCH (entry:Person)
        WHERE id(entry) = $entryId AND entry.user_id_normalized = $userId
        MATCH path = (entry)-[r*1..2]-(connected)
        WHERE connected.user_id_normalized = $userId
        RETURN DISTINCT labels(connected) as nodeLabels, connected
        ORDER BY nodeLabels
      `, {
        entryId: testNodeIds.user1.person,
        userId: testUserId1
      });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThanOrEqual(3);

      // Extract unique node types
      const nodeTypes = new Set();
      result.forEach(r => {
        r.nodeLabels.forEach(label => nodeTypes.add(label));
      });

      // Should find Project, Note, and Topic nodes
      expect(nodeTypes.has('Project')).toBe(true);
      expect(nodeTypes.has('Note')).toBe(true);
      expect(nodeTypes.has('Topic')).toBe(true);
    });

    it('should include relationship information in traversal', async () => {
      const result = await falkordbClient.query(`
        MATCH (entry:Person)
        WHERE id(entry) = $entryId AND entry.user_id_normalized = $userId
        MATCH path = (entry)-[r*1..2]-(connected)
        WHERE connected.user_id_normalized = $userId
        WITH entry, connected, relationships(path) as rels, length(path) as distance
        RETURN DISTINCT entry, connected, [rel IN rels | type(rel)] as relTypes, distance
        ORDER BY distance ASC
        LIMIT 50
      `, {
        entryId: testNodeIds.user1.person,
        userId: testUserId1
      });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      // Verify relationship information is included
      result.forEach(r => {
        expect(r.relTypes).toBeDefined();
        expect(Array.isArray(r.relTypes)).toBe(true);
        expect(r.relTypes.length).toBeGreaterThan(0);
      });
    });
  });

  describe('T034: Relationship traversal accuracy', () => {
    it('should correctly follow WORKS_ON relationships', async () => {
      const result = await falkordbClient.query(`
        MATCH (p:Person)-[r:WORKS_ON]->(proj:Project)
        WHERE id(p) = $personId AND p.user_id_normalized = $userId
        RETURN p, r, proj
      `, {
        personId: testNodeIds.user1.person,
        userId: testUserId1
      });

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].p.name).toBe('Alice Johnson');
      expect(result[0].proj.name).toBe('GraphMind');
    });

    it('should correctly follow MENTIONED_IN relationships', async () => {
      const result = await falkordbClient.query(`
        MATCH (p:Person)-[r:MENTIONED_IN]->(n:Note)
        WHERE id(p) = $personId AND p.user_id_normalized = $userId
        RETURN p, r, n
      `, {
        personId: testNodeIds.user1.person,
        userId: testUserId1
      });

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].p.name).toBe('Alice Johnson');
      expect(result[0].n.note_id).toBe('note_123');
    });

    it('should traverse multi-hop relationships correctly', async () => {
      // Person -> WORKS_ON -> Project -> HAS_TOPIC -> Topic
      const result = await falkordbClient.query(`
        MATCH path = (p:Person)-[:WORKS_ON]->(proj:Project)-[:HAS_TOPIC]->(t:Topic)
        WHERE id(p) = $personId AND p.user_id_normalized = $userId
        RETURN p, proj, t, length(path) as pathLength
      `, {
        personId: testNodeIds.user1.person,
        userId: testUserId1
      });

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].p.name).toBe('Alice Johnson');
      expect(result[0].proj.name).toBe('GraphMind');
      expect(result[0].t.name).toBe('AI');
      expect(result[0].pathLength).toBe(2);
    });

    it('should handle bidirectional relationships correctly', async () => {
      // Test both directions of relationships
      const outbound = await falkordbClient.query(`
        MATCH (p:Person)-[r]->(connected)
        WHERE id(p) = $personId AND p.user_id_normalized = $userId
        RETURN count(DISTINCT connected) as outboundCount
      `, {
        personId: testNodeIds.user1.person,
        userId: testUserId1
      });

      const inbound = await falkordbClient.query(`
        MATCH (p:Person)<-[r]-(connected)
        WHERE id(p) = $personId AND p.user_id_normalized = $userId
        RETURN count(DISTINCT connected) as inboundCount
      `, {
        personId: testNodeIds.user1.person,
        userId: testUserId1
      });

      const bidirectional = await falkordbClient.query(`
        MATCH (p:Person)-[r]-(connected)
        WHERE id(p) = $personId AND p.user_id_normalized = $userId
        RETURN count(DISTINCT connected) as bidirectionalCount
      `, {
        personId: testNodeIds.user1.person,
        userId: testUserId1
      });

      expect(outbound[0].outboundCount).toBeGreaterThanOrEqual(2);
      expect(bidirectional[0].bidirectionalCount).toBeGreaterThanOrEqual(outbound[0].outboundCount);
    });
  });
});
