/**
 * FalkorDB Namespace Management
 *
 * Handles user namespace creation, validation, and graph database operations.
 * Each user gets an isolated graph database with the naming pattern: user_<uuid>_graph
 *
 * @module lib/falkordb/namespace
 */

import { executeCypher, listGraphs, graphExists } from './client.js';
import { normalizeError } from './errors.js';

/**
 * Generate namespace (graph name) for a user
 *
 * Format: user_<uuid>_graph
 * Example: user_f47ac10b-58cc-4372-a567-0e02b2c3d479_graph
 *
 * @param {string} userId - User UUID
 * @returns {string} Graph name for user's namespace
 * @throws {Error} If userId is invalid
 */
export function generateGraphName(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('User ID is required and must be a string');
  }

  // Validate UUID format (loose validation)
  // Accept UUIDs with or without dashes
  const cleanUserId = userId.replace(/-/g, '');
  if (!/^[a-f0-9]{32}$/i.test(cleanUserId)) {
    throw new Error('User ID must be a valid UUID format');
  }

  // Construct graph name
  const graphName = `user_${userId}_graph`;

  // Validate final format
  if (!isValidGraphName(graphName)) {
    throw new Error(`Generated graph name is invalid: ${graphName}`);
  }

  return graphName;
}

/**
 * Validate graph name format
 *
 * Ensures graph name follows expected pattern and prevents injection attacks.
 *
 * Valid format: user_<uuid>_graph
 * - Must start with "user_"
 * - Contains UUID (32 hex chars with optional dashes)
 * - Ends with "_graph"
 * - Total length < 200 chars
 *
 * @param {string} graphName - Graph name to validate
 * @returns {boolean} True if valid
 */
export function isValidGraphName(graphName) {
  if (!graphName || typeof graphName !== 'string') {
    return false;
  }

  // Length check
  if (graphName.length > 200 || graphName.length < 20) {
    return false;
  }

  // Pattern check: user_<uuid>_graph
  // UUID can have dashes or not
  const pattern = /^user_[a-f0-9-]{32,36}_graph$/i;
  return pattern.test(graphName);
}

/**
 * Sanitize user ID to prevent injection attacks
 *
 * Removes any characters that could be used for command injection.
 *
 * @param {string} userId - User ID to sanitize
 * @returns {string} Sanitized user ID
 */
export function sanitizeUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('User ID must be a non-empty string');
  }

  // Remove all characters except alphanumeric and dashes
  const sanitized = userId.replace(/[^a-zA-Z0-9-]/g, '');

  if (!sanitized) {
    throw new Error('User ID contains no valid characters');
  }

  return sanitized;
}

/**
 * Create a new graph database in FalkorDB
 *
 * Creates a graph by executing a simple query on it. This is idempotent -
 * if the graph already exists, the query succeeds without error.
 *
 * @param {Object} client - Redis client instance
 * @param {string} graphName - Name of graph database to create
 * @returns {Promise<boolean>} True if created, false if already exists
 * @throws {Error} If creation fails
 *
 * @example
 * const created = await createGraphDatabase(client, 'user_123_graph');
 * if (created) {
 *   console.log('New graph created');
 * } else {
 *   console.log('Graph already exists');
 * }
 */
export async function createGraphDatabase(client, graphName) {
  // Validate graph name before attempting creation
  if (!isValidGraphName(graphName)) {
    throw new Error(`Invalid graph name format: ${graphName}`);
  }

  try {
    // Check if graph already exists
    const exists = await graphDatabaseExists(client, graphName);
    if (exists) {
      console.log('[FalkorDB] Graph already exists:', graphName);
      return false;
    }

    // Create graph by executing a simple query on it
    // This will create the graph if it doesn't exist
    await executeCypher(client, graphName, 'RETURN 1');

    console.log('[FalkorDB] Graph created successfully:', graphName);
    return true;
  } catch (error) {
    // Check if error is "already exists" - treat as success
    if (error.message && error.message.includes('already exists')) {
      console.log('[FalkorDB] Graph already exists (from error):', graphName);
      return false;
    }

    const normalizedError = normalizeError(error, { graphName, operation: 'create' });
    console.error('[FalkorDB] Failed to create graph:', {
      graphName,
      error: normalizedError.message,
    });
    throw normalizedError;
  }
}

/**
 * Check if a graph database exists
 *
 * @param {Object} client - Redis client instance
 * @param {string} graphName - Name of graph database to check
 * @returns {Promise<boolean>} True if graph exists
 */
export async function graphDatabaseExists(client, graphName) {
  try {
    // Use the graphExists function from client.js
    return await graphExists(client, graphName);
  } catch (error) {
    // If list fails, assume graph doesn't exist
    console.error('[FalkorDB] Failed to check graph existence:', error.message);
    return false;
  }
}

/**
 * Switch to a specific graph database
 *
 * In FalkorDB, you don't explicitly "switch" databases like in Redis.
 * Instead, you specify the graph name in each GRAPH.QUERY command.
 * This function validates that the graph exists before allowing operations.
 *
 * @param {Object} client - Redis client instance
 * @param {string} graphName - Name of graph to switch to
 * @returns {Promise<boolean>} True if graph exists and is accessible
 * @throws {Error} If graph doesn't exist
 *
 * @example
 * await switchToGraph(client, 'user_123_graph');
 * // Now ready to execute queries on this graph
 */
export async function switchToGraph(client, graphName) {
  if (!isValidGraphName(graphName)) {
    throw new Error(`Invalid graph name format: ${graphName}`);
  }

  // Verify graph exists
  const exists = await graphDatabaseExists(client, graphName);
  if (!exists) {
    throw new Error(`Graph database not found: ${graphName}`);
  }

  console.log('[FalkorDB] Validated graph exists:', graphName);
  return true;
}

/**
 * Delete a graph database (USE WITH CAUTION)
 *
 * Permanently deletes a user's graph database and all its data.
 * This operation cannot be undone.
 *
 * @param {Object} client - Redis client instance (from redis-on-workers)
 * @param {string} graphName - Name of graph database to delete
 * @returns {Promise<boolean>} True if deleted successfully
 * @throws {Error} If deletion fails
 */
export async function deleteGraphDatabase(client, graphName) {
  if (!isValidGraphName(graphName)) {
    throw new Error(`Invalid graph name format: ${graphName}`);
  }

  try {
    // Use GRAPH.DELETE Redis command
    await client.send('GRAPH.DELETE', graphName);

    console.log('[FalkorDB] Graph deleted:', graphName);
    return true;
  } catch (error) {
    const normalizedError = normalizeError(error, { graphName, operation: 'delete' });
    console.error('[FalkorDB] Failed to delete graph:', {
      graphName,
      error: normalizedError.message,
    });
    throw normalizedError;
  }
}

/**
 * Get graph database statistics
 *
 * Returns information about nodes, relationships, and properties in a graph.
 *
 * @param {Object} client - FalkorDB client instance
 * @param {string} graphName - Name of graph database
 * @returns {Promise<Object>} Graph statistics
 *
 * @example
 * const stats = await getGraphStats(client, 'user_123_graph');
 * // { nodeCount: 42, relationshipCount: 15, propertyCount: 128 }
 */
export async function getGraphStats(db, graphName) {
  if (!isValidGraphName(graphName)) {
    throw new Error(`Invalid graph name format: ${graphName}`);
  }

  try {
    // Query for basic statistics
    const nodeCountQuery = await executeCypher(
      db,
      graphName,
      'MATCH (n) RETURN count(n) as count'
    );

    const relationshipCountQuery = await executeCypher(
      db,
      graphName,
      'MATCH ()-[r]->() RETURN count(r) as count'
    );

    return {
      graphName,
      nodeCount: nodeCountQuery.data[0]?.count || 0,
      relationshipCount: relationshipCountQuery.data[0]?.count || 0,
      exists: true,
    };
  } catch (error) {
    // If graph doesn't exist or query fails, return zeros
    return {
      graphName,
      nodeCount: 0,
      relationshipCount: 0,
      exists: false,
      error: error.message,
    };
  }
}
