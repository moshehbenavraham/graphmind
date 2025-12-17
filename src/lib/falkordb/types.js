/**
 * FalkorDB Type Definitions
 *
 * Shared JSDoc type definitions for FalkorDB library.
 * This file provides TypeScript-compatible type checking via JSDoc.
 *
 * @module lib/falkordb/types
 */

// ============================================================================
// Connection & Client Types
// ============================================================================

/**
 * FalkorDB connection configuration
 * @typedef {Object} FalkorDBConfig
 * @property {string} host - FalkorDB host (e.g., 'localhost' or 'https://tunnel.example.com')
 * @property {string|number} port - FalkorDB port (e.g., 3013 for REST API)
 * @property {string} username - FalkorDB username
 * @property {string} [user] - FalkorDB username (alias for username, used by some scripts)
 * @property {string} password - FalkorDB password
 * @property {string} [apiKey] - REST API authentication key (Feature 012)
 * @property {number} [connectTimeout] - Connection timeout in ms (default: 5000)
 * @property {number} [commandTimeout] - Command timeout in ms (default: 10000)
 */

/**
 * REST API client interface
 * @typedef {Object} RestClient
 * @property {function(string, string, Object=): Promise<Array>} query - Execute Cypher query
 * @property {function(string, ...any): Promise<any>} send - Send Redis command
 * @property {function(): Promise<void>} close - Close connection
 */

// ============================================================================
// Query Result Types
// ============================================================================

/**
 * Parsed FalkorDB query result
 * @typedef {Object} QueryResult
 * @property {Array<Object>} data - Query result rows as objects
 * @property {QueryMetadata} metadata - Column information
 * @property {QueryStatistics} statistics - Execution statistics
 */

/**
 * Query metadata (column information)
 * @typedef {Object} QueryMetadata
 * @property {string[]} [columns] - Column names
 * @property {any[]} [rawColumns] - Raw column headers for debugging
 */

/**
 * Query execution statistics
 * @typedef {Object} QueryStatistics
 * @property {number} [nodes_created] - Number of nodes created
 * @property {number} [nodes_deleted] - Number of nodes deleted
 * @property {number} [relationships_created] - Number of relationships created
 * @property {number} [relationships_deleted] - Number of relationships deleted
 * @property {number} [properties_set] - Number of properties set
 * @property {number} [labels_added] - Number of labels added
 * @property {string} [query_internal_execution_time] - Execution time
 */

/**
 * REST API response format (from falkordb-rest-api.js)
 * @typedef {Object} RestApiResponse
 * @property {boolean} success - Whether query succeeded
 * @property {Array<Object>} [data] - Parsed result rows
 * @property {QueryMetadata} [metadata] - Column metadata
 * @property {QueryStatistics} [statistics] - Query statistics
 * @property {number} [latency_ms] - Query latency in milliseconds
 * @property {string} [error] - Error message if failed
 */

// ============================================================================
// Error Types
// ============================================================================

/**
 * Normalized FalkorDB error
 * @typedef {Object} NormalizedErrorProps
 * @property {string} message - User-friendly error message
 * @property {string} [code] - Error code (e.g., 'CONN_REFUSED', 'AUTH_FAILED')
 * @property {string} [originalMessage] - Original error message
 * @property {number} [httpStatus] - Suggested HTTP status code
 * @property {string} [host] - FalkorDB host (context)
 * @property {string|number} [port] - FalkorDB port (context)
 * @property {string} [graphName] - Graph name (context)
 * @property {string} [query] - Cypher query (context)
 * @property {string} [userId] - User ID (context)
 * @property {number} [operationCount] - Operation count (for connection pool metrics)
 * @property {string} [operation] - Operation name (context)
 */

/**
 * Extended Error with FalkorDB-specific properties
 * @typedef {Error & NormalizedErrorProps} NormalizedError
 */

/**
 * Error response for API endpoints
 * @typedef {Object} ErrorResponse
 * @property {string} error - Error message
 * @property {number} status - HTTP status code
 * @property {string} [hint] - Troubleshooting hint
 * @property {Object} [details] - Technical details (dev mode only)
 * @property {string} [details.code] - Error code
 * @property {string} [details.originalMessage] - Original error
 * @property {string} [details.host] - Host
 * @property {string|number} [details.port] - Port
 * @property {string} [details.graphName] - Graph name
 * @property {string} [details.query] - Truncated query
 */

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Connection validation result
 * @typedef {Object} ConnectionValidationResult
 * @property {boolean} valid - Whether connection is valid
 * @property {number|null} latency - Latency in milliseconds
 * @property {string|null} error - Error message if invalid
 */

/**
 * Graph statistics
 * @typedef {Object} GraphStats
 * @property {string} graphName - Name of the graph
 * @property {number} nodeCount - Number of nodes
 * @property {number} relationshipCount - Number of relationships
 * @property {boolean} exists - Whether graph exists
 * @property {string} [error] - Error message if query failed
 */

// ============================================================================
// Vector Search Types
// ============================================================================

/**
 * Vector search options
 * @typedef {Object} VectorSearchOptions
 * @property {number} [limit=10] - Maximum results to return
 * @property {number} [threshold=0.7] - Similarity threshold (0-1)
 */

/**
 * Vector search result item
 * @typedef {Object} VectorSearchResult
 * @property {number} nodeId - Graph node ID
 * @property {Object} node - Node data
 * @property {number} score - Similarity score (0-1)
 */

// ============================================================================
// Index Types
// ============================================================================

/**
 * Index definition for FalkorDB
 * @typedef {Object} IndexDefinition
 * @property {string} type - Node type (e.g., 'Person', 'Project')
 * @property {string} property - Property name (e.g., 'user_id', 'name')
 * @property {string} purpose - Index purpose description
 */

/**
 * Index creation result
 * @typedef {Object} IndexResult
 * @property {boolean} success - Whether index creation succeeded
 * @property {string} nodeType - Node type
 * @property {string} property - Property name
 * @property {string} [error] - Error message if failed
 * @property {boolean} [alreadyExists] - True if index already existed
 */

// ============================================================================
// CRUD Operation Types
// ============================================================================

/**
 * Node creation options
 * @typedef {Object} CreateNodeOptions
 * @property {string} label - Node label (e.g., 'Person', 'Topic', 'Note')
 * @property {Object} [properties={}] - Node properties as key-value pairs
 */

/**
 * Node creation result
 * @typedef {Object} CreateNodeResult
 * @property {Object|null} node - Created node data
 * @property {QueryStatistics} statistics - Query statistics
 */

/**
 * Node query options
 * @typedef {Object} QueryNodeOptions
 * @property {string} [label] - Node label to filter by
 * @property {Object} [where={}] - Property filters (exact match)
 * @property {number} [limit=100] - Maximum nodes to return
 */

/**
 * Node query result
 * @typedef {Object} QueryNodeResult
 * @property {Array<Object>} nodes - Matched nodes
 * @property {number} count - Number of nodes returned
 * @property {QueryStatistics} statistics - Query statistics
 */

/**
 * Node delete options
 * @typedef {Object} DeleteNodeOptions
 * @property {string} [label] - Node label to filter by
 * @property {Object} where - Property filters (required for safety)
 */

/**
 * Node delete result
 * @typedef {Object} DeleteNodeResult
 * @property {boolean} deleted - Whether deletion succeeded
 * @property {QueryStatistics} statistics - Query statistics
 */

/**
 * Node matcher for relationship operations
 * @typedef {Object} NodeMatcher
 * @property {string} [label] - Node label
 * @property {Object} [where] - Property filters
 */

/**
 * Relationship creation options
 * @typedef {Object} CreateRelationshipOptions
 * @property {NodeMatcher} from - Source node matcher
 * @property {NodeMatcher} to - Target node matcher
 * @property {string} type - Relationship type (e.g., 'KNOWS', 'CREATED')
 * @property {Object} [properties={}] - Relationship properties
 */

/**
 * Relationship creation result
 * @typedef {Object} CreateRelationshipResult
 * @property {Object|null} relationship - Created relationship data
 * @property {QueryStatistics} statistics - Query statistics
 */

/**
 * Relationship query options
 * @typedef {Object} QueryRelationshipOptions
 * @property {string} [type] - Relationship type to filter by
 * @property {string} [fromLabel] - Source node label
 * @property {string} [toLabel] - Target node label
 * @property {number} [limit=100] - Maximum relationships to return
 */

/**
 * Relationship query result item
 * @typedef {Object} RelationshipItem
 * @property {Object} from - Source node
 * @property {Object} relationship - Relationship data
 * @property {Object} to - Target node
 */

/**
 * Relationship query result
 * @typedef {Object} QueryRelationshipResult
 * @property {Array<RelationshipItem>} relationships - Matched relationships
 * @property {number} count - Number of relationships returned
 * @property {QueryStatistics} statistics - Query statistics
 */

// ============================================================================
// Response Parser Types
// ============================================================================

/**
 * Parsed FalkorDB result from response parser
 * @typedef {Object} ParsedFalkorDBResult
 * @property {Array<Object>} data - Parsed result rows
 * @property {QueryMetadata} metadata - Column metadata
 * @property {QueryStatistics} statistics - Query statistics
 */

// Export empty object to make this a module
export {};
