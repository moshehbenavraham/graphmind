/**
 * Common TypeScript type definitions for GraphMind
 *
 * These types are available globally and can be used in JSDoc annotations.
 */

/**
 * Error with an optional code property
 * Use this when catching errors that may have a code (like Node.js errors)
 */
interface ErrorWithCode extends Error {
  code?: string;
  originalError?: Error;
}

/**
 * Logger interface used across services
 */
interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

/**
 * Authenticated request with user context
 */
interface AuthenticatedRequest extends Request {
  user?: {
    user_id: string;
    email: string;
    falkordb_namespace: string;
  };
  userId?: string;
}
