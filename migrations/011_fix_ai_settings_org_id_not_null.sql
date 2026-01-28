-- Fix ai_settings org_id NOT NULL constraint
-- Migration: 011_fix_ai_settings_org_id_not_null
--
-- This migration removes global settings (org_id IS NULL) and enforces
-- that all ai_settings must belong to an organization (multi-tenancy requirement)

-- Step 1: Delete all global settings (org_id IS NULL)
-- These were created by migration 008 for the launch_date global setting
-- Since we're enforcing multi-tenancy, global settings are no longer supported
DELETE FROM ai_settings WHERE org_id IS NULL;

-- Step 2: Set org_id column to NOT NULL
-- This enforces that all settings must belong to an organization
ALTER TABLE ai_settings ALTER COLUMN org_id SET NOT NULL;

-- Step 3: Ensure foreign key constraint exists (should already exist, but verify)
-- The foreign key constraint should already be in place from the table creation,
-- but we'll add it if it doesn't exist to ensure referential integrity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ai_settings_org_id_organizations_id_fk'
    AND conrelid = 'ai_settings'::regclass
  ) THEN
    ALTER TABLE ai_settings 
    ADD CONSTRAINT ai_settings_org_id_organizations_id_fk 
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

