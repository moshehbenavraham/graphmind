/**
 * Unit Tests: QueryOrchestrator Service
 *
 * Tests query routing, caching, template execution, and GraphRAG pipeline.
 *
 * Extracted from QuerySessionManager decomposition.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  QueryOrchestrator,
  createQueryOrchestrator,
} from '../../src/services/query-orchestrator.js';

// Mock dependencies
vi.mock('../../src/services/cypher-generator.js', () => ({
  generateCypherQuery: vi.fn(),
}));

vi.mock('../../src/services/result-formatter.js', () => ({
  autoFormatResults: vi.fn((results, meta) => ({ results, ...meta })),
}));

vi.mock('../../src/lib/graph/query-cache.js', () => ({
  getCachedQuery: vi.fn(),
  setCachedQuery: vi.fn(),
}));

vi.mock('../../src/services/query-router.js', () => {
  return {
    QueryRouter: class MockQueryRouter {
      constructor() {
        this.route = vi.fn().mockReturnValue({ type: 'simple', path: 'template' });
      }
    },
  };
});

vi.mock('../../src/services/embedding.js', () => {
  return {
    EmbeddingService: class MockEmbeddingService {
      constructor() {
        this.generateEmbedding = vi.fn().mockResolvedValue(new Array(768).fill(0.1));
      }
    },
  };
});

vi.mock('../../src/lib/graph/cypher-templates.js', () => ({
  traversalQueryTemplate: vi.fn().mockReturnValue('MATCH (n) WHERE ID(n) IN $node_ids RETURN n'),
}));

import { generateCypherQuery } from '../../src/services/cypher-generator.js';
import { autoFormatResults } from '../../src/services/result-formatter.js';
import { getCachedQuery, setCachedQuery } from '../../src/lib/graph/query-cache.js';
import { QueryRouter } from '../../src/services/query-router.js';

describe('QueryOrchestrator', () => {
  let mockEnv;
  let mockLogger;
  let orchestrator;
  let mockPoolStub;

  beforeEach(() => {
    // Create mock pool stub
    mockPoolStub = {
      fetch: vi.fn(),
    };

    mockEnv = {
      FALKORDB_HOST: 'localhost',
      FALKORDB_PORT: '6383',
      FALKORDB_USER: 'default',
      FALKORDB_PASSWORD: '',
      FALKORDB_REST_API_KEY: 'test-key',
      KV: {},
      AI: {},
      FALKORDB_POOL: {
        idFromName: vi.fn().mockReturnValue('pool-id'),
        get: vi.fn().mockReturnValue(mockPoolStub),
      },
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Reset all mocks
    vi.clearAllMocks();

    orchestrator = new QueryOrchestrator(mockEnv, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with env and logger', () => {
      expect(orchestrator.env).toBe(mockEnv);
      expect(orchestrator.logger).toBe(mockLogger);
      expect(orchestrator.router).toBeDefined();
    });

    it('should initialize metrics', () => {
      const metrics = orchestrator.getMetrics();
      expect(metrics.totalQueries).toBe(0);
      expect(metrics.cacheHits).toBe(0);
      expect(metrics.templateQueries).toBe(0);
      expect(metrics.graphragQueries).toBe(0);
    });
  });

  describe('buildFalkorConfig', () => {
    it('should build config from environment', () => {
      const config = orchestrator.buildFalkorConfig();

      expect(config.host).toBe('localhost');
      expect(config.port).toBe(6383);
      expect(config.username).toBe('default');
      expect(config.password).toBe('');
      expect(config.apiKey).toBe('test-key');
    });

    it('should throw if FALKORDB_HOST is missing', () => {
      orchestrator.env.FALKORDB_HOST = '';

      expect(() => orchestrator.buildFalkorConfig()).toThrow('FALKORDB_HOST is not configured');
    });

    it('should use default port for https host when port is undefined', () => {
      orchestrator.env.FALKORDB_HOST = 'https://falkordb.example.com';
      orchestrator.env.FALKORDB_PORT = undefined;

      const config = orchestrator.buildFalkorConfig();
      expect(config.port).toBe(443);
    });

    it('should use default port 3013 for non-https host when port is undefined', () => {
      orchestrator.env.FALKORDB_HOST = 'localhost';
      orchestrator.env.FALKORDB_PORT = undefined;

      const config = orchestrator.buildFalkorConfig();
      expect(config.port).toBe(3013);
    });

    it('should use port 0 when explicitly set to empty string', () => {
      // Note: Number('') = 0 which is finite, so it's used
      orchestrator.env.FALKORDB_HOST = 'localhost';
      orchestrator.env.FALKORDB_PORT = '';

      const config = orchestrator.buildFalkorConfig();
      expect(config.port).toBe(0);
    });
  });

  describe('processQuery', () => {
    const userId = 'user_123';
    const userNamespace = 'graph_user_123';
    const question = 'Who is John?';

    it('should return cached result if available', async () => {
      const cachedData = {
        results: [{ name: 'John', type: 'Person' }],
        cypher_query: 'MATCH (p:Person {name: "John"}) RETURN p',
        template_used: 'person_lookup',
      };

      getCachedQuery.mockResolvedValue(cachedData);
      autoFormatResults.mockReturnValue({
        results: cachedData.results,
        cached: true,
      });

      const result = await orchestrator.processQuery(question, userId, userNamespace);

      expect(result.cached).toBe(true);
      expect(result.executionPath).toBe('cache');
      expect(getCachedQuery).toHaveBeenCalledWith(mockEnv.KV, userId, question, {});
    });

    it('should track cache hit metrics', async () => {
      getCachedQuery.mockResolvedValue({
        results: [],
        cypher_query: 'MATCH (n) RETURN n',
        template_used: 'test',
      });

      await orchestrator.processQuery(question, userId, userNamespace);

      const metrics = orchestrator.getMetrics();
      expect(metrics.cacheHits).toBe(1);
      expect(metrics.totalQueries).toBe(1);
    });

    it('should execute template query when cache misses', async () => {
      getCachedQuery.mockResolvedValue(null);

      generateCypherQuery.mockResolvedValue({
        cypher: 'MATCH (p:Person {name: "John"}) RETURN p',
        parameters: { name: 'John' },
        templateUsed: 'person_lookup',
        entities: ['John'],
      });

      mockPoolStub.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{ name: 'John', type: 'Person' }],
          statistics: {},
        }),
      });

      autoFormatResults.mockReturnValue({
        results: [{ name: 'John' }],
        cached: false,
      });

      const result = await orchestrator.processQuery(question, userId, userNamespace);

      expect(result.cached).toBe(false);
      expect(result.executionPath).toBe('template');
      expect(generateCypherQuery).toHaveBeenCalled();
    });

    it('should call onProgress callback', async () => {
      const onProgress = vi.fn();

      getCachedQuery.mockResolvedValue({
        results: [],
        cypher_query: 'MATCH (n) RETURN n',
        template_used: 'test',
      });

      await orchestrator.processQuery(question, userId, userNamespace, { onProgress });

      expect(onProgress).toHaveBeenCalledWith({ type: 'checking_cache' });
    });

    it('should track template query metrics', async () => {
      getCachedQuery.mockResolvedValue(null);

      generateCypherQuery.mockResolvedValue({
        cypher: 'MATCH (n) RETURN n',
        parameters: {},
        templateUsed: 'test',
        entities: [],
      });

      mockPoolStub.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await orchestrator.processQuery(question, userId, userNamespace);

      const metrics = orchestrator.getMetrics();
      expect(metrics.templateQueries).toBe(1);
    });

    it('should track failed query metrics on error', async () => {
      getCachedQuery.mockResolvedValue(null);
      generateCypherQuery.mockRejectedValue(new Error('Generation failed'));

      await expect(orchestrator.processQuery(question, userId, userNamespace))
        .rejects.toThrow('Generation failed');

      const metrics = orchestrator.getMetrics();
      expect(metrics.failedQueries).toBe(1);
    });
  });

  describe('executeTemplateQuery', () => {
    const question = 'What projects is John working on?';
    const userId = 'user_123';
    const userNamespace = 'graph_user_123';

    beforeEach(() => {
      generateCypherQuery.mockResolvedValue({
        cypher: 'MATCH (p:Person)-[:WORKS_ON]->(proj:Project) RETURN proj',
        parameters: { name: 'John' },
        templateUsed: 'relationship_query',
        entities: ['John'],
      });

      mockPoolStub.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{ name: 'GraphMind', type: 'Project' }],
        }),
      });
    });

    it('should generate and execute Cypher query', async () => {
      const result = await orchestrator.executeTemplateQuery(
        question, userId, userNamespace, { startTime: Date.now() }
      );

      expect(result.executionPath).toBe('template');
      expect(result.templateUsed).toBe('relationship_query');
      expect(generateCypherQuery).toHaveBeenCalledWith(
        question,
        userNamespace,
        userId,
        mockEnv
      );
    });

    it('should fall back to GraphRAG if template uses llm_generate', async () => {
      generateCypherQuery.mockResolvedValue({
        cypher: 'MATCH (n) RETURN n',
        parameters: {},
        templateUsed: 'llm_generate',
        entities: [],
      });

      // Mock GraphRAG path
      orchestrator.executeGraphRAG = vi.fn().mockResolvedValue({
        results: [],
        executionPath: 'graphrag',
      });

      const result = await orchestrator.executeTemplateQuery(
        question, userId, userNamespace, { startTime: Date.now() }
      );

      expect(orchestrator.executeGraphRAG).toHaveBeenCalled();
      expect(result.executionPath).toBe('graphrag');
    });

    it('should cache results after execution', async () => {
      await orchestrator.executeTemplateQuery(
        question, userId, userNamespace, { startTime: Date.now() }
      );

      // Give time for async cache operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(setCachedQuery).toHaveBeenCalled();
    });
  });

  describe('executeGraphRAG', () => {
    const question = 'Tell me about recent projects';
    const userId = 'user_123';
    const userNamespace = 'graph_user_123';

    it('should execute vector search and traversal', async () => {
      // Mock vector search results
      mockPoolStub.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [[1, { name: 'Node1' }, 0.9]],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        })
        // Traversal
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{ name: 'Result1' }],
          }),
        });

      const result = await orchestrator.executeGraphRAG(
        question, userId, userNamespace, { startTime: Date.now() }
      );

      expect(result.executionPath).toBe('graphrag');
      expect(result.vectorResults).toBeDefined();
    });

    it('should fall back to template query if no vector results', async () => {
      // Mock empty vector search results for all types
      mockPoolStub.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      // Mock template fallback
      generateCypherQuery.mockResolvedValue({
        cypher: 'MATCH (n) RETURN n',
        parameters: {},
        templateUsed: 'keyword_search',
        entities: [],
      });

      const result = await orchestrator.executeGraphRAG(
        question, userId, userNamespace, { startTime: Date.now() }
      );

      // Should fall back to template
      expect(result.executionPath).toBe('template');
    });

    it('should handle vector search type failures gracefully', async () => {
      // First type fails, others return empty
      mockPoolStub.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [[2, { name: 'Node2' }, 0.8]],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        })
        // Traversal
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        });

      const result = await orchestrator.executeGraphRAG(
        question, userId, userNamespace, { startTime: Date.now() }
      );

      // Should still complete with partial results
      expect(result.executionPath).toBe('graphrag');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should throw if traversal fails', async () => {
      // Mock successful vector search
      mockPoolStub.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [[1, { name: 'Node1' }, 0.9]],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        })
        // Traversal fails
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal error'),
        });

      await expect(
        orchestrator.executeGraphRAG(question, userId, userNamespace, { startTime: Date.now() })
      ).rejects.toThrow('Traversal query failed');
    });
  });

  describe('executeQuery', () => {
    const cypher = 'MATCH (n:Person) RETURN n';
    const parameters = { name: 'John' };
    const userId = 'user_123';

    it('should execute query via connection pool', async () => {
      mockPoolStub.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{ name: 'John' }],
          statistics: { nodes_created: 0 },
        }),
      });

      const results = await orchestrator.executeQuery(cypher, parameters, userId);

      expect(results).toEqual([{ name: 'John' }]);
      expect(mockPoolStub.fetch).toHaveBeenCalledWith(
        'http://internal/execute',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should throw on execution failure', async () => {
      mockPoolStub.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Database error'),
      });

      await expect(orchestrator.executeQuery(cypher, parameters, userId))
        .rejects.toThrow('Query execution failed');
    });

    it('should log query details', async () => {
      mockPoolStub.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await orchestrator.executeQuery(cypher, parameters, userId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Executing query against FalkorDB',
        expect.objectContaining({
          user_id: userId,
          cypher,
        })
      );
    });
  });

  describe('routeQuery', () => {
    it('should delegate to router', () => {
      const question = 'Who is John?';

      orchestrator.router.route.mockReturnValue({ type: 'simple', path: 'template' });

      const result = orchestrator.routeQuery(question);

      expect(result.type).toBe('simple');
      expect(result.path).toBe('template');
      expect(orchestrator.router.route).toHaveBeenCalledWith(question);
    });
  });

  describe('cacheQueryResults', () => {
    it('should cache query results', async () => {
      setCachedQuery.mockResolvedValue(true);

      await orchestrator.cacheQueryResults(
        'Who is John?',
        'user_123',
        'MATCH (n) RETURN n',
        {},
        [{ name: 'John' }],
        'person_lookup'
      );

      expect(setCachedQuery).toHaveBeenCalledWith(
        mockEnv.KV,
        'user_123',
        'Who is John?',
        {},
        expect.objectContaining({
          cypher_query: 'MATCH (n) RETURN n',
          results: [{ name: 'John' }],
          template_used: 'person_lookup',
        })
      );
    });

    it('should log errors without throwing', async () => {
      setCachedQuery.mockRejectedValue(new Error('Cache error'));

      // Should not throw
      await orchestrator.cacheQueryResults(
        'Who is John?',
        'user_123',
        'MATCH (n) RETURN n',
        {},
        [],
        'test'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to cache query results',
        expect.any(Error)
      );
    });
  });

  describe('getMetrics', () => {
    it('should calculate cache hit rate', async () => {
      // Simulate 2 cache hits out of 4 queries
      orchestrator.metrics.totalQueries = 4;
      orchestrator.metrics.cacheHits = 2;

      const metrics = orchestrator.getMetrics();

      expect(metrics.cacheHitRate).toBe(50);
    });

    it('should return 0 cache hit rate when no queries', () => {
      const metrics = orchestrator.getMetrics();

      expect(metrics.cacheHitRate).toBe(0);
    });

    it('should include all metric fields', () => {
      const metrics = orchestrator.getMetrics();

      expect(metrics).toHaveProperty('totalQueries');
      expect(metrics).toHaveProperty('cacheHits');
      expect(metrics).toHaveProperty('templateQueries');
      expect(metrics).toHaveProperty('graphragQueries');
      expect(metrics).toHaveProperty('failedQueries');
      expect(metrics).toHaveProperty('totalLatencyMs');
      expect(metrics).toHaveProperty('cacheHitRate');
    });
  });

  describe('createQueryOrchestrator', () => {
    it('should create QueryOrchestrator instance', () => {
      const instance = createQueryOrchestrator(mockEnv, mockLogger);

      expect(instance).toBeInstanceOf(QueryOrchestrator);
    });
  });
});
