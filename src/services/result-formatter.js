/**
 * Result Formatter Service for Feature 008 (Voice Query Input)
 *
 * Formats FalkorDB query results into structured JSON for frontend display.
 * Parses nodes, relationships, and properties into entities and relationships arrays.
 *
 * @module services/result-formatter
 */

/**
 * Format FalkorDB query results into structured JSON
 *
 * @param {Array} rawResults - Raw FalkorDB query results
 * @param {Object} metadata - Query metadata (execution time, template used, etc.)
 * @returns {Object} Formatted results { entities, relationships, metadata }
 */
export function formatQueryResults(rawResults, metadata = {}) {
  const entities = [];
  const relationships = [];
  const seenEntities = new Set(); // Track entities to avoid duplicates
  const seenRelationships = new Set(); // Track relationships to avoid duplicates

  // Parse each result row
  for (const row of rawResults) {
    // Extract nodes (entities)
    for (const [key, value] of Object.entries(row)) {
      if (isNode(value)) {
        const entity = parseNode(value);
        const entityKey = `${entity.type}:${entity.id}`;

        if (!seenEntities.has(entityKey)) {
          entities.push(entity);
          seenEntities.add(entityKey);
        }
      }

      // Extract relationships
      if (isRelationship(value)) {
        const relationship = parseRelationship(value);
        const relKey = `${relationship.source}:${relationship.type}:${relationship.target}`;

        if (!seenRelationships.has(relKey)) {
          relationships.push(relationship);
          seenRelationships.add(relKey);
        }
      }

      // Handle nested arrays (relationship patterns)
      if (Array.isArray(value)) {
        for (const item of value) {
          if (isNode(item)) {
            const entity = parseNode(item);
            const entityKey = `${entity.type}:${entity.id}`;

            if (!seenEntities.has(entityKey)) {
              entities.push(entity);
              seenEntities.add(entityKey);
            }
          }

          if (isRelationship(item)) {
            const relationship = parseRelationship(item);
            const relKey = `${relationship.source}:${relationship.type}:${relationship.target}`;

            if (!seenRelationships.has(relKey)) {
              relationships.push(relationship);
              seenRelationships.add(relKey);
            }
          }
        }
      }
    }
  }

  // Build metadata
  const resultMetadata = {
    execution_time_ms: metadata.execution_time_ms || 0,
    entity_count: entities.length,
    relationship_count: relationships.length,
    cached: metadata.cached || false,
    template_used: metadata.template_used || null,
    query_id: metadata.query_id || null
  };

  return {
    entities,
    relationships,
    metadata: resultMetadata
  };
}

/**
 * Check if value is a FalkorDB node
 *
 * @param {any} value - Value to check
 * @returns {boolean} True if value is a node
 */
function isNode(value) {
  // FalkorDB nodes have id, labels, and properties
  return (
    value &&
    typeof value === 'object' &&
    ('id' in value || 'identity' in value) &&
    ('labels' in value || 'label' in value) &&
    ('properties' in value || 'props' in value)
  );
}

/**
 * Check if value is a FalkorDB relationship
 *
 * @param {any} value - Value to check
 * @returns {boolean} True if value is a relationship
 */
function isRelationship(value) {
  // FalkorDB relationships have id, type, startNode, endNode
  return (
    value &&
    typeof value === 'object' &&
    ('type' in value || 'relType' in value) &&
    ('start' in value || 'startNode' in value || 'src' in value) &&
    ('end' in value || 'endNode' in value || 'dst' in value)
  );
}

/**
 * Parse FalkorDB node into entity object
 *
 * @param {Object} node - FalkorDB node
 * @returns {Object} Entity { id, type, name, properties }
 */
function parseNode(node) {
  // Extract node ID (handle different formats)
  const nodeId = node.id || node.identity || node.element_id || `node_${Math.random().toString(36).substr(2, 9)}`;

  // Extract node labels (handle different formats)
  let labels = [];
  if (Array.isArray(node.labels)) {
    labels = node.labels;
  } else if (typeof node.labels === 'string') {
    labels = [node.labels];
  } else if (Array.isArray(node.label)) {
    labels = node.label;
  } else if (typeof node.label === 'string') {
    labels = [node.label];
  }

  // Primary type is the first label
  const type = labels[0] || 'Unknown';

  // Extract properties (handle different formats)
  const properties = node.properties || node.props || {};

  // Extract name (fallback to id if no name property)
  const name = properties.name || properties.title || properties.id || `Unnamed ${type}`;

  return {
    id: String(nodeId),
    type,
    name,
    properties
  };
}

/**
 * Parse FalkorDB relationship into relationship object
 *
 * @param {Object} rel - FalkorDB relationship
 * @returns {Object} Relationship { source, target, type, properties }
 */
function parseRelationship(rel) {
  // Extract relationship type
  const type = rel.type || rel.relType || 'RELATED_TO';

  // Extract source and target node IDs
  const source = String(rel.start || rel.startNode || rel.src || 'unknown_source');
  const target = String(rel.end || rel.endNode || rel.dst || 'unknown_target');

  // Extract properties
  const properties = rel.properties || rel.props || {};

  return {
    source,
    target,
    type,
    properties
  };
}

/**
 * Format empty results (no matches found)
 *
 * @param {Object} metadata - Query metadata
 * @returns {Object} Empty result structure
 */
export function formatEmptyResults(metadata = {}) {
  return {
    entities: [],
    relationships: [],
    metadata: {
      execution_time_ms: metadata.execution_time_ms || 0,
      entity_count: 0,
      relationship_count: 0,
      cached: metadata.cached || false,
      template_used: metadata.template_used || null,
      query_id: metadata.query_id || null,
      message: `No results found. Debug: ${metadata.cypher_query || 'N/A'} (Namespace: ${metadata.user_namespace || 'N/A'})`,
      debug_info: {
        cypher_query: metadata.cypher_query || 'N/A',
        user_namespace: metadata.user_namespace || 'N/A',
        user_id: metadata.user_id || 'N/A'
      }
    }
  };
}

/**
 * Format count query results
 *
 * @param {Array} rawResults - Raw FalkorDB count query results
 * @param {Object} metadata - Query metadata
 * @returns {Object} Formatted count results
 */
export function formatCountResults(rawResults, metadata = {}) {
  const count = rawResults[0]?.count || 0;
  const entityType = rawResults[0]?.entity_type || 'entities';

  return {
    entities: [],
    relationships: [],
    metadata: {
      execution_time_ms: metadata.execution_time_ms || 0,
      entity_count: 0,
      relationship_count: 0,
      cached: metadata.cached || false,
      template_used: metadata.template_used || null,
      query_id: metadata.query_id || null,
      count,
      entity_type: entityType,
      message: `Found ${count} ${entityType.toLowerCase()}`
    }
  };
}

/**
 * Format error results for frontend display
 *
 * @param {Error} error - Error object
 * @param {Object} metadata - Query metadata
 * @returns {Object} Error result structure
 */
export function formatErrorResults(error, metadata = {}) {
  return {
    entities: [],
    relationships: [],
    metadata: {
      execution_time_ms: metadata.execution_time_ms || 0,
      entity_count: 0,
      relationship_count: 0,
      cached: false,
      template_used: metadata.template_used || null,
      query_id: metadata.query_id || null,
      error: true,
      error_code: error.code || 'QUERY_ERROR',
      message: error.message || 'An error occurred while executing the query'
    }
  };
}

/**
 * Detect if results are from a count query
 *
 * @param {Array} rawResults - Raw FalkorDB query results
 * @returns {boolean} True if count query
 */
export function isCountQuery(rawResults) {
  if (!rawResults || rawResults.length === 0) {
    return false;
  }

  const firstRow = rawResults[0];
  return 'count' in firstRow && Object.keys(firstRow).length <= 2;
}

/**
 * Auto-detect result type and format accordingly
 *
 * @param {Array} rawResults - Raw FalkorDB query results
 * @param {Object} metadata - Query metadata
 * @returns {Object} Formatted results
 */
export function autoFormatResults(rawResults, metadata = {}) {
  // Empty results
  if (!rawResults || rawResults.length === 0) {
    return formatEmptyResults(metadata);
  }

  // Count query
  if (isCountQuery(rawResults)) {
    return formatCountResults(rawResults, metadata);
  }

  // Standard graph query
  return formatQueryResults(rawResults, metadata);
}
