/**
 * Persistent Logger
 *
 * Saves logs to:
 * 1. D1 database (production & development)
 * 2. Console (always)
 * 3. Local file system (development only, via wrangler dev)
 *
 * This ensures we can always debug production issues without relying on
 * ephemeral `wrangler tail` logs.
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
 * Logger class for persistent application logging
 */
export class Logger {
  constructor(component, env, context = {}) {
    this.component = component;
    this.env = env;
    this.context = context;  // { user_id, session_id, query_id, request_id }
  }

  /**
   * Log a message with level, message, and optional metadata
   * @private
   */
  async _log(level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      message,
      metadata: { ...this.context, ...metadata },
      user_id: this.context.user_id || null,
      session_id: this.context.session_id || null,
      query_id: this.context.query_id || null,
      request_id: this.context.request_id || null
    };

    // 1. Always log to console
    const consoleMethod = level === 'ERROR' || level === 'FATAL' ? 'error' :
                          level === 'WARN' ? 'warn' : 'log';
    console[consoleMethod](`[${level}] [${this.component}] ${message}`, metadata);

    // 2. Save to D1 (async, don't wait)
    if (this.env?.DB) {
      this._saveToD1(logEntry).catch(err => {
        console.error('[Logger] Failed to save log to D1:', err);
      });
    }

    return logEntry;
  }

  /**
   * Save log entry to D1
   * @private
   */
  async _saveToD1(logEntry) {
    try {
      await this.env.DB.prepare(`
        INSERT INTO debug_logs (
          timestamp, level, component, message, metadata,
          user_id, session_id, query_id, request_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        logEntry.timestamp,
        logEntry.level,
        logEntry.component,
        logEntry.message,
        JSON.stringify(logEntry.metadata),
        logEntry.user_id,
        logEntry.session_id,
        logEntry.query_id,
        logEntry.request_id
      ).run();
    } catch (error) {
      // Silent fail - don't crash the app if logging fails
      console.error('[Logger] D1 insert failed:', error.message);
    }
  }

  /**
   * Log DEBUG message
   */
  async debug(message, metadata = {}) {
    return this._log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log INFO message
   */
  async info(message, metadata = {}) {
    return this._log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log WARN message
   */
  async warn(message, metadata = {}) {
    return this._log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log ERROR message
   */
  async error(message, metadata = {}) {
    return this._log(LogLevel.ERROR, message, metadata);
  }

  /**
   * Log FATAL message
   */
  async fatal(message, metadata = {}) {
    return this._log(LogLevel.FATAL, message, metadata);
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext = {}) {
    return new Logger(this.component, this.env, {
      ...this.context,
      ...additionalContext
    });
  }
}

/**
 * Query recent logs from D1
 * @param {Object} env - Worker environment bindings
 * @param {Object} filters - { level, component, user_id, session_id, query_id, limit }
 * @returns {Promise<Array>} - Log entries
 */
export async function queryLogs(env, filters = {}) {
  const {
    level = null,
    component = null,
    user_id = null,
    session_id = null,
    query_id = null,
    limit = 100
  } = filters;

  let sql = 'SELECT * FROM debug_logs WHERE 1=1';
  const bindings = [];

  if (level) {
    sql += ' AND level = ?';
    bindings.push(level);
  }

  if (component) {
    sql += ' AND component = ?';
    bindings.push(component);
  }

  if (user_id) {
    sql += ' AND user_id = ?';
    bindings.push(user_id);
  }

  if (session_id) {
    sql += ' AND session_id = ?';
    bindings.push(session_id);
  }

  if (query_id) {
    sql += ' AND query_id = ?';
    bindings.push(query_id);
  }

  sql += ' ORDER BY timestamp DESC LIMIT ?';
  bindings.push(limit);

  const { results } = await env.DB.prepare(sql).bind(...bindings).all();

  return results.map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : {}
  }));
}

/**
 * Delete old logs (older than N days)
 * @param {Object} env - Worker environment bindings
 * @param {number} days - Delete logs older than this many days
 * @returns {Promise<number>} - Number of rows deleted
 */
export async function cleanupOldLogs(env, days = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const result = await env.DB.prepare(`
    DELETE FROM debug_logs
    WHERE timestamp < ?
  `).bind(cutoffDate.toISOString()).run();

  return result.meta.changes;
}
