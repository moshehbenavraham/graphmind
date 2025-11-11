-- Migration: 0002_voice_notes_enhancements
-- Feature: 004-voice-note-capture
-- Description: Add duration, word count, and soft delete support to voice_notes table
-- Created: 2025-11-11

-- Add duration tracking (in seconds)
ALTER TABLE voice_notes ADD COLUMN duration_seconds INTEGER;

-- Add word count for transcript
ALTER TABLE voice_notes ADD COLUMN word_count INTEGER;

-- Add soft delete flag
ALTER TABLE voice_notes ADD COLUMN is_deleted BOOLEAN DEFAULT 0;

-- Create composite index for efficient user queries with soft delete filter
CREATE INDEX IF NOT EXISTS idx_notes_user_active ON voice_notes(user_id, is_deleted);

-- Create index for chronological browsing of active notes
CREATE INDEX IF NOT EXISTS idx_notes_created_active ON voice_notes(created_at DESC) WHERE is_deleted = 0;
