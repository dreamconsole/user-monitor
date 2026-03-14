-- Migration 011: Change domain_productivity to use category_id (instead of raw productivity_type)
-- This allows domains to be assigned the same app categories as tracked apps.

ALTER TABLE domain_productivity
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES app_categories(id) ON DELETE SET NULL;

-- Drop the old productivity_type column (productivity is now derived via the category join)
ALTER TABLE domain_productivity
    DROP COLUMN IF EXISTS productivity_type;
