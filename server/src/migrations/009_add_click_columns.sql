-- Migration 009: Add left_clicks and right_clicks to activity_logs
-- Safe to run multiple times (uses IF NOT EXISTS equivalent via DO block)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'activity_logs' AND column_name = 'left_clicks'
    ) THEN
        ALTER TABLE activity_logs ADD COLUMN left_clicks INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'activity_logs' AND column_name = 'right_clicks'
    ) THEN
        ALTER TABLE activity_logs ADD COLUMN right_clicks INTEGER DEFAULT 0;
    END IF;
END
$$;
