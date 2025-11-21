/**
 * Comprehensive error handling for graph operations
 *
 * Provides standardized error responses, retry logic, and fallback behavior
 * for all graph API endpoints.
 *
 * @module lib/graph/error-handler
 */

/**
 * Error codes and their HTTP status codes
 */
export const ERROR_CODES = {
  // Client errors (4xx)
  INVALID_REQUEST: { status: 400, message: 'Invalid request parameters' },
  INVALID_NODE_TYPE: { status: 400, message: 'Invalid node type specified' },
  INVALID_PROPERTIES: { status: 400, message: 'Invalid or missing properties' },
  INVALID_RELATIONSHIP_TYPE: { status: 400, message: 'Invalid relationship type' },
  INVALID_ENTITY_ID: { status: 400, message: 'Invalid entity ID format' },
  MISSING_REQUIRED_FIELD: { status: 400, message: 'Required field is missing' },

  UNAUTHORIZED: { status: 401, message: 'Authentication required' },
  FORBIDDEN: { status: 403, message: 'Access forbidden' },

  ENTITY_NOT_FOUND: { status: 404, message: 'Entity not found' },
  NODE_NOT_FOUND: { status: 404, message: 'Node not found in graph' },
  RELATIONSHIP_NOT_FOUND: { status: 404, message: 'Relationship not found' },

  // Server errors (5xx)
  GRAPH_QUERY_FAILED: { status: 500, message: 'Graph query execution failed' },
  NODE_CREATION_FAILED: { status: 500, message: 'Failed to create node' },
  NODE_UPDATE_FAILED: { status: 500, message: 'Failed to update node' },
  NODE_DELETION_FAILED: { status: 500, message: 'Failed to delete node' },
  RELATIONSHIP_CREATION_FAILED: { status: 500, message: 'Failed to create relationship' },
  RELATIONSHIP_DELETION_FAILED: { status: 500, message: 'Failed to delete relationship' },

  FALKORDB_CONNECTION_FAILED: { status: 503, message: 'FalkorDB connection unavailable' },
  FALKORDB_TIMEOUT: { status: 504, message: 'FalkorDB query timed out' },

  CACHE_ERROR: { status: 500, message: 'Cache operation failed' },
  TRANSACTION_FAILED: { status: 500, message: 'Transaction rollback occurred' },

  INTERNAL_ERROR: { status: 500, message: 'Internal server error' },
};

/**
 * GraphError class for structured error handling
 */
export class GraphError extends Error {
  constructor(code, details = null, cause = null) {
    const errorInfo = ERROR_CODES[code] || ERROR_CODES.INTERNAL_ERROR;

    super(errorInfo.message);
    this.name = 'GraphError';
    this.code = code;
    this.status = errorInfo.status;
    this.details = details;
    this.cause = cause;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp,
      },
    };
  }

  toResponse() {
    return new Response(JSON.stringify(this.toJSON()), {
      status: this.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Detect error type from exception
 *
 * @param {Error} error - Original error
 * @returns {string} Error code
 */
export function detectErrorCode(error) {
  const errorMsg = error.message.toLowerCase();

  // Connection errors
  if (errorMsg.includes('connection') || errorMsg.includes('econnrefused') || errorMsg.includes('socket')) {
    return 'FALKORDB_CONNECTION_FAILED';
  }

  // Timeout errors
  if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
    return 'FALKORDB_TIMEOUT';
  }

  // Not found errors
  if (errorMsg.includes('not found') || errorMsg.includes('entity_not_found')) {
    return 'ENTITY_NOT_FOUND';
  }

  // Query errors
  if (errorMsg.includes('query') || errorMsg.includes('cypher')) {
    return 'GRAPH_QUERY_FAILED';
  }

  // Transaction errors
  if (errorMsg.includes('transaction') || errorMsg.includes('rollback')) {
    return 'TRANSACTION_FAILED';
  }

  return 'INTERNAL_ERROR';
}

/**
 * Handle errors with standardized response
 *
 * @param {Error} error - Original error
 * @param {string} operation - Operation being performed (for logging)
 * @param {Object} context - Additional context (userId, entityId, etc.)
 * @returns {Response} HTTP error response
 */
export function handleError(error, operation, context = {}) {
  // If already a GraphError, use it directly
  if (error instanceof GraphError) {
    console.error(`[${operation}] GraphError:`, {
      code: error.code,
      message: error.message,
      details: error.details,
      context,
    });
    return error.toResponse();
  }

  // Detect error type and create GraphError
  const errorCode = detectErrorCode(error);
  const graphError = new GraphError(
    errorCode,
    {
      operation,
      originalError: error.message,
      ...context,
    },
    error
  );

  console.error(`[${operation}] Error:`, {
    code: graphError.code,
    message: graphError.message,
    details: graphError.details,
    stack: error.stack,
  });

  return graphError.toResponse();
}

/**
 * Validate request parameters with detailed error messages
 *
 * @param {Object} params - Parameters to validate
 * @param {Object} schema - Validation schema
 * @throws {GraphError} If validation fails
 */
export function validateParams(params, schema) {
  for (const [field, rules] of Object.entries(schema)) {
    const value = params[field];

    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      throw new GraphError('MISSING_REQUIRED_FIELD', {
        field,
        message: `Field "${field}" is required`,
      });
    }

    // Type check
    if (value !== undefined && rules.type && typeof value !== rules.type) {
      throw new GraphError('INVALID_REQUEST', {
        field,
        message: `Field "${field}" must be of type ${rules.type}`,
      });
    }

    // Enum check
    if (value !== undefined && rules.enum && !rules.enum.includes(value)) {
      throw new GraphError('INVALID_REQUEST', {
        field,
        message: `Field "${field}" must be one of: ${rules.enum.join(', ')}`,
        provided: value,
      });
    }

    // Min length check
    if (value !== undefined && rules.minLength && value.length < rules.minLength) {
      throw new GraphError('INVALID_REQUEST', {
        field,
        message: `Field "${field}" must be at least ${rules.minLength} characters`,
      });
    }

    // Max length check
    if (value !== undefined && rules.maxLength && value.length > rules.maxLength) {
      throw new GraphError('INVALID_REQUEST', {
        field,
        message: `Field "${field}" must be at most ${rules.maxLength} characters`,
      });
    }

    // Pattern check
    if (value !== undefined && rules.pattern && !rules.pattern.test(value)) {
      throw new GraphError('INVALID_REQUEST', {
        field,
        message: `Field "${field}" has invalid format`,
      });
    }
  }
}

/**
 * Execute operation with retry logic for transient failures
 *
 * @param {Function} operation - Async operation to execute
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Operation result
 */
export async function executeWithRetry(operation, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    retryableErrors = ['FALKORDB_CONNECTION_FAILED', 'FALKORDB_TIMEOUT'],
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      const errorCode = error instanceof GraphError ? error.code : detectErrorCode(error);
      const isRetryable = retryableErrors.includes(errorCode);

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Log retry attempt
      console.warn(`[RetryLogic] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms...`, {
        error: error.message,
        errorCode,
      });

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));

      // Exponential backoff
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Execute operation with fallback to cached data if available
 *
 * @param {Function} operation - Primary operation
 * @param {Function} fallback - Fallback operation (returns cached data)
 * @param {Object} options - Fallback options
 * @returns {Promise<any>} Operation result or cached data
 */
export async function executeWithFallback(operation, fallback, options = {}) {
  const {
    fallbackErrors = ['FALKORDB_CONNECTION_FAILED', 'FALKORDB_TIMEOUT'],
    includeFallbackFlag = true,
  } = options;

  try {
    return await operation();
  } catch (error) {
    const errorCode = error instanceof GraphError ? error.code : detectErrorCode(error);
    const shouldFallback = fallbackErrors.includes(errorCode);

    if (!shouldFallback || !fallback) {
      throw error;
    }

    console.warn('[FallbackLogic] Primary operation failed, using fallback...', {
      error: error.message,
      errorCode,
    });

    try {
      const fallbackResult = await fallback();

      // Add flag to indicate data is from cache
      if (includeFallbackFlag && fallbackResult && typeof fallbackResult === 'object') {
        return {
          ...fallbackResult,
          _fromCache: true,
          _cacheWarning: 'FalkorDB unavailable, showing cached data',
        };
      }

      return fallbackResult;
    } catch (fallbackError) {
      console.error('[FallbackLogic] Fallback also failed:', fallbackError);
      throw error; // Throw original error
    }
  }
}

/**
 * Sanitize input to prevent injection attacks
 *
 * @param {string} input - User input
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized input
 */
export function sanitizeInput(input, options = {}) {
  const {
    maxLength = 1000,
    allowedChars = /^[a-zA-Z0-9\s\-_.,@()]+$/,
  } = options;

  if (typeof input !== 'string') {
    throw new GraphError('INVALID_REQUEST', {
      message: 'Input must be a string',
    });
  }

  // Trim whitespace
  let sanitized = input.trim();

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Check for injection attempts
  const dangerousPatterns = [
    /MATCH/i,
    /DELETE/i,
    /DROP/i,
    /DETACH/i,
    /MERGE/i,
    /CREATE/i,
    /SET/i,
    /REMOVE/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(sanitized)) {
      throw new GraphError('INVALID_REQUEST', {
        message: 'Input contains potentially dangerous patterns',
      });
    }
  }

  return sanitized;
}
