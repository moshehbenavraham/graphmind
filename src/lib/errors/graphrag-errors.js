/**
 * GraphRAG Error Classification
 *
 * Custom error classes for the GraphRAG pipeline to enable:
 * - Structured error handling
 * - Error-specific recovery strategies
 * - User-friendly error messages
 *
 * @module lib/errors/graphrag-errors
 */

/**
 * Base class for all GraphRAG-related errors
 */
export class GraphRAGError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'GraphRAGError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

/**
 * Thrown when vector search returns no results
 * Should trigger fallback to keyword search
 */
export class VectorSearchNoResults extends GraphRAGError {
  constructor(query, searchedTypes = []) {
    super(
      `No relevant results found for: "${query}"`,
      'NO_VECTOR_RESULTS',
      { query, searchedTypes }
    );
    this.name = 'VectorSearchNoResults';
    this.shouldFallback = true;
    this.retryable = false;
  }
}

/**
 * Thrown when a required vector index is missing
 * Requires admin intervention to create the index
 */
export class VectorIndexMissing extends GraphRAGError {
  constructor(nodeType) {
    super(
      `Vector index missing for node type: ${nodeType}`,
      'INDEX_MISSING',
      { nodeType }
    );
    this.name = 'VectorIndexMissing';
    this.shouldFallback = false;
    this.retryable = false;
  }
}

/**
 * Thrown when embedding generation fails
 * May be retryable (transient Workers AI failure)
 */
export class EmbeddingGenerationFailed extends GraphRAGError {
  constructor(reason, text = '') {
    super(
      `Embedding generation failed: ${reason}`,
      'EMBEDDING_FAILED',
      { reason, textLength: text?.length }
    );
    this.name = 'EmbeddingGenerationFailed';
    this.shouldFallback = true; // Fall back to keyword search
    this.retryable = true;
  }
}

/**
 * Thrown when graph traversal fails
 * Usually a database connectivity issue
 */
export class TraversalFailed extends GraphRAGError {
  constructor(reason, nodeIds = []) {
    super(
      `Graph traversal failed: ${reason}`,
      'TRAVERSAL_FAILED',
      { reason, nodeIdsCount: nodeIds.length }
    );
    this.name = 'TraversalFailed';
    this.shouldFallback = false;
    this.retryable = true;
  }
}

/**
 * Thrown when node ID extraction fails from vector search results
 * Indicates a response format mismatch
 */
export class NodeIdExtractionFailed extends GraphRAGError {
  constructor(sampleData = null) {
    super(
      'Failed to extract node IDs from vector search results',
      'NODE_ID_EXTRACTION_FAILED',
      { sampleData }
    );
    this.name = 'NodeIdExtractionFailed';
    this.shouldFallback = true;
    this.retryable = false;
  }
}

/**
 * Thrown when the FalkorDB connection pool is unavailable
 */
export class ConnectionPoolUnavailable extends GraphRAGError {
  constructor(reason) {
    super(
      `FalkorDB connection pool unavailable: ${reason}`,
      'POOL_UNAVAILABLE',
      { reason }
    );
    this.name = 'ConnectionPoolUnavailable';
    this.shouldFallback = false;
    this.retryable = true;
  }
}

/**
 * Check if an error is a GraphRAG error
 * @param {Error} error - Error to check
 * @returns {boolean} True if error is a GraphRAG error
 */
export function isGraphRAGError(error) {
  return error instanceof GraphRAGError;
}

/**
 * Get user-friendly message for a GraphRAG error
 * @param {Error} error - Error to get message for
 * @returns {string} User-friendly error message
 */
export function getUserFriendlyMessage(error) {
  if (error instanceof VectorSearchNoResults) {
    return "I couldn't find information about that. Try rephrasing your question.";
  }
  if (error instanceof VectorIndexMissing) {
    return "The knowledge graph isn't fully set up yet. Please contact support.";
  }
  if (error instanceof EmbeddingGenerationFailed) {
    return "I had trouble understanding your question. Please try again.";
  }
  if (error instanceof TraversalFailed) {
    return "I found some information but couldn't expand the context. Please try again.";
  }
  if (error instanceof NodeIdExtractionFailed) {
    return "I found results but couldn't process them. Please try again.";
  }
  if (error instanceof ConnectionPoolUnavailable) {
    return "The knowledge database is temporarily unavailable. Please try again in a moment.";
  }
  return "Something went wrong. Please try again.";
}
