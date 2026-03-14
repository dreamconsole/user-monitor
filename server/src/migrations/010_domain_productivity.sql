-- Migration 010: Create domain_productivity table
-- Allows admins to mark browser domains (e.g. youtube.com) as productive / non_productive / neutral

CREATE TABLE IF NOT EXISTS domain_productivity (
    id SERIAL PRIMARY KEY,
    org_id UUID NOT NULL,
    domain VARCHAR(255) NOT NULL,
    productivity_type VARCHAR(20) NOT NULL DEFAULT 'neutral'
        CHECK (productivity_type IN ('productive', 'non_productive', 'neutral')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_domain_productivity_org ON domain_productivity(org_id);
CREATE INDEX IF NOT EXISTS idx_domain_productivity_domain ON domain_productivity(org_id, domain);
