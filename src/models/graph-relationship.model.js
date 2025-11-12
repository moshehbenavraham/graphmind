/**
 * Graph Relationship Model
 *
 * Defines valid relationship types and their schemas for FalkorDB edges.
 * Validates relationship data before creating in the knowledge graph.
 *
 * @module models/graph-relationship.model
 */

/**
 * Valid relationship types
 */
export const RelationshipTypes = {
  WORKED_WITH: 'WORKED_WITH',       // Person <-> Person
  WORKS_ON: 'WORKS_ON',             // Person -> Project
  ATTENDED: 'ATTENDED',             // Person -> Meeting
  DISCUSSED: 'DISCUSSED',           // Meeting -> Topic
  USES_TECHNOLOGY: 'USES_TECHNOLOGY', // Project -> Technology
  LOCATED_AT: 'LOCATED_AT',         // Entity -> Location
  OWNS: 'OWNS',                     // Person -> Project
  MENTIONED_IN: 'MENTIONED_IN',     // Entity -> VoiceNote (virtual, in D1)
};

/**
 * Relationship property schemas
 */
export const RelationshipSchemas = {
  [RelationshipTypes.WORKED_WITH]: {
    optional: ['strength', 'first_mentioned', 'context'],
    bidirectional: true,
  },
  [RelationshipTypes.WORKS_ON]: {
    optional: ['role', 'since', 'status'],
    bidirectional: false,
  },
  [RelationshipTypes.ATTENDED]: {
    optional: ['role', 'duration'],
    bidirectional: false,
  },
  [RelationshipTypes.DISCUSSED]: {
    optional: ['duration_mentioned', 'importance'],
    bidirectional: false,
  },
  [RelationshipTypes.USES_TECHNOLOGY]: {
    optional: ['version_used', 'purpose'],
    bidirectional: false,
  },
  [RelationshipTypes.LOCATED_AT]: {
    optional: ['relationship_type', 'since'],
    bidirectional: false,
  },
  [RelationshipTypes.OWNS]: {
    optional: ['ownership_type', 'since'],
    bidirectional: false,
  },
};

/**
 * Valid node type combinations for each relationship
 */
export const ValidRelationshipCombinations = {
  [RelationshipTypes.WORKED_WITH]: [
    ['Person', 'Person'],
  ],
  [RelationshipTypes.WORKS_ON]: [
    ['Person', 'Project'],
  ],
  [RelationshipTypes.ATTENDED]: [
    ['Person', 'Meeting'],
  ],
  [RelationshipTypes.DISCUSSED]: [
    ['Meeting', 'Topic'],
    ['Meeting', 'Project'],
  ],
  [RelationshipTypes.USES_TECHNOLOGY]: [
    ['Project', 'Technology'],
  ],
  [RelationshipTypes.LOCATED_AT]: [
    ['Person', 'Location'],
    ['Meeting', 'Location'],
    ['Organization', 'Location'],
  ],
  [RelationshipTypes.OWNS]: [
    ['Person', 'Project'],
  ],
};

/**
 * Validate a relationship
 *
 * @param {string} relType - Relationship type
 * @param {string} fromNodeType - Source node type
 * @param {string} toNodeType - Target node type
 * @param {Object} properties - Relationship properties
 * @returns {{valid: boolean, errors: Array<string>}}
 */
export function validateRelationship(relType, fromNodeType, toNodeType, properties = {}) {
  const errors = [];

  // Check if relationship type is valid
  if (!Object.values(RelationshipTypes).includes(relType)) {
    errors.push(`Invalid relationship type: ${relType}`);
    return { valid: false, errors };
  }

  // Check if node type combination is valid
  const validCombos = ValidRelationshipCombinations[relType];
  const comboValid = validCombos.some(
    ([from, to]) =>
      (from === fromNodeType && to === toNodeType) ||
      (RelationshipSchemas[relType].bidirectional && from === toNodeType && to === fromNodeType)
  );

  if (!comboValid) {
    errors.push(`Invalid node combination for ${relType}: ${fromNodeType} -> ${toNodeType}`);
  }

  // Check for unknown properties
  const schema = RelationshipSchemas[relType];
  for (const field of Object.keys(properties)) {
    if (!schema.optional.includes(field)) {
      errors.push(`Unknown property: ${field}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Normalize relationship properties
 *
 * @param {string} relType - Relationship type
 * @param {Object} properties - Raw properties
 * @returns {Object} Normalized properties
 */
export function normalizeRelationshipProperties(relType, properties) {
  const normalized = { ...properties };

  switch (relType) {
    case RelationshipTypes.WORKED_WITH:
      if (normalized.strength) {
        normalized.strength = parseInt(normalized.strength, 10) || 1;
      } else {
        normalized.strength = 1; // Default
      }
      break;

    case RelationshipTypes.WORKS_ON:
      if (normalized.role && !['lead', 'contributor', 'owner'].includes(normalized.role)) {
        normalized.role = 'contributor'; // Default
      }
      break;

    case RelationshipTypes.ATTENDED:
      if (normalized.role && !['organizer', 'participant', 'speaker'].includes(normalized.role)) {
        normalized.role = 'participant'; // Default
      }
      break;

    case RelationshipTypes.USES_TECHNOLOGY:
      if (normalized.purpose && !['backend', 'frontend', 'database', 'devops', 'other'].includes(normalized.purpose)) {
        normalized.purpose = 'other'; // Default
      }
      break;

    case RelationshipTypes.LOCATED_AT:
      if (normalized.relationship_type && !['lives_in', 'works_at', 'happened_at', 'based_in'].includes(normalized.relationship_type)) {
        normalized.relationship_type = 'based_in'; // Default
      }
      break;

    case RelationshipTypes.OWNS:
      if (normalized.ownership_type && !['creator', 'maintainer', 'owner'].includes(normalized.ownership_type)) {
        normalized.ownership_type = 'owner'; // Default
      }
      break;
  }

  return normalized;
}

/**
 * Create a relationship object
 *
 * @param {string} fromEntityId - Source entity ID
 * @param {string} toEntityId - Target entity ID
 * @param {string} relType - Relationship type
 * @param {string} fromNodeType - Source node type
 * @param {string} toNodeType - Target node type
 * @param {Object} properties - Relationship properties
 * @returns {Object} Relationship object
 */
export function createRelationship(fromEntityId, toEntityId, relType, fromNodeType, toNodeType, properties = {}) {
  // Validate
  const validation = validateRelationship(relType, fromNodeType, toNodeType, properties);
  if (!validation.valid) {
    throw new Error(`Invalid relationship: ${validation.errors.join(', ')}`);
  }

  // Normalize properties
  const normalized = normalizeRelationshipProperties(relType, properties);

  return {
    fromEntityId,
    toEntityId,
    relType,
    properties: normalized,
  };
}

/**
 * Check if relationship type is valid
 *
 * @param {string} relType - Relationship type string
 * @returns {boolean}
 */
export function isValidRelationshipType(relType) {
  return Object.values(RelationshipTypes).includes(relType);
}

/**
 * Check if relationship is bidirectional
 *
 * @param {string} relType - Relationship type
 * @returns {boolean}
 */
export function isBidirectional(relType) {
  return RelationshipSchemas[relType]?.bidirectional || false;
}
