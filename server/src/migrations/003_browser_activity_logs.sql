-- Migration 003: Create browser_activity_logs table for hybrid browser tracking
-- source: 'extension' (browser extension data) or 'window_title' (parsed from window title)

CREATE TABLE IF NOT EXISTS browser_activity_logs (
    id SERIAL PRIMARY KEY,
    org_id UUID NOT NULL,
    user_id UUID NOT NULL,
    browser VARCHAR(50) NOT NULL,
    domain VARCHAR(500),
    title VARCHAR(500),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_seconds INTEGER DEFAULT 0,
    source VARCHAR(20) DEFAULT 'extension',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_browser_activity_org ON browser_activity_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_browser_activity_user ON browser_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_browser_activity_domain ON browser_activity_logs(domain);
CREATE INDEX IF NOT EXISTS idx_browser_activity_start ON browser_activity_logs(start_time);
CREATE INDEX IF NOT EXISTS idx_browser_activity_user_date ON browser_activity_logs(user_id, start_time);
