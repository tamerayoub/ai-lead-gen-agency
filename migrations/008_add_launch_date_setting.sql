-- Add launch_date setting to ai_settings table (using org_id = NULL for global settings)
-- This will store the launch date for the countdown timer
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

