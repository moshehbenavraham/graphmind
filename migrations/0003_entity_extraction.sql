-- Migration: 0003_entity_extraction
-- Feature: 005-entity-extraction
-- Description: Add entity extraction support to voice_notes and create entity_cache table
-- Created: 2025-11-11

-- ============================================================================
-- Part 1: Extend voice_notes table with entity extraction columns
-- ============================================================================

-- Store extracted entities as JSON array
ALTER TABLE voice_notes ADD COLUMN entities_extracted JSON;

-- Track extraction lifecycle status
-- Values: 'pending', 'processing', 'completed', 'failed'
ALTER TABLE voice_notes ADD COLUMN extraction_status TEXT DEFAULT 'pending';

-- Track extraction attempt timestamp
ALTER TABLE voice_notes ADD COLUMN extraction_attempted_at TIMESTAMP;

-- Track extraction completion timestamp
ALTER TABLE voice_notes ADD COLUMN extraction_completed_at TIMESTAMP;

-- Store error message if extraction fails
ALTER TABLE voice_notes ADD COLUMN extraction_error TEXT;

-- Create index for querying pending extractions
CREATE INDEX IF NOT EXISTS idx_notes_extraction_status
    ON voice_notes(extraction_status, user_id);

-- ============================================================================
-- Part 2: Create entity_cache table for entity resolution
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_cache (
    cache_id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Entity identification
    entity_key TEXT NOT NULL,           -- Lowercase normalized name for matching
    user_id TEXT NOT NULL,              -- User isolation
    canonical_name TEXT NOT NULL,       -- Primary name to use
    entity_type TEXT NOT NULL,          -- Person, Project, Meeting, Topic, Technology, Location, Organization

    -- Entity metadata
    aliases JSON,                       -- Alternative names/spellings as JSON array
    properties JSON,                    -- Entity-specific properties as JSON object
    confidence REAL,                    -- Highest confidence score seen (0.0-1.0)

    -- Mention tracking
    first_mentioned_note_id TEXT,       -- Where entity was first seen
    last_mentioned_note_id TEXT,        -- Most recent mention
    mention_count INTEGER DEFAULT 1,    -- How many times mentioned across notes

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraint
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ============================================================================
-- Part 3: Create indexes for efficient entity resolution
-- ============================================================================

-- Primary lookup index: entity key + user for fuzzy matching (UNIQUE to prevent duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_cache_key_user
    ON entity_cache(entity_key, user_id);

-- Index for filtering entities by user and type
CREATE INDEX IF NOT EXISTS idx_entity_cache_user_type
    ON entity_cache(user_id, entity_type);

-- Index for canonical name lookups
CREATE INDEX IF NOT EXISTS idx_entity_cache_canonical
    ON entity_cache(canonical_name);

-- Index for mention tracking queries
CREATE INDEX IF NOT EXISTS idx_entity_cache_mentions
    ON entity_cache(mention_count DESC, user_id);
