-- Migration 007: Add Application Tracking Tables
-- Purpose: Track which applications users run, categorize them, and generate productivity reports

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. App Categories (Admin-manageable)
CREATE TABLE IF NOT EXISTS app_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    productivity_type VARCHAR(20) DEFAULT 'neutral' CHECK (productivity_type IN ('productive', 'non_productive', 'neutral')),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, name)
);

COMMENT ON TABLE app_categories IS 'Application categories for productivity tracking (Work, Media, Communication, etc.)';

-- 2. Tracked Apps (Executable mapping)
CREATE TABLE IF NOT EXISTS tracked_apps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    executable_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    category_id UUID REFERENCES app_categories(id) ON DELETE SET NULL,
    is_auto_detected BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, executable_name)
);

COMMENT ON TABLE tracked_apps IS 'Registry of all detected applications with category mappings';

-- 3. App Usage Logs (High volume - partitioned by month)
CREATE TABLE IF NOT EXISTS app_usage_logs (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES work_sessions(id) ON DELETE CASCADE,
    app_id UUID NOT NULL REFERENCES tracked_apps(id) ON DELETE CASCADE,
    window_title TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_seconds INTEGER,
    log_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, log_date)
) PARTITION BY RANGE (log_date);

COMMENT ON TABLE app_usage_logs IS 'Detailed logs of application usage with time tracking';

-- Create partitions for current and next 3 months
CREATE TABLE IF NOT EXISTS app_usage_logs_y2026m02 PARTITION OF app_usage_logs
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE IF NOT EXISTS app_usage_logs_y2026m03 PARTITION OF app_usage_logs
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE IF NOT EXISTS app_usage_logs_y2026m04 PARTITION OF app_usage_logs
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS app_usage_logs_y2026m05 PARTITION OF app_usage_logs
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- 4. User App Summary (Aggregated daily stats)
CREATE TABLE IF NOT EXISTS user_app_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    summary_date DATE NOT NULL,
    total_productive_seconds INTEGER DEFAULT 0,
    total_non_productive_seconds INTEGER DEFAULT 0,
    total_neutral_seconds INTEGER DEFAULT 0,
    total_working_seconds INTEGER DEFAULT 0,
    category_breakdown JSONB, -- {category_id: seconds}
    app_breakdown JSONB, -- {app_id: seconds}
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, summary_date)
);

COMMENT ON TABLE user_app_summary IS 'Pre-aggregated daily productivity statistics per user';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_usage_logs_user_date ON app_usage_logs (user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_app_usage_logs_app ON app_usage_logs (app_id, log_date);
CREATE INDEX IF NOT EXISTS idx_app_usage_logs_session ON app_usage_logs (session_id);
CREATE INDEX IF NOT EXISTS idx_tracked_apps_category ON tracked_apps (category_id);
CREATE INDEX IF NOT EXISTS idx_tracked_apps_org ON tracked_apps (org_id);
CREATE INDEX IF NOT EXISTS idx_app_categories_org ON app_categories (org_id);
CREATE INDEX IF NOT EXISTS idx_user_app_summary_date ON user_app_summary (user_id, summary_date);
CREATE INDEX IF NOT EXISTS idx_user_app_summary_org_date ON user_app_summary (org_id, summary_date);

-- Insert default categories for each organization
INSERT INTO app_categories (org_id, name, productivity_type, description)
SELECT 
    id,
    'Work - Programming',
    'productive',
    'IDEs, code editors, terminals, and development tools'
FROM organizations
WHERE NOT EXISTS (
    SELECT 1 FROM app_categories 
    WHERE org_id = organizations.id AND name = 'Work - Programming'
);

INSERT INTO app_categories (org_id, name, productivity_type, description)
SELECT 
    id,
    'Work - Office Apps',
    'productive',
    'Excel, Word, Google Sheets, Docs, and office productivity tools'
FROM organizations
WHERE NOT EXISTS (
    SELECT 1 FROM app_categories 
    WHERE org_id = organizations.id AND name = 'Work - Office Apps'
);

INSERT INTO app_categories (org_id, name, productivity_type, description)
SELECT 
    id,
    'Communication',
    'neutral',
    'Email, chat apps, video conferencing (Teams, Zoom, Slack, WhatsApp)'
FROM organizations
WHERE NOT EXISTS (
    SELECT 1 FROM app_categories 
    WHERE org_id = organizations.id AND name = 'Communication'
);

INSERT INTO app_categories (org_id, name, productivity_type, description)
SELECT 
    id,
    'Media',
    'non_productive',
    'Games, video players, social media, streaming platforms'
FROM organizations
WHERE NOT EXISTS (
    SELECT 1 FROM app_categories 
    WHERE org_id = organizations.id AND name = 'Media'
);

INSERT INTO app_categories (org_id, name, productivity_type, description)
SELECT 
    id,
    'Uncategorized',
    'neutral',
    'Applications not yet mapped to a category'
FROM organizations
WHERE NOT EXISTS (
    SELECT 1 FROM app_categories 
    WHERE org_id = organizations.id AND name = 'Uncategorized'
);
