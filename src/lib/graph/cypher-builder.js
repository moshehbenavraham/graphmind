/**
 * Cypher Query Builder Utility
 *
 * Provides helper functions for constructing Cypher queries with proper
 * parameterization and user namespace filtering.
 *
 * @module lib/graph/cypher-builder
 */

/**
 * Build a MERGE query for creating or updating a node
 *
 * @param {string} nodeType - Node label (e.g., 'Person', 'Project')
 * @param {string} entityId - Unique entity identifier
 * @param {Object} createProps - Properties to set on CREATE
 * @param {Object} updateProps - Properties to set on MATCH (update)
 * @returns {Object} {cypher, params}
 */
export function buildMergeNode(nodeType, entityId, createProps, updateProps = {}) {
  // Build property SET clauses by expanding objects into individual assignments
  const createSetClauses = Object.entries(createProps)
    .map(([key, value]) => {
      const paramName = `create_${key}`;
      return `n.${key} = $${paramName}`;
    })
    .join(', ');

  const updateSetClauses = Object.entries(updateProps)
    .map(([key, value]) => {
      const paramName = `update_${key}`;
      return `n.${key} = $${paramName}`;
    })
    .join(', ');

  const cypher = `
    MERGE (n:${nodeType} {user_id: $user_id, entity_id: $entity_id})
    ON CREATE SET
      ${createSetClauses},
      n.first_mentioned = timestamp(),
      n.mention_count = 1
    ON MATCH SET
      ${updateSetClauses ? updateSetClauses + ',' : ''}
      n.mention_count = COALESCE(n.mention_count, 0) + 1
    RETURN n
  `.trim();

  // Flatten properties into individual parameters
  const params = {
    entity_id: entityId,
  };

  for (const [key, value] of Object.entries(createProps)) {
    params[`create_${key}`] = value;
  }

  for (const [key, value] of Object.entries(updateProps)) {
    params[`update_${key}`] = value;
  }

  return { cypher, params };
}

/**
 * Build a MATCH query for finding a node by entity_id
 *
 * @param {string} nodeType - Node label (optional, can be '*' for any type)
 * @param {string} entityId - Unique entity identifier
 * @returns {Object} {cypher, params}
 */
export function buildMatchNode(nodeType, entityId) {
  const label = nodeType === '*' ? '' : `:${nodeType}`;

  const cypher = `
    MATCH (n${label} {user_id: $user_id, entity_id: $entity_id})
    RETURN n
  `.trim();

  const params = {
    entity_id: entityId,
  };

  return { cypher, params };
}

/**
 * Build a query to create a relationship between two nodes
 *
 * @param {string} fromEntityId - Source node entity_id
 * @param {string} toEntityId - Target node entity_id
 * @param {string} relType - Relationship type (e.g., 'WORKED_WITH')
 * @param {Object} relProps - Relationship properties
 * @returns {Object} {cypher, params}
 */
export function buildCreateRelationship(fromEntityId, toEntityId, relType, relProps = {}) {
  // Build property SET clauses by expanding objects into individual assignments
  // FalkorDB requires "r.prop = value" syntax, NOT "r += {prop: value}"
  const propSetClauses = Object.entries(relProps)
    .map(([key, value]) => {
      return `r.${key} = $rel_${key}`;
    })
    .join(', ');

  // Build Cypher with expanded property assignments
  const cypher = `
    MATCH (from {user_id: $user_id, entity_id: $from_entity_id})
    MATCH (to {user_id: $user_id, entity_id: $to_entity_id})
    MERGE (from)-[r:${relType}]->(to)
    ${propSetClauses ? `ON CREATE SET ${propSetClauses}` : ''}
    ${propSetClauses ? `ON MATCH SET ${propSetClauses}` : ''}
    RETURN r
  `.trim();

  // Flatten properties into individual parameters
  const params = {
    from_entity_id: fromEntityId,
    to_entity_id: toEntityId,
  };

  for (const [key, value] of Object.entries(relProps)) {
    params[`rel_${key}`] = value;
  }

  return { cypher, params };
}

/**
 * Build a query to get entity neighborhood (N-hop connections)
 *
 * @param {string} entityId - Center node entity_id
 * @param {number} depth - Hop depth (1-3)
 * @returns {Object} {cypher, params}
 */
export function buildGetNeighborhood(entityId, depth = 1) {
  if (depth < 1 || depth > 3) {
    throw new Error('Depth must be between 1 and 3');
  }

  const cypher = `
    MATCH (center {user_id: $user_id, entity_id: $entity_id})
    OPTIONAL MATCH path = (center)-[*1..${depth}]-(connected)
    WHERE connected.user_id = $user_id
    WITH center, collect(DISTINCT connected) as neighbors, collect(DISTINCT relationships(path)) as rels
    RETURN center, neighbors, rels
  `.trim();

  const params = {
    entity_id: entityId,
  };

  return { cypher, params };
}

/**
 * Build a query to search entities by name (fuzzy match)
 *
 * @param {string} query - Search query
 * @param {string} [nodeType] - Optional node type filter
 * @param {number} limit - Max results (default 50)
 * @returns {Object} {cypher, params}
 */
export function buildSearchEntities(query, nodeType = null, limit = 50) {
  const typeFilter = nodeType ? `:${nodeType}` : '';

  const cypher = `
    MATCH (n${typeFilter} {user_id: $user_id})
    WHERE toLower(n.name) CONTAINS toLower($query)
    RETURN n, labels(n) as types
    ORDER BY COALESCE(n.mention_count, 0) DESC
    LIMIT $limit
  `.trim();

  const params = {
    query,
    limit,
  };

  return { cypher, params };
}

/**
 * Build a query to get graph statistics
 *
 * @returns {Object} {cypher, params}
 */
export function buildGetGraphStats() {
  const cypher = `
    MATCH (n {user_id: $user_id})
    WITH count(n) as node_count, collect(DISTINCT labels(n)[0]) as types
    MATCH (a {user_id: $user_id})-[r]-(b {user_id: $user_id})
    WITH node_count, types, count(DISTINCT r) as rel_count
    MATCH (top {user_id: $user_id})
    WITH node_count, types, rel_count, top, size((top)-[]-()) as degree
    ORDER BY degree DESC
    LIMIT 10
    WITH node_count, types, rel_count, collect({
      name: top.name,
      type: labels(top)[0],
      connections: degree
    }) as most_connected
    UNWIND types as type
    MATCH (n {user_id: $user_id})
    WHERE labels(n)[0] = type
    WITH node_count, rel_count, most_connected, type, count(n) as type_count
    RETURN
      node_count,
      rel_count,
      collect({type: type, count: type_count}) as entity_breakdown,
      most_connected
  `.trim();

  return { cypher, params: {} };
}

/**
 * Build a query to delete a node and all its relationships
 *
 * @param {string} entityId - Entity ID to delete
 * @returns {Object} {cypher, params}
 */
export function buildDeleteNode(entityId) {
  const cypher = `
    MATCH (n {user_id: $user_id, entity_id: $entity_id})
    DETACH DELETE n
  `.trim();

  const params = {
    entity_id: entityId,
  };

  return { cypher, params };
}

/**
 * Build a query to update node properties
 *
 * @param {string} entityId - Entity ID to update
 * @param {Object} properties - Properties to update
 * @returns {Object} {cypher, params}
 */
export function buildUpdateNode(entityId, properties) {
  const cypher = `
    MATCH (n {user_id: $user_id, entity_id: $entity_id})
    SET n += $properties
    RETURN n
  `.trim();

  const params = {
    entity_id: entityId,
    properties,
  };

  return { cypher, params };
}

/**
 * Build a query to merge two entities (deduplicate)
 *
 * @param {string} sourceEntityId - Entity to merge from (will be deleted)
 * @param {string} targetEntityId - Entity to merge into (will be kept)
 * @param {Object} mergedProps - Properties for merged entity
 * @returns {Object} {cypher, params}
 */
export function buildMergeEntities(sourceEntityId, targetEntityId, mergedProps) {
  const cypher = `
    MATCH (source {user_id: $user_id, entity_id: $source_entity_id})
    MATCH (target {user_id: $user_id, entity_id: $target_entity_id})

    // Transfer all relationships from source to target
    OPTIONAL MATCH (source)-[r]->(other)
    WHERE other.user_id = $user_id AND other.entity_id <> $target_entity_id
    FOREACH (rel IN CASE WHEN r IS NOT NULL THEN [r] ELSE [] END |
      CREATE (target)-[new:SAME_TYPE_AS(rel)]->(other)
      SET new = properties(rel)
    )

    OPTIONAL MATCH (other)-[r]->(source)
    WHERE other.user_id = $user_id AND other.entity_id <> $target_entity_id
    FOREACH (rel IN CASE WHEN r IS NOT NULL THEN [r] ELSE [] END |
      CREATE (other)-[new:SAME_TYPE_AS(rel)]->(target)
      SET new = properties(rel)
    )

    // Update target properties
    SET target += $mergedProps
    SET target.mention_count = COALESCE(target.mention_count, 0) + COALESCE(source.mention_count, 0)

    // Delete source node
    DETACH DELETE source

    RETURN target
  `.trim();

  const params = {
    source_entity_id: sourceEntityId,
    target_entity_id: targetEntityId,
    mergedProps,
  };

  return { cypher, params };
}
