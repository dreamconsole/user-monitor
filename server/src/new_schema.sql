-- PostgreSQL Schema for Multi-Organization Employee Monitoring Dashboard
-- Using UUIDs for all primary keys
-- Strict multi-tenancy with org_id on all operational tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    timezone VARCHAR(100) DEFAULT 'UTC',
    max_users_limit INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE organizations IS 'Company details and subscription limits';

-- 2. Organization Features (Pricing Tiers)
CREATE TABLE org_features (
    org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    is_activity_tracking_enabled BOOLEAN DEFAULT true,
    is_screenshots_enabled BOOLEAN DEFAULT true,
    screenshot_interval_seconds INTEGER DEFAULT 300,
    is_afk_tracking_enabled BOOLEAN DEFAULT true,
    afk_threshold_seconds INTEGER DEFAULT 300,
    is_breaks_enabled BOOLEAN DEFAULT true,
    is_force_logout_enabled BOOLEAN DEFAULT true,
    idle_action VARCHAR(20) DEFAULT 'none',
    idle_action_duration_minutes INTEGER DEFAULT 60,
    break_exceeded_action VARCHAR(20) DEFAULT 'notification',
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE org_features IS 'Feature toggles per organization, typically mapped to pricing plans';

-- 3. Teams
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE teams IS 'Teams for user grouping';

-- 4. Users
CREATE TYPE user_role AS ENUM ('orgadmin', 'manager', 'user');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role DEFAULT 'user',
    timezone VARCHAR(100) DEFAULT 'UTC',
    emp_id TEXT,
    payroll_id TEXT,
    site TEXT,
    device_id TEXT,
    agent_version TEXT,
    token TEXT,
    last_heartbeat TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    force_logout BOOLEAN DEFAULT false,
    current_state VARCHAR(20) DEFAULT 'offline',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, email)
);

COMMENT ON TABLE users IS 'User management with hierarchy and force logout support';

-- 4. User-level Feature Overrides
CREATE TABLE user_features (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    is_screenshots_enabled BOOLEAN, -- NULL means use org default
    screenshot_interval_seconds INTEGER,
    is_afk_tracking_enabled BOOLEAN,
    afk_threshold_seconds INTEGER,
    is_breaks_enabled BOOLEAN,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE user_features IS 'User-specific overrides for organizational feature settings';

-- 5. Break Master (Definitions)
CREATE TABLE break_master (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    max_duration_seconds INTEGER,
    is_paid BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Work Sessions
CREATE TYPE session_status AS ENUM ('active', 'completed', 'abandoned', 'force_logged_out');

CREATE TABLE work_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMPTZ,
    total_work_seconds INTEGER DEFAULT 0,
    total_idle_seconds INTEGER DEFAULT 0,
    total_break_seconds INTEGER DEFAULT 0,
    status session_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. Agent Sessions (Device Tracking)
CREATE TABLE agent_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    device_name VARCHAR(255),
    device_identifier VARCHAR(255), -- MAC or unique ID
    auth_token TEXT UNIQUE NOT NULL,
    token_expires_at TIMESTAMPTZ NOT NULL,
    last_heartbeat_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. Activity Logs (HIGH VOLUME - Partitioned)
CREATE TABLE activity_logs (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    user_id UUID NOT NULL,
    session_id UUID NOT NULL,
    log_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    keyboard_events INTEGER DEFAULT 0,
    mouse_events INTEGER DEFAULT 0,
    state VARCHAR(50), -- active, idle, afk, break
    is_suspicious BOOLEAN DEFAULT false,
    metadata JSONB,
    PRIMARY KEY (id, log_time)
) PARTITION BY RANGE (log_time);

-- Example partition for January 2026
CREATE TABLE activity_logs_y2026m01 PARTITION OF activity_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Partition for February 2026
CREATE TABLE activity_logs_y2026m02 PARTITION OF activity_logs
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- 9. Screenshots (Metadata only)
CREATE TABLE screenshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES work_sessions(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL, -- S3 path or filesystem path
    captured_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- 10. Break Logs
CREATE TABLE break_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES work_sessions(id) ON DELETE CASCADE,
    break_type_id UUID REFERENCES break_master(id),
    start_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMPTZ,
    duration_seconds INTEGER
);

-- 11. Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id), -- Who performed the action
    action VARCHAR(255) NOT NULL,
    target_id UUID, -- ID of the user/setting changed
    old_values JSONB,
    new_values JSONB,
    performed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. Heartbeat Logs (Historical tracking)
CREATE TABLE heartbeats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT,
    status VARCHAR(50),
    last_seen_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for easy reporting
CREATE INDEX idx_activity_logs_user_date ON activity_logs (user_id, log_time);
CREATE INDEX idx_work_sessions_user_date ON work_sessions (user_id, start_time);
CREATE INDEX idx_users_org_role ON users (org_id, role);
CREATE INDEX idx_agent_sessions_token ON agent_sessions (auth_token);

-- 13. Notifications (Manager Alerts)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- The Manager
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL, -- The Employee
    type VARCHAR(50) NOT NULL, -- 'BREAK_VIOLATION', 'IDLE_VIOLATION'
    title VARCHAR(255) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read);
