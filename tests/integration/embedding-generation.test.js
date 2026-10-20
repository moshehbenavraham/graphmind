/**
 * Embedding Generation Integration Tests
 *
 * Tests embedding generation functionality for text-to-vector conversion.
 * Validates embedding generation for valid text, batch processing, error handling,
 * and dimension validation.
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

describe('Embedding Generation Tests', () => {
  let embeddingService;
  let falkordbClient;
  let mockAI;
  let testUserId = 'embedding_test_user';

  beforeAll(async () => {
    // Initialize FalkorDB client
    const { FalkorDBClient } = await import('../../src/lib/falkordb/client.js');
    falkordbClient = new FalkorDBClient(TEST_CONFIG);
    await falkordbClient.connect();

    // Mock Workers AI for testing
    mockAI = {
      run: async (model, options) => {
        // Simulate Workers AI response with 768-dim vector
        if (model === '@cf/baai/bge-base-en-v1.5') {
          const text = options.text || '';
          if (!text || text.trim().length === 0) {
            throw new Error('Empty text provided for embedding');
          }

          // Generate deterministic embedding based on text length
          const baseValue = text.length / 1000;
          return {
            data: [new Array(768).fill(baseValue)]
          };
        }

        throw new Error(`Unknown model: ${model}`);
      }
    };

    // Initialize embedding service with mock AI
    const { EmbeddingService } = await import('../../src/services/embedding.js');
    embeddingService = new EmbeddingService({ AI: mockAI });
  });

  afterAll(async () => {
    // Clean up test data
    await falkordbClient.query(`
      MATCH (n)
      WHERE n.user_id_normalized = $userId
      DETACH DELETE n
    `, {
      userId: testUserId
    });

    await falkordbClient.disconnect();
  });

  describe('T042: Valid text embedding generation', () => {
    it('should generate embedding for simple text', async () => {
      const text = 'Alice works on the GraphMind project';
      const embedding = await embeddingService.generateEmbedding(text);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);

      // All values should be numbers
      embedding.forEach(value => {
        expect(typeof value).toBe('number');
        expect(isNaN(value)).toBe(false);
      });
    });

    it('should generate different embeddings for different texts', async () => {
      const text1 = 'Short text';
      const text2 = 'This is a much longer text with more words and different semantic meaning about artificial intelligence';

      const embedding1 = await embeddingService.generateEmbedding(text1);
      const embedding2 = await embeddingService.generateEmbedding(text2);

      expect(embedding1).toBeDefined();
      expect(embedding2).toBeDefined();

      // Embeddings should be different (different text lengths)
      expect(embedding1[0]).not.toBe(embedding2[0]);
    });

    it('should handle long text (500+ characters)', async () => {
      const longText = 'Alice Johnson is a senior software engineer working on the GraphMind project. '.repeat(10);

      expect(longText.length).toBeGreaterThan(500);

      const embedding = await embeddingService.generateEmbedding(longText);

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(768);
    });

    it('should handle special characters in text', async () => {
      const specialText = 'Project: AI/ML @GraphMind #2024 - "Next-gen" knowledge assistant!';

      const embedding = await embeddingService.generateEmbedding(specialText);

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(768);
    });
  });

  describe('T043: Batch embedding generation (10+ nodes)', () => {
    it('should generate embeddings for multiple texts in batch', async () => {
      const texts = [
        'Alice works on AI',
        'Bob manages the database',
        'Charlie handles frontend',
        'Diana leads the design team',
        'Eve works on security',
        'Frank develops APIs',
        'Grace tests the application',
        'Henry writes documentation',
        'Iris manages deployment',
        'Jack optimizes performance'
      ];

      expect(texts.length).toBeGreaterThanOrEqual(10);

      const embeddings = await Promise.all(
        texts.map(text => embeddingService.generateEmbedding(text))
      );

      expect(embeddings.length).toBe(10);

      embeddings.forEach((embedding, index) => {
        expect(embedding).toBeDefined();
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(768);
      });

      // Each embedding should be unique
      const firstValues = embeddings.map(emb => emb[0]);
      const uniqueValues = new Set(firstValues);
      expect(uniqueValues.size).toBeGreaterThan(1); // At least some variation
    });

    it('should handle batch processing without errors', async () => {
      const batchSize = 15;
      const texts = Array.from({ length: batchSize }, (_, i) =>
        `Test text number ${i + 1} with unique content`
      );

      const startTime = Date.now();
      const embeddings = await Promise.all(
        texts.map(text => embeddingService.generateEmbedding(text))
      );
      const endTime = Date.now();

      expect(embeddings.length).toBe(batchSize);

      // All embeddings should be valid
      embeddings.forEach(embedding => {
        expect(embedding.length).toBe(768);
      });

      // Batch processing should complete reasonably fast (mocked AI is instant)
      const duration = endTime - startTime;
      console.log(`Batch of ${batchSize} embeddings generated in ${duration}ms`);
    });
  });

  describe('T044: Error handling for empty/null text', () => {
    it('should reject empty string', async () => {
      await expect(async () => {
        await embeddingService.generateEmbedding('');
      }).rejects.toThrow();
    });

    it('should reject null text', async () => {
      await expect(async () => {
        await embeddingService.generateEmbedding(null);
      }).rejects.toThrow();
    });

    it('should reject undefined text', async () => {
      await expect(async () => {
        await embeddingService.generateEmbedding(undefined);
      }).rejects.toThrow();
    });

    it('should reject whitespace-only text', async () => {
      await expect(async () => {
        await embeddingService.generateEmbedding('   ');
      }).rejects.toThrow();
    });

    it('should handle errors gracefully and provide meaningful messages', async () => {
      try {
        await embeddingService.generateEmbedding('');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toBeDefined();
        expect(typeof error.message).toBe('string');
      }
    });
  });

  describe('T045: 768-dimension vector validation', () => {
    it('should always return 768-dimensional vectors', async () => {
      const testTexts = [
        'Short',
        'Medium length text here',
        'Very long text with lots of words to test if dimension stays consistent regardless of input length and semantic complexity'
      ];

      for (const text of testTexts) {
        const embedding = await embeddingService.generateEmbedding(text);

        expect(embedding.length).toBe(768);
      }
    });

    it('should return vectors with valid float values', async () => {
      const text = 'Test text for validation';
      const embedding = await embeddingService.generateEmbedding(text);

      expect(embedding.length).toBe(768);

      embedding.forEach((value, index) => {
        // Each dimension should be a valid number
        expect(typeof value).toBe('number');
        expect(isNaN(value)).toBe(false);
        expect(isFinite(value)).toBe(true);

        // Embeddings are typically normalized (values between -1 and 1)
        // Our mock uses small positive values
        expect(Math.abs(value)).toBeLessThan(10);
      });
    });

    it('should maintain dimension consistency across batch generation', async () => {
      const texts = Array.from({ length: 20 }, (_, i) => `Text ${i}`);

      const embeddings = await Promise.all(
        texts.map(text => embeddingService.generateEmbedding(text))
      );

      // All embeddings should have exactly 768 dimensions
      embeddings.forEach(embedding => {
        expect(embedding.length).toBe(768);
      });
    });
  });

  describe('T046: Verify embedding generation succeeds for all existing knowledge nodes', () => {
    it('should generate and store embeddings for Person nodes', async () => {
      // Create test person without embedding
      const createResult = await falkordbClient.query(`
        CREATE (p:Person {
          name: 'Test Person',
          user_id_normalized: $userId,
          mention_count: 1
        })
        RETURN id(p) as personId
      `, {
        userId: testUserId
      });

      const personId = createResult[0].personId;

      // Generate embedding
      const text = 'Test Person working on projects';
      const embedding = await embeddingService.generateEmbedding(text);

      // Store embedding in FalkorDB
      await falkordbClient.query(`
        MATCH (p:Person)
        WHERE id(p) = $personId
        SET p.embedding = $embedding
      `, {
        personId,
        embedding
      });

      // Verify embedding was stored
      const verifyResult = await falkordbClient.query(`
        MATCH (p:Person)
        WHERE id(p) = $personId
        RETURN p.embedding as embedding
      `, {
        personId
      });

      expect(verifyResult[0].embedding).toBeDefined();
      expect(verifyResult[0].embedding.length).toBe(768);
    });

    it('should generate and store embeddings for Project nodes', async () => {
      // Create test project without embedding
      const createResult = await falkordbClient.query(`
        CREATE (proj:Project {
          name: 'Test Project',
          description: 'A test project for embedding validation',
          user_id_normalized: $userId,
          status: 'active'
        })
        RETURN id(proj) as projectId
      `, {
        userId: testUserId
      });

      const projectId = createResult[0].projectId;

      // Generate embedding from project description
      const text = 'Test Project: A test project for embedding validation';
      const embedding = await embeddingService.generateEmbedding(text);

      // Store embedding
      await falkordbClient.query(`
        MATCH (proj:Project)
        WHERE id(proj) = $projectId
        SET proj.embedding = $embedding
      `, {
        projectId,
        embedding
      });

      // Verify
      const verifyResult = await falkordbClient.query(`
        MATCH (proj:Project)
        WHERE id(proj) = $projectId
        RETURN proj.embedding as embedding
      `, {
        projectId
      });

      expect(verifyResult[0].embedding).toBeDefined();
      expect(verifyResult[0].embedding.length).toBe(768);
    });

    it('should generate and store embeddings for Note nodes', async () => {
      const createResult = await falkordbClient.query(`
        CREATE (n:Note {
          note_id: 'test_note_embed',
          transcript_snippet: 'Meeting notes about project progress',
          user_id_normalized: $userId,
          timestamp: datetime()
        })
        RETURN id(n) as noteId
      `, {
        userId: testUserId
      });

      const noteId = createResult[0].noteId;

      const text = 'Meeting notes about project progress';
      const embedding = await embeddingService.generateEmbedding(text);

      await falkordbClient.query(`
        MATCH (n:Note)
        WHERE id(n) = $noteId
        SET n.embedding = $embedding
      `, {
        noteId,
        embedding
      });

      const verifyResult = await falkordbClient.query(`
        MATCH (n:Note)
        WHERE id(n) = $noteId
        RETURN n.embedding as embedding
      `, {
        noteId
      });

      expect(verifyResult[0].embedding).toBeDefined();
      expect(verifyResult[0].embedding.length).toBe(768);
    });

    it('should generate and store embeddings for Topic nodes', async () => {
      const createResult = await falkordbClient.query(`
        CREATE (t:Topic {
          name: 'Machine Learning',
          category: 'Technology',
          user_id_normalized: $userId
        })
        RETURN id(t) as topicId
      `, {
        userId: testUserId
      });

      const topicId = createResult[0].topicId;

      const text = 'Machine Learning: Technology topic';
      const embedding = await embeddingService.generateEmbedding(text);

      await falkordbClient.query(`
        MATCH (t:Topic)
        WHERE id(t) = $topicId
        SET t.embedding = $embedding
      `, {
        topicId,
        embedding
      });

      const verifyResult = await falkordbClient.query(`
        MATCH (t:Topic)
        WHERE id(t) = $topicId
        RETURN t.embedding as embedding
      `, {
        topicId
      });

      expect(verifyResult[0].embedding).toBeDefined();
      expect(verifyResult[0].embedding.length).toBe(768);
    });

    it('should successfully backfill embeddings for all node types', async () => {
      // Create multiple nodes without embeddings
      await falkordbClient.query(`
        CREATE (p1:Person {name: 'Person1', user_id_normalized: $userId, mention_count: 1})
        CREATE (p2:Person {name: 'Person2', user_id_normalized: $userId, mention_count: 1})
        CREATE (proj:Project {name: 'Project1', description: 'Test', user_id_normalized: $userId, status: 'active'})
        CREATE (n:Note {note_id: 'note1', transcript_snippet: 'Note content', user_id_normalized: $userId})
        CREATE (t:Topic {name: 'Topic1', category: 'Test', user_id_normalized: $userId})
      `, {
        userId: testUserId
      });

      // Get all nodes without embeddings
      const nodesResult = await falkordbClient.query(`
        MATCH (n)
        WHERE n.user_id_normalized = $userId AND n.embedding IS NULL
        RETURN id(n) as nodeId, labels(n) as labels, n
      `, {
        userId: testUserId
      });

      expect(nodesResult.length).toBeGreaterThan(0);

      // Generate and store embeddings for each node
      for (const node of nodesResult) {
        const text = node.n.name || node.n.transcript_snippet || 'default text';
        const embedding = await embeddingService.generateEmbedding(text);

        await falkordbClient.query(`
          MATCH (n)
          WHERE id(n) = $nodeId
          SET n.embedding = $embedding
        `, {
          nodeId: node.nodeId,
          embedding
        });
      }

      // Verify all nodes now have embeddings
      const verifyResult = await falkordbClient.query(`
        MATCH (n)
        WHERE n.user_id_normalized = $userId
        RETURN count(n) as total,
               count(n.embedding) as withEmbedding
      `, {
        userId: testUserId
      });

      expect(verifyResult[0].total).toBeGreaterThan(0);
      expect(verifyResult[0].withEmbedding).toBe(verifyResult[0].total);
    });
  });
});
