/**
 * Centralized Logging Utility
 *
 * Provides structured logging for all GraphMind components.
 * Logs include context, timing, and metadata for production debugging.
 *
 * @module lib/utils/logger
 */

/**
 * Log levels
 */
export const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

/**
 * Logger class for structured logging
 */
export class Logger {
  constructor(component, context = {}) {
    this.component = component;
    this.context = context;
    this.startTime = Date.now();
  }

  /**
   * Create log entry with standard format
   */
  _createLogEntry(level, message, data = {}) {
    return {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      message,
      duration_ms: Date.now() - this.startTime,
      context: this.context,
      data,
    };
  }

  /**
   * Format log for console output
   */
  _formatLog(entry) {
    const prefix = `[${entry.component}]`;
    const timing = entry.duration_ms ? ` (${entry.duration_ms}ms)` : '';

    return {
      prefix,
      message: `${entry.message}${timing}`,
      data: entry.data,
      full: entry,
    };
  }

  /**
   * Debug log (verbose development info)
   */
  debug(message, data = {}) {
    const entry = this._createLogEntry(LogLevel.DEBUG, message, data);
    const formatted = this._formatLog(entry);
    console.debug(formatted.prefix, formatted.message, formatted.data);
    return entry;
  }

  /**
   * Info log (normal operation)
   */
  info(message, data = {}) {
    const entry = this._createLogEntry(LogLevel.INFO, message, data);
    const formatted = this._formatLog(entry);
    console.log(formatted.prefix, formatted.message, formatted.data);
    return entry;
  }

  /**
   * Warning log (non-critical issues)
   */
  warn(message, data = {}) {
    const entry = this._createLogEntry(LogLevel.WARN, message, data);
    const formatted = this._formatLog(entry);
    console.warn(formatted.prefix, formatted.message, formatted.data);
    return entry;
  }

  /**
   * Error log (critical failures)
   */
  error(message, error = null, data = {}) {
    const entry = this._createLogEntry(LogLevel.ERROR, message, {
      ...data,
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: error.code,
      } : null,
    });
    const formatted = this._formatLog(entry);
    console.error(formatted.prefix, formatted.message, formatted.data);
    return entry;
  }

  /**
   * Add context to logger (returns new logger instance)
   */
  withContext(additionalContext) {
    return new Logger(this.component, {
      ...this.context,
      ...additionalContext,
    });
  }

  /**
   * Reset start time (for operation timing)
   */
  resetTimer() {
    this.startTime = Date.now();
  }

  /**
   * Get elapsed time since logger creation or last reset
   */
  getElapsed() {
    return Date.now() - this.startTime;
  }
}

/**
 * Performance metrics tracker
 */
export class PerformanceTracker {
  constructor(operation, logger) {
    this.operation = operation;
    this.logger = logger;
    this.startTime = Date.now();
    this.checkpoints = [];
  }

  /**
   * Add checkpoint (milestone within operation)
   */
  checkpoint(name, data = {}) {
    const elapsed = Date.now() - this.startTime;
    this.checkpoints.push({
      name,
      elapsed_ms: elapsed,
      data,
    });

    if (this.logger) {
      this.logger.debug(`Checkpoint: ${name}`, { elapsed_ms: elapsed, ...data });
    }

    return elapsed;
  }

  /**
   * Complete tracking and log results
   */
  complete(success = true, data = {}) {
    const totalTime = Date.now() - this.startTime;

    const result = {
      operation: this.operation,
      success,
      total_time_ms: totalTime,
      checkpoints: this.checkpoints,
      data,
    };

    if (this.logger) {
      if (success) {
        this.logger.info(`Operation complete: ${this.operation}`, result);
      } else {
        this.logger.warn(`Operation failed: ${this.operation}`, result);
      }
    }

    return result;
  }
}

/**
 * Cache metrics tracker
 */
export class CacheMetrics {
  constructor() {
    this.hits = 0;
    this.misses = 0;
    this.errors = 0;
    this.startTime = Date.now();
  }

  /**
   * Record cache hit
   */
  recordHit(key, logger = null) {
    this.hits++;
    if (logger) {
      logger.debug('Cache hit', {
        key: key.substring(0, 50),
        hit_rate: this.getHitRate(),
      });
    }
  }

  /**
   * Record cache miss
   */
  recordMiss(key, logger = null) {
    this.misses++;
    if (logger) {
      logger.debug('Cache miss', {
        key: key.substring(0, 50),
        hit_rate: this.getHitRate(),
      });
    }
  }

  /**
   * Record cache error
   */
  recordError(key, error, logger = null) {
    this.errors++;
    if (logger) {
      logger.warn('Cache error', {
        key: key.substring(0, 50),
        error: error.message,
      });
    }
  }

  /**
   * Get cache hit rate
   */
  getHitRate() {
    const total = this.hits + this.misses;
    return total > 0 ? (this.hits / total * 100).toFixed(2) + '%' : '0%';
  }

  /**
   * Get metrics summary
   */
  getSummary() {
    return {
      hits: this.hits,
      misses: this.misses,
      errors: this.errors,
      total_requests: this.hits + this.misses,
      hit_rate: this.getHitRate(),
      uptime_ms: Date.now() - this.startTime,
    };
  }

  /**
   * Log summary
   */
  logSummary(logger) {
    logger.info('Cache metrics summary', this.getSummary());
  }
}

/**
 * API request logger with timing
 */
export class APIRequestLogger {
  constructor(request, user = null) {
    this.startTime = Date.now();
    this.request = request;
    this.user = user;

    const url = new URL(request.url);
    this.component = `API:${url.pathname}`;
    this.logger = new Logger(this.component, {
      method: request.method,
      path: url.pathname,
      userId: user?.userId,
    });
  }

  /**
   * Log request start
   */
  logStart(params = {}) {
    this.logger.info('Request started', {
      params: this._sanitizeParams(params),
    });
  }

  /**
   * Log successful response
   */
  logSuccess(statusCode, data = {}) {
    const duration = Date.now() - this.startTime;
    this.logger.info('Request completed', {
      status: statusCode,
      duration_ms: duration,
      ...data,
    });

    return {
      query_time_ms: duration,
      cached: data.cached || false,
    };
  }

  /**
   * Log error response
   */
  logError(error, statusCode = 500) {
    const duration = Date.now() - this.startTime;
    this.logger.error('Request failed', error, {
      status: statusCode,
      duration_ms: duration,
    });
  }

  /**
   * Sanitize sensitive parameters
   */
  _sanitizeParams(params) {
    const sanitized = { ...params };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Get logger instance
   */
  getLogger() {
    return this.logger;
  }
}

/**
 * Create logger for component
 */
export function createLogger(component, context = {}) {
  return new Logger(component, context);
}

/**
 * Create performance tracker
 */
export function createPerformanceTracker(operation, logger = null) {
  return new PerformanceTracker(operation, logger);
}

/**
 * Create API request logger
 */
export function createAPIRequestLogger(request, user = null) {
  return new APIRequestLogger(request, user);
}

/**
 * Global cache metrics (shared across requests)
 */
let globalCacheMetrics = null;

export function getGlobalCacheMetrics() {
  if (!globalCacheMetrics) {
    globalCacheMetrics = new CacheMetrics();
  }
  return globalCacheMetrics;
}

export function resetGlobalCacheMetrics() {
  globalCacheMetrics = new CacheMetrics();
  return globalCacheMetrics;
}
