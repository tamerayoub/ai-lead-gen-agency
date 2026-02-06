-- Test query to verify AI corrections are being saved
-- Run this after saving a correction in the Interactive Training UI

-- 1. Check if ai_settings table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'ai_settings';

-- 2. Check all ai_settings records (to see structure)
SELECT 
  id,
  org_id,
  category,
  key,
  LENGTH(value) as value_length,
  updated_at,
  LEFT(value, 200) as value_preview
FROM ai_settings
ORDER BY updated_at DESC
LIMIT 10;

-- 3. Specifically check for training_corrections
SELECT 
  ai.id,
  ai.org_id,
  o.name as organization_name,
  ai.category,
  ai.key,
  LENGTH(ai.value) as value_length,
  ai.updated_at,
  LEFT(ai.value, 500) as value_preview
FROM ai_settings ai
LEFT JOIN organizations o ON ai.org_id = o.id
WHERE ai.category = 'training_corrections'
  AND ai.key = 'corrections'
ORDER BY ai.updated_at DESC;

-- 4. Try to parse as JSON (if it exists)
SELECT 
  ai.id,
  ai.org_id,
  o.name as organization_name,
  jsonb_array_length(ai.value::jsonb) as total_corrections,
  ai.value::jsonb as corrections_json,
  ai.updated_at
FROM ai_settings ai
LEFT JOIN organizations o ON ai.org_id = o.id
WHERE ai.category = 'training_corrections'
  AND ai.key = 'corrections';

-- 5. Check if orgId is being passed correctly (check recent API logs)
-- This query won't work but shows what to look for in server logs:
-- Look for: "[AI Training] Saving correction for orgId: ..."

