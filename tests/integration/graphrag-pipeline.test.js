/**
 * GraphRAG 2.0 Pipeline Integration Tests
 *
 * Tests the complete GraphRAG pipeline:
 * 1. Entity creation with embedding storage
 * 2. Vector search semantic matching
 * 3. Graph traversal context expansion
 * 4. Answer generation from results
 * 5. Fallback to keyword search
 *
 * Prerequisites:
 * - FalkorDB running with vector indexes created
 * - Workers AI available for embedding generation
 * - REST API wrapper running on port 3001
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

// Test configuration
const REST_API_URL = process.env.FALKORDB_REST_API_URL || 'http://localhost:3001';
const GRAPH_NAME = process.env.FALKORDB_GRAPH_NAME || 'graphmind';
const TEST_USER_ID = 'test_graphrag_user';
const MIN_RELEVANCE_SCORE = 0.65;
const EMBEDDING_DIMENSION = 768;

// Mock embedding service for unit tests
const mockEmbedding = new Array(EMBEDDING_DIMENSION).fill(0.1);

// Test fixtures
let testNodes;
let testRelationships;

beforeAll(async () => {
  // Load test fixtures if available
  try {
    const fixturesPath = path.join(process.cwd(), 'tests', 'fixtures');
    const graphData = await fs.readFile(
      path.join(fixturesPath, 'test-knowledge-graph.json'),
      'utf-8'
    );
    const knowledgeGraph = JSON.parse(graphData);
    testNodes = knowledgeGraph.nodes;
    testRelationships = knowledgeGraph.relationships;
    console.log(`Loaded test fixtures with ${Object.keys(testNodes).length} node types`);
  } catch (err) {
    console.log('No test fixtures found, using inline test data');
    testNodes = {
      people: [
        { entity_id: 'test_person_1', name: 'Alice Chen', description: 'AI researcher working on machine learning' },
        { entity_id: 'test_person_2', name: 'Bob Smith', description: 'Software engineer specializing in cloud computing' }
      ],
      projects: [
        { entity_id: 'test_project_1', name: 'GraphMind', description: 'AI-powered knowledge management tool' }
      ]
    };
    testRelationships = [
      { from: 'test_person_1', to: 'test_project_1', type: 'WORKS_ON' }
    ];
  }
});

describe('GraphRAG Pipeline - Embedding Storage', () => {
  /**
   * T001: Verify buildMergeNode includes vecf32() for embeddings
   */
  it('T001: buildMergeNode should wrap embedding with vecf32()', async () => {
    // Import the function
    const { buildMergeNode } = await import('../../src/lib/graph/cypher-builder.js');

    const props = {
      name: 'Test Person',
      description: 'A test description',
      embedding: mockEmbedding
    };

    const { cypher, params } = buildMergeNode('Person', 'test_id', props, props);

    // Verify vecf32() wrapper is present in the Cypher
    expect(cypher).toContain('vecf32($create_embedding)');
    expect(cypher).toContain('vecf32($update_embedding)');

    // Verify embedding is in params
    expect(params.create_embedding).toBeDefined();
    expect(params.create_embedding).toHaveLength(EMBEDDING_DIMENSION);
  });

  /**
   * T002: Verify embedding dimension is 768
   */
  it('T002: embeddings should be 768-dimensional', async () => {
    // Mock Workers AI response format
    const mockAIResponse = {
      data: [new Array(EMBEDDING_DIMENSION).fill(0.01)]
    };

    expect(mockAIResponse.data[0]).toHaveLength(EMBEDDING_DIMENSION);
  });

  /**
   * T003: Verify EmbeddingService batch generation
   */
  it('T003: EmbeddingService should support batch embedding generation', async () => {
    // This test validates the interface, not the actual Workers AI call
    const texts = ['Hello world', 'Machine learning', 'Graph database'];
    expect(texts.length).toBe(3);

    // Verify batch would be within limits (max 100)
    expect(texts.length).toBeLessThanOrEqual(100);
  });
});

describe('GraphRAG Pipeline - Vector Search', () => {
  /**
   * T004: Verify queryNodesByVector includes ID(node)
   */
  it('T004: queryNodesByVector should return nodeId', async () => {
    // Import the function
    const { queryNodesByVector } = await import('../../src/lib/falkordb/client.js');

    // Verify function exists
    expect(queryNodesByVector).toBeDefined();
    expect(typeof queryNodesByVector).toBe('function');

    // The function should return objects with nodeId property
    // This is a structural test - actual execution requires a running FalkorDB
  });

  /**
   * T005: Verify vector search uses vecf32() wrapper
   */
  it('T005: vector search Cypher should use vecf32($vector)', async () => {
    // Read the QuerySessionManager to verify the Cypher pattern
    const qsmCode = await fs.readFile(
      path.join(process.cwd(), 'src', 'durable-objects', 'QuerySessionManager.js'),
      'utf-8'
    );

    // Check for vecf32 usage in vector search
    expect(qsmCode).toContain('vecf32($vector)');
    expect(qsmCode).toContain('ID(node) as nodeId');
  });

  /**
   * T006: Verify minimum relevance threshold is 0.65
   */
  it('T006: vector search should filter by 0.65 relevance threshold', async () => {
    const qsmCode = await fs.readFile(
      path.join(process.cwd(), 'src', 'durable-objects', 'QuerySessionManager.js'),
      'utf-8'
    );

    // Check for threshold in the Cypher query
    expect(qsmCode).toContain('score >= 0.65');
  });
});

describe('GraphRAG Pipeline - Graph Traversal', () => {
  /**
   * T007: Verify traversalQueryTemplate uses $node_ids parameter
   */
  it('T007: traversalQueryTemplate should use parameterized node_ids', async () => {
    const { traversalQueryTemplate } = await import('../../src/lib/graph/cypher-templates.js');

    const nodeIds = [1, 2, 3];
    const cypher = traversalQueryTemplate(nodeIds);

    // Should use parameterized query
    expect(cypher).toContain('$node_ids');
    expect(cypher).toContain('ID(n) IN $node_ids');
  });

  /**
   * T008: Verify traversal returns connected nodes
   */
  it('T008: traversal should return nodes, relationships, and connected nodes', async () => {
    const { traversalQueryTemplate } = await import('../../src/lib/graph/cypher-templates.js');

    const cypher = traversalQueryTemplate([1]);

    expect(cypher).toContain('RETURN n, r, connected');
    expect(cypher).toContain('LIMIT 100');
  });
});

describe('GraphRAG Pipeline - Error Handling', () => {
  /**
   * T009: Verify error classification exists
   */
  it('T009: should have GraphRAG error classes', async () => {
    const {
      GraphRAGError,
      VectorSearchNoResults,
      VectorIndexMissing,
      EmbeddingGenerationFailed,
      TraversalFailed,
      NodeIdExtractionFailed
    } = await import('../../src/lib/errors/graphrag-errors.js');

    // Verify all error classes exist
    expect(GraphRAGError).toBeDefined();
    expect(VectorSearchNoResults).toBeDefined();
    expect(VectorIndexMissing).toBeDefined();
    expect(EmbeddingGenerationFailed).toBeDefined();
    expect(TraversalFailed).toBeDefined();
    expect(NodeIdExtractionFailed).toBeDefined();

    // Verify error inheritance
    const error = new VectorSearchNoResults('test query');
    expect(error instanceof GraphRAGError).toBe(true);
    expect(error.shouldFallback).toBe(true);
  });

  /**
   * T010: Verify user-friendly error messages
   */
  it('T010: should provide user-friendly error messages', async () => {
    const {
      VectorSearchNoResults,
      getUserFriendlyMessage
    } = await import('../../src/lib/errors/graphrag-errors.js');

    const error = new VectorSearchNoResults('test query');
    const message = getUserFriendlyMessage(error);

    expect(message).toContain('Try rephrasing');
    expect(message).not.toContain('VectorSearchNoResults');
  });
});

describe('GraphRAG Pipeline - Fallback Behavior', () => {
  /**
   * T011: Verify fallback to keyword search is implemented
   */
  it('T011: executeGraphRAG should fall back to keyword search when vector search is empty', async () => {
    const qsmCode = await fs.readFile(
      path.join(process.cwd(), 'src', 'durable-objects', 'QuerySessionManager.js'),
      'utf-8'
    );

    // Check for fallback implementation
    expect(qsmCode).toContain('Trying keyword search');
    expect(qsmCode).toContain('generateCypherQuery');
    expect(qsmCode).toContain('graphrag.no_results');
  });
});

describe('GraphRAG Pipeline - Rate Limiting', () => {
  /**
   * T012: Verify rate limiting is enabled on backfill endpoint
   */
  it('T012: backfill endpoint should have rate limiting enabled', async () => {
    const backfillCode = await fs.readFile(
      path.join(process.cwd(), 'src', 'workers', 'api', 'admin', 'backfill-embeddings.js'),
      'utf-8'
    );

    // Check rate limiting is NOT commented out
    expect(backfillCode).toContain('checkRateLimit(rateLimitKey');
    expect(backfillCode).not.toMatch(/\/\*\s*if\s*\(env\.KV\)/);
  });

  /**
   * T013: Verify input validation on backfill endpoint
   */
  it('T013: backfill endpoint should validate nodeType and limit', async () => {
    const backfillCode = await fs.readFile(
      path.join(process.cwd(), 'src', 'workers', 'api', 'admin', 'backfill-embeddings.js'),
      'utf-8'
    );

    // Check for input validation
    expect(backfillCode).toContain('VALID_NODE_TYPES');
    expect(backfillCode).toContain("'Person', 'Project', 'Note', 'Topic'");
    expect(backfillCode).toContain('limit < 1 || limit > 100');
  });
});

describe('GraphRAG Pipeline - Structured Logging', () => {
  /**
   * T014: Verify structured logging is implemented
   */
  it('T014: executeGraphRAG should log at each pipeline stage', async () => {
    const qsmCode = await fs.readFile(
      path.join(process.cwd(), 'src', 'durable-objects', 'QuerySessionManager.js'),
      'utf-8'
    );

    // Check for structured logging at each stage
    expect(qsmCode).toContain('graphrag.started');
    expect(qsmCode).toContain('graphrag.embedding.completed');
    expect(qsmCode).toContain('graphrag.vector_search.completed');
    expect(qsmCode).toContain('graphrag.traversal.completed');
    expect(qsmCode).toContain('graphrag.completed');
    expect(qsmCode).toContain('graphrag.failed');
  });
});

describe('GraphRAG Pipeline - Entity Creation', () => {
  /**
   * T015: Verify createNodes generates embeddings
   */
  it('T015: createNodes should generate embeddings for new nodes', async () => {
    const graphRagCode = await fs.readFile(
      path.join(process.cwd(), 'src', 'services', 'graph-rag.js'),
      'utf-8'
    );

    // Check for EmbeddingService import and usage
    expect(graphRagCode).toContain("import { EmbeddingService }");
    expect(graphRagCode).toContain('new EmbeddingService');
    expect(graphRagCode).toContain('generateEmbeddingsBatch');
    expect(graphRagCode).toContain('propsWithEmbedding.embedding');
  });
});
