/**
 * Graph Context Formatting Utilities
 * Feature 009: Answer Generation with LLM
 * Optimized for performance (reduced string operations)
 *
 * Converts FalkorDB query results into natural language context for LLM prompts.
 */

/**
 * Format query results as natural language context for LLM
 * Optimized: Build entity map once, use array accumulation
 * @param {Object} queryResults - Query results from FalkorDB
 * @returns {string} - Formatted context text
 */
export function formatGraphContext(queryResults) {
  const sections = [];

  // Build entity map once for O(1) lookups
  const entityMap = buildEntityMap(queryResults.entities || []);

  // Format entities
  if (queryResults.entities?.length > 0) {
    sections.push(formatEntities(queryResults.entities));
  }

  // Format relationships (pass entity map to avoid repeated lookups)
  if (queryResults.relationships?.length > 0) {
    sections.push(formatRelationshipsOptimized(queryResults.relationships, entityMap));
  }

  // Format source notes
  if (queryResults.metadata?.sources?.length > 0) {
    sections.push(`\nSource Notes: ${queryResults.metadata.sources.length} note(s) available`);
  }

  return sections.join('\n\n');
}

/**
 * Build entity ID to name map for O(1) lookups
 * @param {Array<Object>} entities - Entity objects
 * @returns {Map<string, string>} - Entity ID to name map
 */
function buildEntityMap(entities) {
  const map = new Map();
  for (const entity of entities) {
    if (entity.id && entity.name) {
      map.set(entity.id, entity.name);
    }
  }
  return map;
}

/**
 * Format entities as readable text
 * @param {Array<Object>} entities - Entity objects from query results
 * @returns {string} - Formatted entity text
 */
export function formatEntities(entities) {
  const lines = ['Entities:'];

  for (const entity of entities) {
    const name = entity.name || 'Unknown';
    const type = entity.type || 'Entity';
    const props = formatProperties(entity.properties || {});

    if (props) {
      lines.push(`- ${name} (${type}): ${props}`);
    } else {
      lines.push(`- ${name} (${type})`);
    }
  }

  return lines.join('\n');
}

/**
 * Format entity properties as natural text
 * @param {Object} properties - Property key-value pairs
 * @returns {string} - Formatted properties text
 */
export function formatProperties(properties) {
  const parts = [];

  for (const [key, value] of Object.entries(properties)) {
    // Skip internal properties
    if (key.startsWith('_') || key === 'id') continue;

    // Format temporal properties specially
    if (isTemporalProperty(key)) {
      parts.push(formatTemporalProperty(key, value));
    } else {
      parts.push(formatProperty(key, value));
    }
  }

  return parts.join(', ');
}

/**
 * Format a single property
 * @param {string} key - Property key
 * @param {*} value - Property value
 * @returns {string} - Formatted property
 */
function formatProperty(key, value) {
  // Convert snake_case to readable format
  const readableKey = key.replace(/_/g, ' ');

  // Handle boolean values
  if (typeof value === 'boolean') {
    return value ? readableKey : `not ${readableKey}`;
  }

  // Handle null/undefined
  if (value === null || value === undefined) {
    return `${readableKey} unknown`;
  }

  return `${readableKey} is ${value}`;
}

/**
 * Format temporal property (dates, timestamps)
 * @param {string} key - Property key
 * @param {*} value - Temporal value
 * @returns {string} - Formatted temporal text
 */
function formatTemporalProperty(key, value) {
  const readableKey = key.replace(/_/g, ' ');
  const formattedDate = formatDate(value);

  return `${readableKey} ${formattedDate}`;
}

/**
 * Format date to natural language
 * @param {string|Date} date - Date value
 * @returns {string} - Formatted date (e.g., "November 3rd, 2025")
 */
export function formatDate(date) {
  let dateObj;

  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    return String(date);
  }

  // Check if valid date
  if (isNaN(dateObj.getTime())) {
    return String(date);
  }

  // Format as "Month Day, Year"
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return dateObj.toLocaleDateString('en-US', options);
}

/**
 * Check if property key is temporal
 * @param {string} key - Property key
 * @returns {boolean} - Whether property is temporal
 */
function isTemporalProperty(key) {
  const temporalKeys = [
    'date', 'time', 'timestamp', 'created_at', 'updated_at',
    'first_mentioned', 'last_seen', 'since', 'started_date',
    'ended_date', 'deadline'
  ];

  return temporalKeys.some(tk => key.toLowerCase().includes(tk));
}

/**
 * Format relationships as natural text (legacy, uses array lookup)
 * @param {Array<Object>} relationships - Relationship objects
 * @param {Array<Object>} entities - Entity objects (for name lookup)
 * @returns {string} - Formatted relationship text
 */
export function formatRelationships(relationships, entities = []) {
  const entityMap = buildEntityMap(entities);
  return formatRelationshipsOptimized(relationships, entityMap);
}

/**
 * Format relationships using entity map (optimized)
 * @param {Array<Object>} relationships - Relationship objects
 * @param {Map<string, string>} entityMap - Entity ID to name map
 * @returns {string} - Formatted relationship text
 */
function formatRelationshipsOptimized(relationships, entityMap) {
  const lines = ['Relationships:'];

  for (const rel of relationships) {
    const sourceName = entityMap.get(rel.source) || rel.source;
    const targetName = entityMap.get(rel.target) || rel.target;
    const relType = formatRelationshipType(rel.type);

    lines.push(`- ${sourceName} ${relType} ${targetName}`);
  }

  return lines.join('\n');
}

/**
 * Format relationship type to natural language
 * @param {string} type - Relationship type (e.g., "WORKS_ON")
 * @returns {string} - Natural language (e.g., "works on")
 */
function formatRelationshipType(type) {
  return type
    .toLowerCase()
    .replace(/_/g, ' ');
}

/**
 * Find entity name by ID
 * @param {string} entityId - Entity ID
 * @param {Array<Object>} entities - Entity objects
 * @returns {string|null} - Entity name or null
 */
function findEntityName(entityId, entities) {
  const entity = entities.find(e => e.id === entityId);
  return entity?.name || null;
}

/**
 * Format query results as bullet list (fallback when LLM unavailable)
 * Optimized: Use entity map for O(1) lookups
 * @param {Object} queryResults - Query results
 * @returns {string} - Formatted bullet list
 */
export function formatResultsAsBulletList(queryResults) {
  const lines = ["Here's what I found:\n"];

  // Build entity map once
  const entityMap = buildEntityMap(queryResults.entities || []);

  // Add entities
  if (queryResults.entities?.length > 0) {
    for (const entity of queryResults.entities) {
      const name = entity.name || 'Unknown';
      const type = entity.type || 'Entity';
      const props = formatProperties(entity.properties || {});

      lines.push(props ? `• ${name} (${type}): ${props}` : `• ${name} (${type})`);
    }
  }

  // Add relationships
  if (queryResults.relationships?.length > 0) {
    lines.push('\nConnections:');
    for (const rel of queryResults.relationships) {
      const sourceName = entityMap.get(rel.source) || rel.source;
      const targetName = entityMap.get(rel.target) || rel.target;
      const relType = formatRelationshipType(rel.type);

      lines.push(`• ${sourceName} ${relType} ${targetName}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format source citations with temporal context
 * @param {Array<Object>} sources - Source note objects with metadata
 * @returns {string} - Formatted citation text
 */
export function formatSourceCitations(sources) {
  if (!sources || sources.length === 0) {
    return '';
  }

  const citations = sources.map(source => {
    const date = formatDate(source.timestamp);
    return `from your notes on ${date}`;
  });

  if (citations.length === 1) {
    return citations[0];
  } else if (citations.length === 2) {
    return `${citations[0]} and ${citations[1]}`;
  } else {
    const last = citations.pop();
    return `${citations.join(', ')}, and ${last}`;
  }
}

/**
 * Optimize context formatting based on query type
 * Optimized: Build entity map once, reduce redundant function calls
 * @param {Object} queryResults - Query results
 * @param {string} queryType - Query type (entity, relationship, temporal, count, list)
 * @returns {string} - Optimized context for query type
 */
export function formatContextForQueryType(queryResults, queryType) {
  // Build entity map once for reuse
  const entityMap = buildEntityMap(queryResults.entities || []);

  switch (queryType) {
    case 'entity':
      // Focus on entity properties
      return formatEntities(queryResults.entities || []);

    case 'relationship':
      // Focus on relationships (use optimized version with entity map)
      return formatRelationshipsOptimized(
        queryResults.relationships || [],
        entityMap
      );

    case 'count':
      // Include counts in context
      const entityCount = queryResults.entities?.length || 0;
      const relCount = queryResults.relationships?.length || 0;
      return `Found ${entityCount} entities and ${relCount} relationships.\n\n${formatGraphContext(queryResults)}`;

    case 'temporal':
    case 'list':
    default:
      // Use default formatting
      return formatGraphContext(queryResults);
  }
}
