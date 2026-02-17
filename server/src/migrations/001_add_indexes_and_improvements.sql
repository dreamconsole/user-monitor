-- Migration 001: Add missing indexes, soft delete support, and performance improvements
-- Run with: psql -d your_database -f migrations/001_add_indexes_and_improvements.sql

-- ═══════════════════════════════════════════════
-- INDEXES - Performance critical
-- ═══════════════════════════════════════════════

-- Foreign key indexes (PostgreSQL does NOT auto-create these)
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE INDEX IF NOT EXISTS idx_work_sessions_org_id ON work_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_user_id ON work_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_work_date ON work_sessions(work_date);
CREATE INDEX IF NOT EXISTS idx_work_sessions_status ON work_sessions(status);

CREATE INDEX IF NOT EXISTS idx_break_logs_org_id ON break_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_break_logs_user_id ON break_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_break_logs_session_id ON break_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_break_logs_break_type_id ON break_logs(break_type_id);
CREATE INDEX IF NOT EXISTS idx_break_logs_start_time ON break_logs(start_time);

CREATE INDEX IF NOT EXISTS idx_break_master_org_id ON break_master(org_id);

CREATE INDEX IF NOT EXISTS idx_screenshots_org_id ON screenshots(org_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_user_id ON screenshots(user_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_session_id ON screenshots(session_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_captured_at ON screenshots(captured_at);

CREATE INDEX IF NOT EXISTS idx_heartbeats_org_id ON heartbeats(org_id);
CREATE INDEX IF NOT EXISTS idx_heartbeats_user_id ON heartbeats(user_id);
CREATE INDEX IF NOT EXISTS idx_heartbeats_last_seen ON heartbeats(last_seen_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_at ON audit_logs(performed_at);

CREATE INDEX IF NOT EXISTS idx_notifications_org_id ON notifications(org_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_work_sessions_user_date_composite ON work_sessions(user_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_break_logs_user_start ON break_logs(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_screenshots_user_captured ON screenshots(user_id, captured_at DESC);

-- App tracking indexes (if tables exist)
DO $$
BEGIN
    -- tracked_apps indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tracked_apps') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tracked_apps_org_id ON tracked_apps(org_id)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tracked_apps_category_id ON tracked_apps(category_id)';
    END IF;

    -- app_usage_logs indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_usage_logs') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_app_usage_logs_org_id ON app_usage_logs(org_id)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_app_usage_logs_user_id ON app_usage_logs(user_id)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_app_usage_logs_app_id ON app_usage_logs(app_id)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_app_usage_logs_usage_date ON app_usage_logs(usage_date)';
    END IF;

    -- app_categories indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_categories') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_app_categories_org_id ON app_categories(org_id)';
    END IF;
END $$;

-- ═══════════════════════════════════════════════
-- Soft delete support for users
-- ═══════════════════════════════════════════════
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

-- ═══════════════════════════════════════════════
-- Password reset support
-- ═══════════════════════════════════════════════
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ DEFAULT NULL;

-- ═══════════════════════════════════════════════
-- Activity log partitions for future months
-- ═══════════════════════════════════════════════
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'activity_logs_y2026m03') THEN
        CREATE TABLE activity_logs_y2026m03 PARTITION OF activity_logs
            FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'activity_logs_y2026m04') THEN
        CREATE TABLE activity_logs_y2026m04 PARTITION OF activity_logs
            FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'activity_logs_y2026m05') THEN
        CREATE TABLE activity_logs_y2026m05 PARTITION OF activity_logs
            FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'activity_logs_y2026m06') THEN
        CREATE TABLE activity_logs_y2026m06 PARTITION OF activity_logs
            FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
    END IF;
END $$;
