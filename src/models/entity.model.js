/**
 * Entity Model Schema
 * Feature: 005-entity-extraction
 *
 * Defines the 7 entity types and their properties validation rules.
 * Used for validating extracted entities from LLM responses.
 */

/**
 * Entity Types
 * All entities that can be extracted from voice transcripts
 */
export const ENTITY_TYPES = {
  PERSON: 'Person',
  PROJECT: 'Project',
  MEETING: 'Meeting',
  TOPIC: 'Topic',
  TECHNOLOGY: 'Technology',
  LOCATION: 'Location',
  ORGANIZATION: 'Organization',
};

/**
 * Entity Type-Specific Property Schemas
 * Defines optional properties for each entity type
 */
export const ENTITY_PROPERTY_SCHEMAS = {
  [ENTITY_TYPES.PERSON]: {
    email: { type: 'string', optional: true },
    phone: { type: 'string', optional: true },
    role: { type: 'string', optional: true },
  },
  [ENTITY_TYPES.PROJECT]: {
    description: { type: 'string', optional: true },
    status: { type: 'string', optional: true },
    technologies: { type: 'array', optional: true },
  },
  [ENTITY_TYPES.MEETING]: {
    date: { type: 'string', optional: true },
    time: { type: 'string', optional: true },
    duration: { type: 'string', optional: true },
    topic: { type: 'string', optional: true },
    participants: { type: 'array', optional: true },
  },
  [ENTITY_TYPES.TOPIC]: {
    category: { type: 'string', optional: true },
  },
  [ENTITY_TYPES.TECHNOLOGY]: {
    version: { type: 'string', optional: true },
    category: { type: 'string', optional: true },
  },
  [ENTITY_TYPES.LOCATION]: {
    address: { type: 'string', optional: true },
    city: { type: 'string', optional: true },
    country: { type: 'string', optional: true },
  },
  [ENTITY_TYPES.ORGANIZATION]: {
    industry: { type: 'string', optional: true },
    website: { type: 'string', optional: true },
  },
};

/**
 * Base Entity Schema
 * All entities must have these fields
 */
export const BASE_ENTITY_SCHEMA = {
  type: { type: 'string', required: true, enum: Object.values(ENTITY_TYPES) },
  name: { type: 'string', required: true, minLength: 1, maxLength: 255 },
  confidence: { type: 'number', required: true, min: 0.0, max: 1.0 },
  properties: { type: 'object', required: false },
};

/**
 * Validate an extracted entity against schema
 *
 * @param {Object} entity - Entity object to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEntity(entity) {
  const errors = [];

  // Validate required base fields
  if (!entity.type || typeof entity.type !== 'string') {
    errors.push('Entity must have a valid type');
  } else if (!Object.values(ENTITY_TYPES).includes(entity.type)) {
    errors.push(`Invalid entity type: ${entity.type}. Must be one of: ${Object.values(ENTITY_TYPES).join(', ')}`);
  }

  if (!entity.name || typeof entity.name !== 'string') {
    errors.push('Entity must have a name (string)');
  } else if (entity.name.trim().length === 0) {
    errors.push('Entity name cannot be empty');
  } else if (entity.name.length > 255) {
    errors.push('Entity name cannot exceed 255 characters');
  }

  if (typeof entity.confidence !== 'number') {
    errors.push('Entity confidence must be a number');
  } else if (entity.confidence < 0.0 || entity.confidence > 1.0) {
    errors.push(`Entity confidence must be between 0.0 and 1.0, got: ${entity.confidence}`);
  }

  // Validate properties (if present)
  if (entity.properties && typeof entity.properties !== 'object') {
    errors.push('Entity properties must be an object');
  }

  // Type-specific validation
  if (entity.type && Object.values(ENTITY_TYPES).includes(entity.type)) {
    const schema = ENTITY_PROPERTY_SCHEMAS[entity.type];
    if (entity.properties && schema) {
      for (const [key, value] of Object.entries(entity.properties)) {
        if (!schema[key]) {
          // Unknown property - log warning but don't fail validation
          console.warn(`Unknown property "${key}" for entity type ${entity.type}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate an array of entities
 *
 * @param {Array} entities - Array of entity objects
 * @returns {{ valid: boolean, validEntities: Array, invalidEntities: Array }}
 */
export function validateEntities(entities) {
  if (!Array.isArray(entities)) {
    return {
      valid: false,
      validEntities: [],
      invalidEntities: [],
      errors: ['Entities must be an array'],
    };
  }

  const validEntities = [];
  const invalidEntities = [];

  entities.forEach((entity, index) => {
    const validation = validateEntity(entity);
    if (validation.valid) {
      validEntities.push(entity);
    } else {
      invalidEntities.push({
        entity,
        index,
        errors: validation.errors,
      });
    }
  });

  return {
    valid: invalidEntities.length === 0,
    validEntities,
    invalidEntities,
  };
}

/**
 * Create a new entity object with default values
 *
 * @param {string} type - Entity type
 * @param {string} name - Entity name
 * @param {number} confidence - Confidence score
 * @param {Object} properties - Optional properties
 * @returns {Object} Entity object
 */
export function createEntity(type, name, confidence, properties = {}) {
  if (!Object.values(ENTITY_TYPES).includes(type)) {
    throw new Error(`Invalid entity type: ${type}`);
  }

  return {
    type,
    name: name.trim(),
    confidence: Math.max(0.0, Math.min(1.0, confidence)),
    properties: properties || {},
  };
}

/**
 * Check if an entity type is valid
 *
 * @param {string} type - Entity type to check
 * @returns {boolean}
 */
export function isValidEntityType(type) {
  return Object.values(ENTITY_TYPES).includes(type);
}
