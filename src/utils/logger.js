/**
 * Structured Logging Utility
 *
 * Provides standardized logging with context for all GraphMind services.
 * Supports performance monitoring, error tracking, and request correlation.
 *
 * Log Levels:
 * - DEBUG: Detailed diagnostic information
 * - INFO: General informational messages
 * - WARN: Warning messages for potentially harmful situations
 * - ERROR: Error events that might still allow the application to continue
 * - FATAL: Severe error events that will lead to application abort
 *
 * @module utils/logger
 */

/**
 * Log levels
 */
export const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  FATAL: 'FATAL'
};

/**
 * Performance timing utility
 */
class PerformanceTimer {
  constructor(label) {
    this.label = label;
    this.startTime = Date.now();
  }

  end() {
    const duration = Date.now() - this.startTime;
    return duration;
  }
}

/**
 * Structured logger with context support
 */
export class Logger {
  /**
   * Create a logger instance
   * @param {string} component - Component name (e.g., 'VoiceSessionManager', 'API:StartRecording')
   * @param {Object} context - Base context (user_id, session_id, etc.)
   */
  constructor(component, context = {}) {
    this.component = component;
    this.baseContext = context;
  }

  /**
   * Create child logger with additional context
   * @param {Object} additionalContext - Additional context to merge
   * @returns {Logger} New logger instance
   */
  child(additionalContext) {
    return new Logger(this.component, {
      ...this.baseContext,
      ...additionalContext
    });
  }

  /**
   * Format log message with context
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   * @returns {Object} Formatted log object
   */
  _formatLog(level, message, data = {}) {
    return {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      message,
      ...this.baseContext,
      ...data
    };
  }

  /**
   * Write log to console
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  _write(level, message, data = {}) {
    const log = this._formatLog(level, message, data);
    const logString = JSON.stringify(log);

    // Use appropriate console method based on level
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logString);
        break;
      case LogLevel.INFO:
        console.log(logString);
        break;
      case LogLevel.WARN:
        console.warn(logString);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(logString);
        break;
      default:
        console.log(logString);
    }
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  debug(message, data = {}) {
    this._write(LogLevel.DEBUG, message, data);
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  info(message, data = {}) {
    this._write(LogLevel.INFO, message, data);
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  warn(message, data = {}) {
    this._write(LogLevel.WARN, message, data);
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {Error|Object} error - Error object or additional data
   */
  error(message, error = {}) {
    const data = error instanceof Error
      ? {
          error_message: error.message,
          error_stack: error.stack,
          error_name: error.name
        }
      : error;

    this._write(LogLevel.ERROR, message, data);
  }

  /**
   * Log fatal error message
   * @param {string} message - Log message
   * @param {Error|Object} error - Error object or additional data
   */
  fatal(message, error = {}) {
    const data = error instanceof Error
      ? {
          error_message: error.message,
          error_stack: error.stack,
          error_name: error.name
        }
      : error;

    this._write(LogLevel.FATAL, message, data);
  }

  /**
   * Start performance timer
   * @param {string} label - Timer label
   * @returns {PerformanceTimer} Timer instance
   */
  startTimer(label) {
    return new PerformanceTimer(label);
  }

  /**
   * Log performance timing
   * @param {string} label - Timer label
   * @param {number} duration - Duration in milliseconds
   * @param {Object} data - Additional data
   */
  timing(label, duration, data = {}) {
    this.info(`Performance: ${label}`, {
      timing_label: label,
      duration_ms: duration,
      ...data
    });
  }

  /**
   * Log performance metric from timer
   * @param {PerformanceTimer} timer - Timer instance
   * @param {Object} data - Additional data
   */
  endTimer(timer, data = {}) {
    const duration = timer.end();
    this.timing(timer.label, duration, data);
    return duration;
  }
}

/**
 * Create a logger instance for a component
 * @param {string} component - Component name
 * @param {Object} context - Base context
 * @returns {Logger} Logger instance
 */
export function createLogger(component, context = {}) {
  return new Logger(component, context);
}

/**
 * Default logger without component context
 */
export const logger = new Logger('GraphMind');
