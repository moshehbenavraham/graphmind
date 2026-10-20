/**
 * Error Response Utilities
 *
 * Provides standardized error response formatting for all API endpoints.
 *
 * Error Response Format:
 * {
 *   error: {
 *     message: "Human-readable error message",
 *     code: "ERROR_CODE",
 *     details: {}  // Optional additional context
 *   }
 * }
 */

/**
 * Common error codes
 */
export const ErrorCodes = {
  // Client Errors (4xx)
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_NODE_TYPE: 'INVALID_NODE_TYPE',
  INVALID_PROPERTIES: 'INVALID_PROPERTIES',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  RATE_LIMITED: 'RATE_LIMITED',

  // Server Errors (5xx)
  SERVER_ERROR: 'SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NODE_CREATION_FAILED: 'NODE_CREATION_FAILED',
  NODE_UPDATE_FAILED: 'NODE_UPDATE_FAILED',
  NODE_DELETION_FAILED: 'NODE_DELETION_FAILED',
  RELATIONSHIP_CREATION_FAILED: 'RELATIONSHIP_CREATION_FAILED',
  QUERY_EXECUTION_FAILED: 'QUERY_EXECUTION_FAILED'
};

/**
 * Create standardized error response
 *
 * @param {string} message - Human-readable error message
 * @param {string} code - Error code from ErrorCodes
 * @param {number} status - HTTP status code
 * @param {Object|null} [details] - Optional additional error context
 * @returns {Response} JSON response with error
 */
export function errorResponse(message, code, status, details = null) {
  const body = {
    error: {
      message,
      code
    }
  };

  // Add details if provided
  if (details) {
    body.error.details = details;
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

/**
 * 400 Bad Request - Invalid input
 *
 * @param {string} message - Error message
 * @param {Object|null} [details] - Optional error details
 * @returns {Response} 400 Bad Request response
 */
export function badRequestError(message, details = null) {
  return errorResponse(
    message,
    ErrorCodes.INVALID_INPUT,
    400,
    details
  );
}

/**
 * 401 Unauthorized - Authentication required or failed
 */
export function unauthorizedError(message = 'Authentication required') {
  return errorResponse(
    message,
    ErrorCodes.UNAUTHORIZED,
    401
  );
}

/**
 * 403 Forbidden - Authenticated but insufficient permissions
 */
export function forbiddenError(message = 'Access denied') {
  return errorResponse(
    message,
    ErrorCodes.FORBIDDEN,
    403
  );
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export function notFoundError(message = 'Resource not found') {
  return errorResponse(
    message,
    ErrorCodes.NOT_FOUND,
    404
  );
}

/**
 * 409 Conflict - Duplicate resource
 */
export function conflictError(message) {
  return errorResponse(
    message,
    ErrorCodes.DUPLICATE_EMAIL,
    409
  );
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 *
 * @param {string} message - Error message
 * @param {number} retryAfter - Seconds until retry allowed
 * @returns {Response} Error response with Retry-After header
 */
export function rateLimitError(message, retryAfter) {
  const response = errorResponse(
    message,
    ErrorCodes.RATE_LIMITED,
    429,
    { retry_after_seconds: retryAfter }
  );

  // Add Retry-After header
  response.headers.set('Retry-After', retryAfter.toString());

  return response;
}

/**
 * 500 Internal Server Error - Generic server error
 */
export function internalServerError(message = 'Internal server error') {
  return errorResponse(
    message,
    ErrorCodes.SERVER_ERROR,
    500
  );
}

/**
 * 503 Service Unavailable - Temporary outage
 *
 * @param {string} message - Error message
 * @param {number} [retryAfter] - Optional seconds until service available
 */
export function serviceUnavailableError(message = 'Service temporarily unavailable', retryAfter = 30) {
  const response = errorResponse(
    message,
    ErrorCodes.SERVICE_UNAVAILABLE,
    503
  );

  if (retryAfter) {
    response.headers.set('Retry-After', retryAfter.toString());
  }

  return response;
}

/**
 * Handle validation errors from validation utilities
 *
 * Converts validation error array to user-friendly response.
 *
 * @param {Array<string>} errors - Array of validation error messages
 * @returns {Response} 400 Bad Request with error details
 */
export function validationError(errors) {
  return badRequestError(
    'Validation failed',
    { validation_errors: errors }
  );
}

/**
 * Database/Query error - For database operations that fail
 *
 * @param {string} message - Error message
 * @param {Object} [details] - Additional error context
 * @returns {Response} 500 Internal Server Error with database error code
 */
export function databaseError(message = 'Database operation failed', details = null) {
  return errorResponse(
    message,
    ErrorCodes.DATABASE_ERROR,
    500,
    details
  );
}

/**
 * Create error with custom code
 *
 * Allows using error codes not in the predefined ErrorCodes enum.
 *
 * @param {string} message - Error message
 * @param {string} code - Custom error code
 * @param {number} status - HTTP status code
 * @param {Object} [details] - Additional error context
 * @returns {Response} Error response
 */
export function customError(message, code, status, details = null) {
  return errorResponse(message, code, status, details);
}
