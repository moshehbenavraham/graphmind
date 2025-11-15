-- Migration: 0005_voice_queries.sql
-- Description: Create voice_queries table for Feature 008 (Voice Query Input)
-- Created: 2025-11-13
--
-- This migration creates the voice_queries table for storing user questions,
-- generated Cypher queries, graph results, and query metadata.

-- ============================================================================
-- VOICE_QUERIES TABLE
-- ============================================================================
-- Stores voice query sessions with questions, Cypher queries, and results
CREATE TABLE IF NOT EXISTS voice_queries (
    query_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT,
    question TEXT NOT NULL,
    cypher_query TEXT,
    graph_results JSON,
    answer TEXT DEFAULT '',  -- Empty for Feature 008, populated by Feature 009
    audio_r2_key TEXT,
    sources JSON,
    latency_ms INTEGER,
    user_rating INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

-- Index for efficient user query history retrieval (most recent first)
CREATE INDEX IF NOT EXISTS idx_queries_user_created
    ON voice_queries(user_id, created_at DESC);

-- Index for efficient session lookup
CREATE INDEX IF NOT EXISTS idx_queries_session
    ON voice_queries(session_id);
