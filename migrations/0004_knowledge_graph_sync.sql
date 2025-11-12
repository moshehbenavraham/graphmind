-- Migration: Knowledge Graph Sync Support
-- Feature: 006-knowledge-graph-building
-- Created: 2025-11-11
-- Description: Add graph sync tracking to voice_notes and create graph_sync_metadata table

-- ==============================================================================
-- 1. EXTEND voice_notes TABLE
-- ==============================================================================

-- Add graph sync status tracking to voice_notes
ALTER TABLE voice_notes ADD COLUMN graph_sync_status TEXT DEFAULT 'pending';
-- Values: 'pending', 'processing', 'completed', 'failed'

-- Add timestamp for when graph sync completed
ALTER TABLE voice_notes ADD COLUMN graph_synced_at TIMESTAMP;

-- Add error message for failed syncs
ALTER TABLE voice_notes ADD COLUMN graph_sync_error TEXT;

-- ==============================================================================
-- 2. CREATE graph_sync_metadata TABLE
-- ==============================================================================

-- Track detailed metadata about graph sync operations
CREATE TABLE graph_sync_metadata (
    sync_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    note_id TEXT NOT NULL,

    -- Entity-to-node mapping (traceability between D1 entities and FalkorDB nodes)
    -- Format: {"entity_id_1": "falkordb_node_id_1", "entity_id_2": "falkordb_node_id_2"}
    entity_mappings TEXT,  -- JSON

    -- Relationship tracking
    -- Format: [{"from_node_id": "node_1", "to_node_id": "node_2", "rel_type": "WORKED_WITH"}]
    relationships_created TEXT,  -- JSON

    -- Merge tracking (entity deduplication)
    -- Format: [{"source_entity": "Sarah", "target_entity": "Sarah Johnson", "reason": "fuzzy_match", "confidence": 0.92}]
    entities_merged TEXT,  -- JSON

    -- Performance metrics
    nodes_created INTEGER DEFAULT 0,
    nodes_updated INTEGER DEFAULT 0,
    relationships_count INTEGER DEFAULT 0,
    processing_time_ms INTEGER,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (note_id) REFERENCES voice_notes(note_id)
);

-- ==============================================================================
-- 3. CREATE INDEXES
-- ==============================================================================

-- Index for querying sync metadata by user (most common query pattern)
CREATE INDEX idx_graph_sync_user ON graph_sync_metadata(user_id, created_at DESC);

-- Index for querying sync metadata by note (traceability)
CREATE INDEX idx_graph_sync_note ON graph_sync_metadata(note_id);

-- Index for querying voice notes by sync status (queue consumer queries)
CREATE INDEX idx_voice_notes_graph_sync ON voice_notes(user_id, graph_sync_status);

-- ==============================================================================
-- 4. MIGRATION VALIDATION
-- ==============================================================================

-- Verify voice_notes columns exist
-- Run after migration: PRAGMA table_info(voice_notes);
-- Expected: graph_sync_status, graph_synced_at, graph_sync_error columns present

-- Verify graph_sync_metadata table exists
-- Run after migration: PRAGMA table_info(graph_sync_metadata);
-- Expected: All columns listed above

-- Verify indexes created
-- Run after migration: SELECT name FROM sqlite_master WHERE type='index' AND tbl_name IN ('voice_notes', 'graph_sync_metadata');
-- Expected: idx_graph_sync_user, idx_graph_sync_note, idx_voice_notes_graph_sync
