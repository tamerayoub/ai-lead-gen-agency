-- Add qualification_settings table
-- Migration: 004_add_qualification_settings

-- Create qualification_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS qualification_settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id VARCHAR REFERENCES properties(id) ON DELETE CASCADE,
  qualifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS qualification_settings_org_idx ON qualification_settings(org_id);
CREATE INDEX IF NOT EXISTS qualification_settings_property_idx ON qualification_settings(property_id);

-- Create unique constraints
-- One org-level setting per org
CREATE UNIQUE INDEX IF NOT EXISTS qualification_settings_org_unique 
  ON qualification_settings(org_id) 
  WHERE property_id IS NULL;

-- One property-level setting per property
CREATE UNIQUE INDEX IF NOT EXISTS qualification_settings_property_unique 
  ON qualification_settings(property_id) 
  WHERE property_id IS NOT NULL;
