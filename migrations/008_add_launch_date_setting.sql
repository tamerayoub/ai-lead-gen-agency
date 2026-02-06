-- Add launch_date setting to ai_settings table
-- NOTE: org_id is required (NOT NULL), so we insert one row per organization
-- This will store the launch date for the countdown timer

-- Insert launch_date for each organization that doesn't have it yet
INSERT INTO ai_settings (id, org_id, category, key, value, updated_at)
SELECT 
  gen_random_uuid(),
  o.id,  -- Use actual org ID, not NULL
  'landing_page',
  'launch_date',
  (NOW() + INTERVAL '1 month')::text,
  NOW()
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM ai_settings 
  WHERE category = 'landing_page' 
  AND key = 'launch_date' 
  AND org_id = o.id
);

