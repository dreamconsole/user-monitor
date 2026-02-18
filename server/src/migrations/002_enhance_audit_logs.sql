-- Migration 002: Enhance audit_logs table for comprehensive activity logging
-- Adds actor_role, entity_type, ip_address, target_name columns and indexes

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_role VARCHAR(50);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type VARCHAR(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id ON audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_composite ON audit_logs(org_id, performed_at DESC);
