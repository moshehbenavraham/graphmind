/**
 * FalkorDB Error Normalization
 *
 * Maps FalkorDB/Redis errors to consistent HTTP status codes and error messages.
 * Provides clear, actionable error messages for troubleshooting.
 *
 * @module lib/falkordb/errors
 */

/**
 * Error types and their HTTP status codes
 */
const ERROR_MAPPINGS = {
  // Connection errors
  ECONNREFUSED: { status: 503, message: 'Database connection refused - check host and port' },
  ETIMEDOUT: { status: 504, message: 'Database connection timeout - database may be unreachable' },
  ENOTFOUND: { status: 503, message: 'Database host not found - check FALKORDB_HOST configuration' },
  ECONNRESET: { status: 503, message: 'Database connection reset - connection was interrupted' },

  // Authentication errors
  NOAUTH: { status: 401, message: 'Authentication required - check FALKORDB_PASSWORD' },
  WRONGPASS: { status: 401, message: 'Invalid credentials - check FALKORDB_USER and FALKORDB_PASSWORD' },
  NOPERM: { status: 403, message: 'Insufficient permissions - user lacks required privileges' },

  // Query errors
  SYNTAX_ERROR: { status: 400, message: 'Invalid Cypher query syntax' },
  CONSTRAINT_VIOLATION: { status: 409, message: 'Query violates graph constraints' },
  READONLY: { status: 403, message: 'Database is in read-only mode' },

  // Resource errors
  OOM: { status: 507, message: 'Database out of memory - reduce query complexity or upgrade plan' },
  MAXCLIENTS: { status: 503, message: 'Maximum client connections reached - connection pool exhausted' },
  LOADING: { status: 503, message: 'Database is loading - try again in a moment' },

  // Graph-specific errors
  GRAPH_NOT_FOUND: { status: 404, message: 'Graph database not found - namespace may not be initialized' },
  INDEX_ERROR: { status: 400, message: 'Graph index error' },
};

/**
 * Normalize FalkorDB error to consistent format
 *
 * @param {Error} error - Original error from FalkorDB/Redis
 * @param {Object} [context={}] - Additional context for error message
 * @returns {Error} Normalized error with httpStatus property
 *
 * @example
 * try {
 *   await client.connect();
 * } catch (error) {
 *   const normalized = normalizeError(error, { host: 'localhost', port: 6379 });
 *   return new Response(normalized.message, { status: normalized.httpStatus });
 * }
 */
export function normalizeError(error, context = {}) {
  // Check if error is already normalized (has httpStatus and originalMessage)
  // This prevents overwriting specific errors with generic ones when bubbling up
  if (error.httpStatus && error.originalMessage) {
    // Merge new context if provided
    if (context.query && !error.query) error.query = context.query;
    if (context.graphName && !error.graphName) error.graphName = context.graphName;
    return error;
  }

  // Extract error details
  const errorCode = error.code || error.name;
  const errorMessage = error.message || 'Unknown error';

  // Find matching error mapping
  let mapping = ERROR_MAPPINGS[errorCode];

  // Check for graph-specific errors in message
  if (!mapping) {
    if (errorMessage.includes('graph not found') || errorMessage.includes('Graph not found')) {
      mapping = ERROR_MAPPINGS.GRAPH_NOT_FOUND;
    } else if (errorMessage.includes('syntax error') || errorMessage.includes('Syntax error')) {
      mapping = ERROR_MAPPINGS.SYNTAX_ERROR;
    } else if (errorMessage.includes('out of memory') || errorMessage.includes('OOM')) {
      mapping = ERROR_MAPPINGS.OOM;
    }
  }

  // Default error mapping
  if (!mapping) {
    mapping = {
      status: 500,
      message: 'Database error occurred',
    };
  }

  // Create normalized error
  const normalizedError = new Error(mapping.message);
  normalizedError.httpStatus = mapping.status;
  normalizedError.code = errorCode;
  normalizedError.originalMessage = errorMessage;

  // Add context to error
  if (context.host) {
    normalizedError.host = context.host;
  }
  if (context.port) {
    normalizedError.port = context.port;
  }
  if (context.graphName) {
    normalizedError.graphName = context.graphName;
  }
  if (context.query) {
    normalizedError.query = context.query;
  }

  return normalizedError;
}

/**
 * Create a user-friendly error response for API endpoints
 *
 * @param {Error} error - Normalized error
 * @param {boolean} [includeDetails=false] - Include technical details (dev mode only)
 * @returns {Object} Error response object
 *
 * @example
 * const error = normalizeError(dbError, { host: 'db.example.com' });
 * return new Response(
 *   JSON.stringify(createErrorResponse(error, env.NODE_ENV === 'development')),
 *   { status: error.httpStatus }
 * );
 */
export function createErrorResponse(error, includeDetails = false) {
  const response = {
    error: error.message,
    status: error.httpStatus || 500,
  };

  // Include technical details in development
  if (includeDetails) {
    response.details = {
      code: error.code,
      originalMessage: error.originalMessage,
      host: error.host,
      port: error.port,
      graphName: error.graphName,
    };

    // Add query details (truncated for security)
    if (error.query) {
      response.details.query = error.query.substring(0, 100);
    }
  }

  // Add troubleshooting hints based on error type
  if (error.httpStatus === 503) {
    response.hint = 'Check database connectivity and firewall rules';
  } else if (error.httpStatus === 401) {
    response.hint = 'Verify FALKORDB_USER and FALKORDB_PASSWORD are correct';
  } else if (error.httpStatus === 404) {
    response.hint = 'User namespace may need to be initialized - call /api/graph/init';
  } else if (error.httpStatus === 507) {
    response.hint = 'Database capacity exceeded - consider upgrading FalkorDB plan';
  }

  return response;
}

/**
 * Check if error is retryable
 *
 * Some errors are temporary and can be retried with exponential backoff.
 *
 * @param {Error} error - Error to check
 * @returns {boolean} True if error is retryable
 */
export function isRetryableError(error) {
  const retryableCodes = [
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'LOADING',
    'MAXCLIENTS',
  ];

  return retryableCodes.includes(error.code);
}

/**
 * Get retry delay based on attempt number (exponential backoff)
 *
 * @param {number} attempt - Retry attempt number (1-based)
 * @param {number} [baseDelay=1000] - Base delay in ms
 * @param {number} [maxDelay=30000] - Maximum delay in ms
 * @returns {number} Delay in milliseconds
 *
 * @example
 * let attempt = 0;
 * while (attempt < 5) {
 *   try {
 *     return await connect(config);
 *   } catch (error) {
 *     if (!isRetryableError(error)) throw error;
 *     attempt++;
 *     await sleep(getRetryDelay(attempt));
 *   }
 * }
 */
export function getRetryDelay(attempt, baseDelay = 1000, maxDelay = 30000) {
  // Exponential backoff: baseDelay * 2^(attempt - 1)
  const delay = baseDelay * Math.pow(2, attempt - 1);

  // Add jitter (±20%) to prevent thundering herd
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);

  // Cap at maxDelay
  return Math.min(delay + jitter, maxDelay);
}
