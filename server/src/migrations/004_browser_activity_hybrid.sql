-- Migration 004: Add source column for hybrid browser tracking (extension vs window_title)

ALTER TABLE browser_activity_logs 
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'extension';

-- Make domain nullable for window_title entries (no domain available)
ALTER TABLE browser_activity_logs 
ALTER COLUMN domain DROP NOT NULL;
