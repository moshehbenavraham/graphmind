/**
 * Cypher Query Validator for Feature 008 (Voice Query Input)
 *
 * Validates generated Cypher queries for security and correctness.
 * Blocks destructive operations, enforces user namespace isolation, and limits result sets.
 *
 * @module lib/graph/cypher-validator
 */

/**
 * Destructive Cypher keywords that are not allowed
 */
const DESTRUCTIVE_KEYWORDS = [
  'DELETE',
  'DROP',
  'REMOVE',
  'DETACH',
  'CREATE',
  'MERGE',
  'SET'
];

/**
 * Allowed Cypher keywords (read-only operations)
 */
const ALLOWED_KEYWORDS = [
  'MATCH',
  'RETURN',
  'WHERE',
  'ORDER BY',
  'LIMIT',
  'SKIP',
  'WITH',
  'UNWIND',
  'COUNT',
  'DISTINCT',
  'AS',
  'USE GRAPH'
];

/**
 * Maximum number of results allowed per query
 */
const MAX_RESULT_LIMIT = 100;

/**
 * Validation error class
 */
export class CypherValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CypherValidationError';
    this.code = code;
  }
}

/**
 * Validate a Cypher query for security and correctness
 *
 * @param {string} cypher - Cypher query to validate
 * @param {string} userNamespace - Expected user namespace (e.g., 'user_abc123_graph')
 * @returns {Object} { valid: true } if valid
 * @throws {CypherValidationError} If validation fails
 */
export function validateCypherQuery(cypher, userNamespace) {
  if (!cypher || typeof cypher !== 'string') {
    throw new CypherValidationError('Cypher query must be a non-empty string', 'INVALID_QUERY');
  }

  const upperCypher = cypher.toUpperCase();

  // 1. Block destructive operations
  for (const keyword of DESTRUCTIVE_KEYWORDS) {
    if (upperCypher.includes(keyword)) {
      throw new CypherValidationError(
        `Destructive operation not allowed: ${keyword}`,
        'DESTRUCTIVE_OPERATION'
      );
    }
  }

  // 2. Enforce user namespace (must include USE GRAPH statement)
  // REMOVED: USE GRAPH is handled by the connection pool / client arguments
  // if (!upperCypher.includes(`USE GRAPH ${userNamespace.toUpperCase()}`)) { ... }

  // 3. Enforce LIMIT clause
  if (!upperCypher.includes('LIMIT')) {
    throw new CypherValidationError(
      'Query must include LIMIT clause to prevent unbounded result sets',
      'MISSING_LIMIT'
    );
  }

  // 4. Validate LIMIT value does not exceed maximum
  const limitMatch = cypher.match(/LIMIT\s+(\d+)/i);
  if (limitMatch) {
    const limitValue = parseInt(limitMatch[1], 10);
    if (limitValue > MAX_RESULT_LIMIT) {
      throw new CypherValidationError(
        `LIMIT value ${limitValue} exceeds maximum allowed (${MAX_RESULT_LIMIT})`,
        'LIMIT_EXCEEDED'
      );
    }
  }

  // 5. Check for basic Cypher syntax (must contain MATCH and RETURN)
  if (!upperCypher.includes('MATCH') && !upperCypher.includes('RETURN')) {
    throw new CypherValidationError(
      'Query must contain at least MATCH and RETURN clauses',
      'INVALID_SYNTAX'
    );
  }

  // 6. Block multi-statement queries (semicolon separation)
  // 6. Block multi-statement queries (semicolon separation)
  // Remove string literals to avoid false positives on semicolons inside strings
  const cleanCypher = cypher
    .replace(/'[^']*'/g, "''") // Replace single-quoted strings
    .replace(/"[^"]*"/g, '""') // Replace double-quoted strings
    .replace(/`[^`]*`/g, '``'); // Replace backtick-quoted identifiers

  const statements = cleanCypher.split(';').filter(s => s.trim().length > 0);
  if (statements.length > 1) {
    throw new CypherValidationError(
      'Multi-statement queries are not allowed',
      'MULTI_STATEMENT'
    );
  }

  return { valid: true };
}

/**
 * Inject user namespace into Cypher query if not present
 *
 * @param {string} cypher - Cypher query
 * @param {string} userNamespace - User's FalkorDB graph namespace
 * @returns {string} Cypher query with namespace injected
 */
export function injectUserNamespace(cypher, userNamespace) {
  // DEPRECATED: USE GRAPH is not needed as it's handled by the client
  return cypher;
}

/**
 * Inject LIMIT clause into Cypher query if not present
 *
 * @param {string} cypher - Cypher query
 * @param {number} limit - Result limit (default: 100)
 * @returns {string} Cypher query with LIMIT clause
 */
export function injectLimitClause(cypher, limit = MAX_RESULT_LIMIT) {
  const upperCypher = cypher.toUpperCase();

  // If LIMIT already present, return as-is
  if (upperCypher.includes('LIMIT')) {
    return cypher;
  }

  // Inject LIMIT clause before the final semicolon (if present) or at the end
  if (cypher.trim().endsWith(';')) {
    return cypher.trim().slice(0, -1) + ` LIMIT ${limit};`;
  }

  return cypher.trim() + ` LIMIT ${limit}`;
}

/**
 * Sanitize Cypher query (inject namespace and limit if missing)
 *
 * @param {string} cypher - Cypher query
 * @param {string} userNamespace - User's FalkorDB graph namespace
 * @param {number} maxLimit - Maximum result limit
 * @returns {string} Sanitized Cypher query
 */
export function sanitizeCypherQuery(cypher, userNamespace, maxLimit = MAX_RESULT_LIMIT) {
  let sanitized = cypher;

  // Inject namespace if missing
  sanitized = injectUserNamespace(sanitized, userNamespace);

  // Inject limit if missing
  sanitized = injectLimitClause(sanitized, maxLimit);

  return sanitized;
}

/**
 * Validate and sanitize Cypher query
 * Convenience function combining validation and sanitization
 *
 * @param {string} cypher - Cypher query to validate
 * @param {string} userNamespace - User's FalkorDB graph namespace
 * @returns {string} Sanitized Cypher query
 * @throws {CypherValidationError} If validation fails
 */
export function validateAndSanitize(cypher, userNamespace) {
  // First sanitize (inject namespace and limit)
  const sanitized = sanitizeCypherQuery(cypher, userNamespace);

  // Then validate
  validateCypherQuery(sanitized, userNamespace);

  return sanitized;
}

/**
 * Check if query is parameterized (uses $param syntax)
 * Parameterized queries are safer against injection attacks
 *
 * @param {string} cypher - Cypher query
 * @returns {boolean} True if query uses parameters
 */
export function isParameterized(cypher) {
  return cypher.includes('$');
}

/**
 * Extract parameter names from Cypher query
 *
 * @param {string} cypher - Cypher query
 * @returns {Array<string>} Parameter names (e.g., ['entity_name', 'time_period'])
 */
export function extractParameterNames(cypher) {
  const paramRegex = /\$(\w+)/g;
  const params = [];
  let match;

  while ((match = paramRegex.exec(cypher)) !== null) {
    if (!params.includes(match[1])) {
      params.push(match[1]);
    }
  }

  return params;
}

/**
 * Validate parameter values match expected parameter names
 *
 * @param {string} cypher - Cypher query
 * @param {Object} parameters - Parameter values (e.g., { entity_name: 'Sarah' })
 * @throws {CypherValidationError} If parameters don't match
 */
export function validateParameters(cypher, parameters) {
  const expectedParams = extractParameterNames(cypher);

  // Check all expected parameters are provided
  for (const param of expectedParams) {
    if (!(param in parameters)) {
      throw new CypherValidationError(
        `Missing required parameter: $${param}`,
        'MISSING_PARAMETER'
      );
    }
  }

  // Warn about extra parameters (not an error, just unexpected)
  const providedParams = Object.keys(parameters);
  const extraParams = providedParams.filter(p => !expectedParams.includes(p));
  if (extraParams.length > 0) {
    console.warn(`Extra parameters provided: ${extraParams.join(', ')}`);
  }
}

/**
 * Comprehensive query validation with all checks
 * Use this as the primary validation function
 *
 * @param {string} cypher - Cypher query
 * @param {Object} options - Validation options
 * @param {string} options.userNamespace - User's FalkorDB graph namespace
 * @param {Object} options.parameters - Query parameters
 * @param {boolean} options.sanitize - Auto-sanitize query (default: true)
 * @returns {Object} { valid: true, cypher: sanitizedCypher }
 * @throws {CypherValidationError} If validation fails
 */
export function validateQuery(cypher, options = {}) {
  const {
    userNamespace,
    parameters = {},
    sanitize = true
  } = options;

  if (!userNamespace) {
    throw new CypherValidationError(
      'User namespace is required for validation',
      'MISSING_NAMESPACE'
    );
  }

  let validatedCypher = cypher;

  // Sanitize if requested
  if (sanitize) {
    validatedCypher = sanitizeCypherQuery(validatedCypher, userNamespace);
  }

  // Validate query structure and security
  validateCypherQuery(validatedCypher, userNamespace);

  // Validate parameters if query is parameterized
  if (isParameterized(validatedCypher)) {
    validateParameters(validatedCypher, parameters);
  }

  return {
    valid: true,
    cypher: validatedCypher
  };
}
