-- Migration 003: Add metadata to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip VARCHAR(45);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
