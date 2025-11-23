-- Migration: 0006_debug_logs.sql
-- Description: Create debug_logs table for persistent logging
-- Created: 2025-11-23
--
-- This migration creates the debug_logs table for storing all application logs
-- persistently so we can debug production issues without relying on wrangler tail.

-- ============================================================================
-- DEBUG_LOGS TABLE
-- ============================================================================
-- Stores all application logs with level, component, message, and metadata
CREATE TABLE IF NOT EXISTS debug_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    level TEXT NOT NULL CHECK(level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')),
    component TEXT NOT NULL,  -- e.g. 'QuerySessionManager', 'CypherGenerator', 'FalkorDB'
    message TEXT NOT NULL,
    metadata JSON,  -- Additional context as JSON
    user_id TEXT,   -- Optional: for user-specific filtering
    session_id TEXT,  -- Optional: for session-specific filtering
    query_id TEXT,    -- Optional: for query-specific filtering
    request_id TEXT   -- Optional: for request tracing
);

-- Index for efficient timestamp-based queries (most recent first)
CREATE INDEX IF NOT EXISTS idx_debug_logs_timestamp
    ON debug_logs(timestamp DESC);

-- Index for efficient level-based filtering (errors, etc.)
CREATE INDEX IF NOT EXISTS idx_debug_logs_level
    ON debug_logs(level, timestamp DESC);

-- Index for efficient component-based filtering
CREATE INDEX IF NOT EXISTS idx_debug_logs_component
    ON debug_logs(component, timestamp DESC);

-- Index for efficient user-based filtering
CREATE INDEX IF NOT EXISTS idx_debug_logs_user
    ON debug_logs(user_id, timestamp DESC);

-- Index for efficient session-based filtering
CREATE INDEX IF NOT EXISTS idx_debug_logs_session
    ON debug_logs(session_id, timestamp DESC);

-- Index for efficient query-based filtering
CREATE INDEX IF NOT EXISTS idx_debug_logs_query
    ON debug_logs(query_id, timestamp DESC);
