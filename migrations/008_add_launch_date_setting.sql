-- Add launch_date setting to ai_settings table (using org_id = NULL for global settings)
-- NOTE: This migration is deprecated. Global settings (org_id = NULL) are no longer supported
-- as of migration 011. This migration will only run if org_id is still nullable.
-- If org_id is already NOT NULL, this migration will be skipped.

-- Check if org_id column allows NULL values before inserting
DO $$
BEGIN
  -- Only insert if org_id column is still nullable (before migration 011)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_settings' 
    AND column_name = 'org_id' 
    AND is_nullable = 'YES'
  ) THEN
    -- Only insert if it doesn't already exist
    INSERT INTO ai_settings (id, org_id, category, key, value, updated_at)
    SELECT 
      gen_random_uuid(),
      NULL,
      'landing_page',
      'launch_date',
      (NOW() + INTERVAL '1 month')::text,
      NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM ai_settings 
      WHERE category = 'landing_page' 
      AND key = 'launch_date' 
      AND org_id IS NULL
    );
  END IF;
END $$;

