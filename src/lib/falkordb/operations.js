/**
 * FalkorDB Graph Operations
 *
 * Basic CRUD operations for graph nodes and relationships.
 * These are helper functions for testing and validation.
 *
 * @module lib/falkordb/operations
 */

import { executeCypher } from './client.js';

/**
 * Create a node in the graph
 *
 * @param {Object} client - FalkorDB client instance
 * @param {string} graphName - Graph database name
 * @param {Object} options - Node creation options
 * @param {string} options.label - Node label (e.g., 'Person', 'Topic', 'Note')
 * @param {Object} options.properties - Node properties as key-value pairs
 * @returns {Promise<Object>} Created node data
 *
 * @example
 * const node = await createNode(client, 'user_123_graph', {
 *   label: 'Person',
 *   properties: { name: 'Alice', age: 30 }
 * });
 */
export async function createNode(client, graphName, options) {
  const { label, properties = {} } = options;

  if (!label) {
    throw new Error('Node label is required');
  }

  // Build property string
  const propEntries = Object.entries(properties);
  const propParams = {};
  const propStrings = propEntries.map(([key, value], index) => {
    const paramName = `prop_${index}`;
    propParams[paramName] = value;
    return `${key}: $${paramName}`;
  });

  const propString = propStrings.length > 0 ? `{${propStrings.join(', ')}}` : '';

  // Build Cypher query
  const cypher = `CREATE (n:${label} ${propString}) RETURN n`;

  const result = await executeCypher(client, graphName, cypher, propParams);

  return {
    node: result.data[0]?.n || null,
    statistics: result.statistics,
  };
}

/**
 * Query nodes from the graph
 *
 * @param {Object} client - FalkorDB client instance
 * @param {string} graphName - Graph database name
 * @param {Object} options - Query options
 * @param {string} [options.label] - Node label to filter by
 * @param {Object} [options.where] - Property filters (exact match)
 * @param {number} [options.limit=100] - Maximum nodes to return
 * @returns {Promise<Object>} Query result with nodes
 *
 * @example
 * const result = await queryNodes(client, 'user_123_graph', {
 *   label: 'Person',
 *   where: { name: 'Alice' },
 *   limit: 10
 * });
 */
export async function queryNodes(client, graphName, options = {}) {
  const { label, where = {}, limit = 100 } = options;

  // Build MATCH clause
  const labelClause = label ? `:${label}` : '';
  let matchClause = `MATCH (n${labelClause})`;

  // Build WHERE clause
  const whereParams = {};
  const whereClauses = [];

  Object.entries(where).forEach(([key, value], index) => {
    const paramName = `where_${index}`;
    whereParams[paramName] = value;
    whereClauses.push(`n.${key} = $${paramName}`);
  });

  if (whereClauses.length > 0) {
    matchClause += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  // Build full Cypher query
  const cypher = `${matchClause} RETURN n LIMIT ${limit}`;

  const result = await executeCypher(client, graphName, cypher, whereParams);

  return {
    nodes: result.data.map(row => row.n),
    count: result.data.length,
    statistics: result.statistics,
  };
}

/**
 * Delete a node from the graph
 *
 * @param {Object} client - FalkorDB client instance
 * @param {string} graphName - Graph database name
 * @param {Object} options - Delete options
 * @param {string} [options.label] - Node label to filter by
 * @param {Object} options.where - Property filters to identify node(s) to delete
 * @returns {Promise<Object>} Delete result with statistics
 *
 * @example
 * const result = await deleteNode(client, 'user_123_graph', {
 *   label: 'TestNode',
 *   where: { id: 'test-123' }
 * });
 */
export async function deleteNode(client, graphName, options) {
  const { label, where = {} } = options;

  if (Object.keys(where).length === 0) {
    throw new Error('WHERE clause required for delete operation (safety check)');
  }

  // Build MATCH clause
  const labelClause = label ? `:${label}` : '';
  let matchClause = `MATCH (n${labelClause})`;

  // Build WHERE clause
  const whereParams = {};
  const whereClauses = [];

  Object.entries(where).forEach(([key, value], index) => {
    const paramName = `where_${index}`;
    whereParams[paramName] = value;
    whereClauses.push(`n.${key} = $${paramName}`);
  });

  matchClause += ` WHERE ${whereClauses.join(' AND ')}`;

  // Build full Cypher query
  const cypher = `${matchClause} DELETE n`;

  const result = await executeCypher(client, graphName, cypher, whereParams);

  return {
    deleted: true,
    statistics: result.statistics,
  };
}

/**
 * Create a relationship between two nodes
 *
 * @param {Object} client - FalkorDB client instance
 * @param {string} graphName - Graph database name
 * @param {Object} options - Relationship creation options
 * @param {Object} options.from - Source node matcher { label, where }
 * @param {Object} options.to - Target node matcher { label, where }
 * @param {string} options.type - Relationship type (e.g., 'KNOWS', 'CREATED', 'MENTIONS')
 * @param {Object} [options.properties={}] - Relationship properties
 * @returns {Promise<Object>} Created relationship data
 *
 * @example
 * const rel = await createRelationship(client, 'user_123_graph', {
 *   from: { label: 'Person', where: { name: 'Alice' } },
 *   to: { label: 'Person', where: { name: 'Bob' } },
 *   type: 'KNOWS',
 *   properties: { since: 2020 }
 * });
 */
export async function createRelationship(client, graphName, options) {
  const { from, to, type, properties = {} } = options;

  if (!from || !to || !type) {
    throw new Error('from, to, and type are required for relationship creation');
  }

  // Build MATCH clauses for source and target nodes
  const fromLabel = from.label ? `:${from.label}` : '';
  const toLabel = to.label ? `:${to.label}` : '';

  const params = {};

  // Build FROM WHERE clause
  const fromWhereClauses = [];
  Object.entries(from.where || {}).forEach(([key, value], index) => {
    const paramName = `from_${index}`;
    params[paramName] = value;
    fromWhereClauses.push(`a.${key} = $${paramName}`);
  });

  // Build TO WHERE clause
  const toWhereClauses = [];
  Object.entries(to.where || {}).forEach(([key, value], index) => {
    const paramName = `to_${index}`;
    params[paramName] = value;
    toWhereClauses.push(`b.${key} = $${paramName}`);
  });

  // Build relationship properties
  const propEntries = Object.entries(properties);
  const propStrings = propEntries.map(([key, value], index) => {
    const paramName = `rel_prop_${index}`;
    params[paramName] = value;
    return `${key}: $${paramName}`;
  });

  const propString = propStrings.length > 0 ? `{${propStrings.join(', ')}}` : '';

  // Build Cypher query
  let cypher = `MATCH (a${fromLabel}), (b${toLabel})`;

  const whereClauses = [];
  if (fromWhereClauses.length > 0) whereClauses.push(`(${fromWhereClauses.join(' AND ')})`);
  if (toWhereClauses.length > 0) whereClauses.push(`(${toWhereClauses.join(' AND ')})`);

  if (whereClauses.length > 0) {
    cypher += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  cypher += ` CREATE (a)-[r:${type} ${propString}]->(b) RETURN r`;

  const result = await executeCypher(client, graphName, cypher, params);

  return {
    relationship: result.data[0]?.r || null,
    statistics: result.statistics,
  };
}

/**
 * Query relationships from the graph
 *
 * @param {Object} client - FalkorDB client instance
 * @param {string} graphName - Graph database name
 * @param {Object} options - Query options
 * @param {string} [options.type] - Relationship type to filter by
 * @param {Object} [options.fromLabel] - Source node label
 * @param {Object} [options.toLabel] - Target node label
 * @param {number} [options.limit=100] - Maximum relationships to return
 * @returns {Promise<Object>} Query result with relationships
 *
 * @example
 * const result = await queryRelationships(client, 'user_123_graph', {
 *   type: 'KNOWS',
 *   fromLabel: 'Person',
 *   limit: 10
 * });
 */
export async function queryRelationships(client, graphName, options = {}) {
  const { type, fromLabel, toLabel, limit = 100 } = options;

  // Build MATCH clause
  const fromLabelClause = fromLabel ? `:${fromLabel}` : '';
  const toLabelClause = toLabel ? `:${toLabel}` : '';
  const typeClause = type ? `:${type}` : '';

  const cypher = `MATCH (a${fromLabelClause})-[r${typeClause}]->(b${toLabelClause}) RETURN a, r, b LIMIT ${limit}`;

  const result = await executeCypher(client, graphName, cypher);

  return {
    relationships: result.data.map(row => ({
      from: row.a,
      relationship: row.r,
      to: row.b,
    })),
    count: result.data.length,
    statistics: result.statistics,
  };
}
