/**
 * Optimized Cypher Query Library
 *
 * Pre-optimized Cypher queries with proper indexing, limits, and filtering.
 * All queries include user_id filtering for namespace isolation.
 *
 * @module lib/graph/cypher-queries
 */

/**
 * Query configuration defaults
 */
export const QUERY_LIMITS = {
  DEFAULT: 50,
  MAX: 200,
  STATS_TOP_ENTITIES: 10,
};

/**
 * Get user's complete graph with pagination
 *
 * Returns nodes and relationships with cursor-based pagination.
 * Uses user_id index for fast filtering.
 *
 * @param {number} limit - Results per page (default 50, max 200)
 * @param {number} offset - Pagination offset
 * @returns {string} Cypher query
 */
export function getCompleteGraphQuery(limit = QUERY_LIMITS.DEFAULT, offset = 0) {
  const safeLimit = Math.min(limit, QUERY_LIMITS.MAX);

  return `
    MATCH (n {user_id: $user_id})
    OPTIONAL MATCH (n)-[r]-(connected {user_id: $user_id})
    WITH n, collect(DISTINCT r) as relationships, collect(DISTINCT connected) as neighbors
    ORDER BY n.mention_count DESC, n.name ASC
    SKIP $offset
    LIMIT $limit
    RETURN n as node, relationships, neighbors
  `.trim();
}

/**
 * Get entities filtered by type
 *
 * Efficient single-label filtering with user_id index.
 *
 * @param {string} entityType - Entity type (Person, Project, etc.)
 * @param {number} limit - Results per page
 * @returns {string} Cypher query
 */
export function getEntitiesByTypeQuery(entityType, limit = QUERY_LIMITS.DEFAULT) {
  const safeLimit = Math.min(limit, QUERY_LIMITS.MAX);

  return `
    MATCH (n:${entityType} {user_id: $user_id})
    RETURN n
    ORDER BY n.mention_count DESC, n.name ASC
    LIMIT ${safeLimit}
  `.trim();
}

/**
 * Get single entity with N-hop neighborhood
 *
 * Returns entity and all connected nodes within specified depth.
 * Uses entity_id index for fast lookup.
 *
 * @param {number} depth - Neighborhood depth (1-3)
 * @returns {string} Cypher query
 */
export function getEntityNeighborhoodQuery(depth = 1) {
  // Validate depth
  const safeDepth = Math.max(1, Math.min(depth, 3));

  // Build variable-length relationship pattern
  const relationshipPattern = safeDepth === 1 ? '-[r]-' : `-[r*1..${safeDepth}]-`;

  return `
    MATCH (center {user_id: $user_id, entity_id: $entity_id})
    OPTIONAL MATCH path = (center)${relationshipPattern}(connected {user_id: $user_id})
    WITH center, collect(DISTINCT relationships(path)) as all_relationships, collect(DISTINCT connected) as neighbors
    RETURN center,
           all_relationships as relationships,
           neighbors,
           size(neighbors) as neighbor_count
  `.trim();
}

/**
 * Search entities by name (fuzzy matching)
 *
 * Case-insensitive CONTAINS search across all entity types.
 * Uses name index for performance.
 *
 * @param {number} limit - Results limit
 * @returns {string} Cypher query
 */
export function searchEntitiesByNameQuery(limit = QUERY_LIMITS.DEFAULT) {
  const safeLimit = Math.min(limit, QUERY_LIMITS.MAX);

  return `
    MATCH (n {user_id: $user_id})
    WHERE toLower(n.name) CONTAINS toLower($query)
    RETURN n, labels(n) as types
    ORDER BY n.mention_count DESC, n.name ASC
    LIMIT ${safeLimit}
  `.trim();
}

/**
 * Search entities by name with type filter
 *
 * @param {string} entityType - Entity type to filter by
 * @param {number} limit - Results limit
 * @returns {string} Cypher query
 */
export function searchEntitiesByNameAndTypeQuery(entityType, limit = QUERY_LIMITS.DEFAULT) {
  const safeLimit = Math.min(limit, QUERY_LIMITS.MAX);

  return `
    MATCH (n:${entityType} {user_id: $user_id})
    WHERE toLower(n.name) CONTAINS toLower($query)
    RETURN n
    ORDER BY n.mention_count DESC, n.name ASC
    LIMIT ${safeLimit}
  `.trim();
}

/**
 * Get graph statistics
 *
 * Returns node counts, relationship counts, and most connected entities.
 * Expensive query - should be cached (5-minute TTL).
 *
 * @returns {string} Cypher query
 */
export function getGraphStatsQuery() {
  return `
    MATCH (n {user_id: $user_id})
    WITH count(n) as total_nodes, labels(n) as node_labels
    UNWIND node_labels as label
    WITH total_nodes, label, count(*) as label_count
    WITH total_nodes, collect({type: label, count: label_count}) as breakdown
    MATCH (a {user_id: $user_id})-[r]-(b {user_id: $user_id})
    WITH total_nodes, breakdown, count(DISTINCT r) as total_relationships
    MATCH (top {user_id: $user_id})
    WITH total_nodes, breakdown, total_relationships, top, size((top)--()) as degree
    WHERE degree > 0
    ORDER BY degree DESC
    LIMIT ${QUERY_LIMITS.STATS_TOP_ENTITIES}
    RETURN total_nodes,
           breakdown,
           total_relationships,
           collect({
             name: top.name,
             type: labels(top)[0],
             connections: degree,
             entity_id: top.entity_id
           }) as most_connected
  `.trim();
}

/**
 * Get entities by property value
 *
 * Generic property-based lookup.
 *
 * @param {string} property - Property name
 * @param {number} limit - Results limit
 * @returns {string} Cypher query
 */
export function getEntitiesByPropertyQuery(property, limit = QUERY_LIMITS.DEFAULT) {
  const safeLimit = Math.min(limit, QUERY_LIMITS.MAX);

  return `
    MATCH (n {user_id: $user_id})
    WHERE n.${property} = $value
    RETURN n
    ORDER BY n.mention_count DESC
    LIMIT ${safeLimit}
  `.trim();
}

/**
 * Create relationship between two entities
 *
 * Validates both nodes belong to user before creating relationship.
 *
 * @param {string} relationshipType - Relationship type (WORKED_WITH, WORKS_ON, etc.)
 * @returns {string} Cypher query
 */
export function createRelationshipQuery(relationshipType) {
  return `
    MATCH (from {user_id: $user_id, entity_id: $from_entity_id})
    MATCH (to {user_id: $user_id, entity_id: $to_entity_id})
    MERGE (from)-[r:${relationshipType}]->(to)
    ON CREATE SET r.created_at = timestamp()
    ON MATCH SET r.updated_at = timestamp()
    RETURN from, r, to
  `.trim();
}

/**
 * Delete relationship between entities
 *
 * @param {string} relationshipType - Optional relationship type filter
 * @returns {string} Cypher query
 */
export function deleteRelationshipQuery(relationshipType = null) {
  const relationshipPattern = relationshipType ? `[r:${relationshipType}]` : '[r]';

  return `
    MATCH (from {user_id: $user_id, entity_id: $from_entity_id})
          -${relationshipPattern}->
          (to {user_id: $user_id, entity_id: $to_entity_id})
    DELETE r
    RETURN count(r) as deleted_count
  `.trim();
}

/**
 * Delete entity and all its relationships
 *
 * DETACH DELETE removes node and all connected edges.
 *
 * @returns {string} Cypher query
 */
export function deleteEntityQuery() {
  return `
    MATCH (n {user_id: $user_id, entity_id: $entity_id})
    DETACH DELETE n
    RETURN count(n) as deleted_count
  `.trim();
}

/**
 * Update entity properties
 *
 * Updates only specified properties, preserves others.
 *
 * @param {Object} properties - Properties to update
 * @returns {string} Cypher query
 */
export function updateEntityPropertiesQuery(properties) {
  const setClause = Object.keys(properties)
    .map(key => `n.${key} = $${key}`)
    .join(', ');

  return `
    MATCH (n {user_id: $user_id, entity_id: $entity_id})
    SET ${setClause}, n.updated_at = timestamp()
    RETURN n
  `.trim();
}

/**
 * Get relationship between two entities
 *
 * Check if relationship exists and return details.
 *
 * @param {string} relationshipType - Optional relationship type filter
 * @returns {string} Cypher query
 */
export function getRelationshipQuery(relationshipType = null) {
  const relationshipPattern = relationshipType ? `[r:${relationshipType}]` : '[r]';

  return `
    MATCH (from {user_id: $user_id, entity_id: $from_entity_id})
          -${relationshipPattern}->
          (to {user_id: $user_id, entity_id: $to_entity_id})
    RETURN from, r, to, type(r) as relationship_type
  `.trim();
}

/**
 * Get all relationships for an entity
 *
 * Returns all incoming and outgoing relationships.
 *
 * @param {number} limit - Results limit
 * @returns {string} Cypher query
 */
export function getEntityRelationshipsQuery(limit = QUERY_LIMITS.DEFAULT) {
  const safeLimit = Math.min(limit, QUERY_LIMITS.MAX);

  return `
    MATCH (center {user_id: $user_id, entity_id: $entity_id})-[r]-(connected {user_id: $user_id})
    RETURN center, r, connected, type(r) as relationship_type
    ORDER BY r.created_at DESC
    LIMIT ${safeLimit}
  `.trim();
}

/**
 * Find shortest path between two entities
 *
 * Uses BFS to find shortest connection path.
 * Limited to max 5 hops to prevent expensive traversals.
 *
 * @returns {string} Cypher query
 */
export function getShortestPathQuery() {
  return `
    MATCH (from {user_id: $user_id, entity_id: $from_entity_id})
    MATCH (to {user_id: $user_id, entity_id: $to_entity_id})
    MATCH path = shortestPath((from)-[*..5]-(to))
    RETURN path, length(path) as path_length
  `.trim();
}

/**
 * Get recently mentioned entities
 *
 * Returns entities ordered by most recent mention (first_mentioned or updated_at).
 *
 * @param {number} limit - Results limit
 * @returns {string} Cypher query
 */
export function getRecentEntitiesQuery(limit = QUERY_LIMITS.DEFAULT) {
  const safeLimit = Math.min(limit, QUERY_LIMITS.MAX);

  return `
    MATCH (n {user_id: $user_id})
    RETURN n
    ORDER BY COALESCE(n.updated_at, n.first_mentioned) DESC
    LIMIT ${safeLimit}
  `.trim();
}

/**
 * Count entities by type
 *
 * Quick count query for dashboard statistics.
 *
 * @returns {string} Cypher query
 */
export function countEntitiesByTypeQuery() {
  return `
    MATCH (n {user_id: $user_id})
    RETURN labels(n)[0] as entity_type, count(n) as count
    ORDER BY count DESC
  `.trim();
}

/**
 * Get entities with no relationships (orphans)
 *
 * Finds isolated nodes for potential cleanup.
 *
 * @param {number} limit - Results limit
 * @returns {string} Cypher query
 */
export function getOrphanedEntitiesQuery(limit = QUERY_LIMITS.DEFAULT) {
  const safeLimit = Math.min(limit, QUERY_LIMITS.MAX);

  return `
    MATCH (n {user_id: $user_id})
    WHERE NOT (n)--()
    RETURN n, labels(n) as types
    ORDER BY n.first_mentioned DESC
    LIMIT ${safeLimit}
  `.trim();
}

/**
 * Build parameters object for queries
 *
 * Helper to ensure user_id is always included.
 *
 * @param {string} userId - User ID
 * @param {Object} additionalParams - Additional query parameters
 * @returns {Object} Parameters object
 */
export function buildQueryParams(userId, additionalParams = {}) {
  return {
    user_id: userId,
    ...additionalParams,
  };
}
