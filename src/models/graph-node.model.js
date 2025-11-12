/**
 * Graph Node Model
 *
 * Defines valid entity types and their property schemas for FalkorDB nodes.
 * Validates node data before creating/updating in the knowledge graph.
 *
 * @module models/graph-node.model
 */

/**
 * Valid entity/node types
 */
export const NodeTypes = {
  PERSON: 'Person',
  PROJECT: 'Project',
  MEETING: 'Meeting',
  TOPIC: 'Topic',
  TECHNOLOGY: 'Technology',
  LOCATION: 'Location',
  ORGANIZATION: 'Organization',
};

/**
 * Node property schemas (required and optional fields)
 */
export const NodeSchemas = {
  [NodeTypes.PERSON]: {
    required: ['name'],
    optional: ['email', 'phone', 'role', 'first_mentioned', 'mention_count', 'entity_id'],
  },
  [NodeTypes.PROJECT]: {
    required: ['name'],
    optional: ['description', 'status', 'started_date', 'technologies', 'entity_id'],
  },
  [NodeTypes.MEETING]: {
    required: ['date'],
    optional: ['name', 'time', 'topic', 'duration_minutes', 'attendees', 'entity_id'],
  },
  [NodeTypes.TOPIC]: {
    required: ['name'],
    optional: ['category', 'description', 'entity_id'],
  },
  [NodeTypes.TECHNOLOGY]: {
    required: ['name'],
    optional: ['version', 'category', 'entity_id'],
  },
  [NodeTypes.LOCATION]: {
    required: ['name'],
    optional: ['address', 'city', 'country', 'entity_id'],
  },
  [NodeTypes.ORGANIZATION]: {
    required: ['name'],
    optional: ['industry', 'website', 'entity_id'],
  },
};

/**
 * Validate a node object against its schema
 *
 * @param {string} nodeType - Node type (Person, Project, etc.)
 * @param {Object} properties - Node properties
 * @returns {{valid: boolean, errors: Array<string>}}
 */
export function validateNode(nodeType, properties) {
  const errors = [];

  // Check if node type is valid
  if (!Object.values(NodeTypes).includes(nodeType)) {
    errors.push(`Invalid node type: ${nodeType}`);
    return { valid: false, errors };
  }

  const schema = NodeSchemas[nodeType];

  // Check required fields
  for (const field of schema.required) {
    if (!properties[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check for unknown fields
  const allFields = [...schema.required, ...schema.optional, 'user_id'];
  for (const field of Object.keys(properties)) {
    if (!allFields.includes(field)) {
      errors.push(`Unknown field: ${field}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Normalize node properties (type coercion, defaults)
 *
 * @param {string} nodeType - Node type
 * @param {Object} properties - Raw properties
 * @returns {Object} Normalized properties
 */
export function normalizeNodeProperties(nodeType, properties) {
  const normalized = { ...properties };

  // Common normalizations
  if (normalized.name) {
    normalized.name = String(normalized.name).trim();
  }

  // Type-specific normalizations
  switch (nodeType) {
    case NodeTypes.PERSON:
      if (normalized.email) {
        normalized.email = String(normalized.email).toLowerCase().trim();
      }
      break;

    case NodeTypes.PROJECT:
      if (normalized.status && !['active', 'completed', 'paused'].includes(normalized.status)) {
        normalized.status = 'active'; // Default
      }
      if (normalized.technologies && !Array.isArray(normalized.technologies)) {
        normalized.technologies = [normalized.technologies];
      }
      break;

    case NodeTypes.MEETING:
      if (normalized.duration_minutes) {
        normalized.duration_minutes = parseInt(normalized.duration_minutes, 10);
      }
      if (normalized.attendees && !Array.isArray(normalized.attendees)) {
        normalized.attendees = [normalized.attendees];
      }
      break;

    case NodeTypes.TECHNOLOGY:
      if (normalized.category && !['language', 'framework', 'tool', 'database'].includes(normalized.category)) {
        normalized.category = 'tool'; // Default
      }
      break;

    case NodeTypes.TOPIC:
      if (normalized.category && !['work', 'personal', 'idea', 'other'].includes(normalized.category)) {
        normalized.category = 'other'; // Default
      }
      break;
  }

  return normalized;
}

/**
 * Create a node object from extracted entity data
 *
 * @param {Object} entity - Entity from Feature 005 extraction
 * @returns {Object} {nodeType, properties}
 */
export function entityToNode(entity) {
  // Map entity type to node type
  const nodeType = entity.entity_type;

  if (!Object.values(NodeTypes).includes(nodeType)) {
    throw new Error(`Unsupported entity type: ${entity.entity_type}`);
  }

  // Extract properties
  const properties = {
    entity_id: entity.entity_id,
    name: entity.name || entity.entity_value,
    ...entity.properties,
  };

  // Normalize properties
  const normalized = normalizeNodeProperties(nodeType, properties);

  // Validate
  const validation = validateNode(nodeType, normalized);
  if (!validation.valid) {
    throw new Error(`Invalid node: ${validation.errors.join(', ')}`);
  }

  return {
    nodeType,
    properties: normalized,
  };
}

/**
 * Check if entity type is supported
 *
 * @param {string} entityType - Entity type string
 * @returns {boolean}
 */
export function isValidNodeType(entityType) {
  return Object.values(NodeTypes).includes(entityType);
}
