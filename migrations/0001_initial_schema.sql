-- Migration: 0001_initial_schema.sql
-- Description: Initial database schema for GraphMind
-- Created: 2025-11-10
--
-- This migration creates the foundational tables for user management,
-- session tracking, and voice note storage.

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- Stores user account information with isolated graph namespaces
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    falkordb_namespace TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Index for efficient email lookups during login
CREATE INDEX idx_users_email ON users(email);

-- ============================================================================
-- SESSIONS TABLE
-- ============================================================================
-- Tracks user sessions (JWT, WebSocket, voice capture, etc.)
CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_type TEXT,  -- 'note_capture', 'voice_query', 'chat'
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Index for efficient user session lookups
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Index for efficient session cleanup (expired sessions)
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ============================================================================
-- VOICE_NOTES TABLE
-- ============================================================================
-- Stores voice note transcripts and processing status
CREATE TABLE voice_notes (
    note_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    transcript TEXT NOT NULL,
    processing_status TEXT DEFAULT 'pending',  -- 'pending', 'completed', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Index for efficient user notes lookup
CREATE INDEX idx_notes_user ON voice_notes(user_id);

-- Index for chronological note browsing
CREATE INDEX idx_notes_created ON voice_notes(created_at);
