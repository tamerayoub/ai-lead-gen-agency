-- View AI Interactive Training Corrections
-- This query shows all corrections saved from the Interactive Training feature
-- Corrections are stored in ai_settings table with category='training_corrections' and key='corrections'
-- The AI Leasing Agent uses the last 20 corrections when generating replies to improve accuracy

-- ============================================================================
-- QUERY 0: Simple check - see if any corrections exist at all
-- Run this first to verify data exists and check the JSON structure
-- ============================================================================
SELECT 
  ai.id,
  ai.org_id,
  o.name as organization_name,
  ai.category,
  ai.key,
  LENGTH(ai.value) as value_length,
  ai.updated_at,
  LEFT(ai.value, 500) as value_preview,
  -- Try to parse as JSON to see if it's valid
  CASE 
    WHEN ai.value LIKE '[%' THEN 'Looks like JSON array'
    ELSE 'Not a JSON array format'
  END as json_format_check
FROM ai_settings ai
LEFT JOIN organizations o ON ai.org_id = o.id
WHERE ai.category = 'training_corrections'
  AND ai.key = 'corrections'
ORDER BY ai.updated_at DESC;

-- ============================================================================
-- QUERY 0.5: Check for the specific orgId from your logs
-- Replace with your actual orgId: da29aa13-a844-451a-a872-5ad96f221265
-- ============================================================================
SELECT 
  ai.id,
  ai.org_id,
  o.name as organization_name,
  ai.category,
  ai.key,
  LENGTH(ai.value) as value_length,
  ai.updated_at,
  ai.value as full_value
FROM ai_settings ai
LEFT JOIN organizations o ON ai.org_id = o.id
WHERE ai.category = 'training_corrections'
  AND ai.key = 'corrections'
  AND ai.org_id = 'da29aa13-a844-451a-a872-5ad96f221265';

-- ============================================================================
-- QUERY 1: View all organizations with training corrections (summary)
-- ============================================================================
SELECT 
  o.id as org_id,
  o.name as organization_name,
  ai.id as setting_id,
  jsonb_array_length(ai.value::jsonb) as total_corrections,
  ai.updated_at as last_correction_date
FROM ai_settings ai
JOIN organizations o ON ai.org_id = o.id
WHERE ai.category = 'training_corrections'
  AND ai.key = 'corrections'
ORDER BY ai.updated_at DESC;

-- ============================================================================
-- QUERY 2: View all corrections for a specific organization (expanded view)
-- Replace 'YOUR_ORG_ID' with your actual organization ID
-- Or use: da29aa13-a844-451a-a872-5ad96f221265 (from your logs)
-- ============================================================================
SELECT 
  o.name as organization_name,
  correction->>'id' as correction_id,
  correction->>'leadMessage' as lead_message,
  LEFT(correction->>'originalMessage', 150) as ai_original_response_preview,
  LEFT(correction->>'correctedMessage', 150) as corrected_response_preview,
  correction->>'createdAt' as correction_date,
  ai.updated_at as last_updated
FROM ai_settings ai
JOIN organizations o ON ai.org_id = o.id
CROSS JOIN LATERAL jsonb_array_elements(ai.value::jsonb) as correction
WHERE ai.category = 'training_corrections'
  AND ai.key = 'corrections'
  AND ai.org_id = 'da29aa13-a844-451a-a872-5ad96f221265'  -- Replace with your org ID
ORDER BY (correction->>'createdAt')::timestamp DESC;

-- ============================================================================
-- QUERY 3: View all corrections across all organizations (full details)
-- ============================================================================
SELECT 
  o.name as organization_name,
  o.id as org_id,
  correction->>'id' as correction_id,
  correction->>'leadMessage' as lead_message,
  LEFT(correction->>'originalMessage', 100) as ai_original_response_preview,
  LEFT(correction->>'correctedMessage', 100) as corrected_response_preview,
  correction->>'createdAt' as correction_date,
  ai.updated_at as setting_last_updated
FROM ai_settings ai
JOIN organizations o ON ai.org_id = o.id
CROSS JOIN LATERAL jsonb_array_elements(ai.value::jsonb) as correction
WHERE ai.category = 'training_corrections'
  AND ai.key = 'corrections'
ORDER BY (correction->>'createdAt')::timestamp DESC
LIMIT 50;

-- ============================================================================
-- QUERY 4: View most recent 20 corrections (what AI actually uses)
-- The AI uses the last 20 corrections when generating replies
-- Replace org_id with your actual org ID: da29aa13-a844-451a-a872-5ad96f221265
-- ============================================================================
SELECT 
  o.name as organization_name,
  correction->>'id' as correction_id,
  correction->>'leadMessage' as lead_message,
  correction->>'originalMessage' as ai_original_response,
  correction->>'correctedMessage' as corrected_response,
  correction->>'createdAt' as correction_date
FROM ai_settings ai
JOIN organizations o ON ai.org_id = o.id
CROSS JOIN LATERAL jsonb_array_elements(ai.value::jsonb) as correction
WHERE ai.category = 'training_corrections'
  AND ai.key = 'corrections'
  AND ai.org_id = 'da29aa13-a844-451a-a872-5ad96f221265'  -- Replace with your org ID
ORDER BY (correction->>'createdAt')::timestamp DESC
LIMIT 20;

-- ============================================================================
-- QUERY 5: Count corrections per organization
-- ============================================================================
SELECT 
  o.name as organization_name,
  o.id as org_id,
  jsonb_array_length(ai.value::jsonb) as total_corrections,
  ai.updated_at as last_updated
FROM ai_settings ai
JOIN organizations o ON ai.org_id = o.id
WHERE ai.category = 'training_corrections'
  AND ai.key = 'corrections'
ORDER BY jsonb_array_length(ai.value::jsonb) DESC;

-- ============================================================================
-- QUERY 6: View full correction details (for detailed inspection)
-- Replace 'YOUR_ORG_ID' and 'CORRECTION_ID' with actual values
-- ============================================================================
SELECT 
  o.name as organization_name,
  correction->>'id' as correction_id,
  correction->>'leadMessage' as lead_message,
  correction->>'originalMessage' as ai_original_response,
  correction->>'correctedMessage' as corrected_response,
  correction->>'createdAt' as correction_date,
  ai.value::jsonb as all_corrections_json
FROM ai_settings ai
JOIN organizations o ON ai.org_id = o.id
CROSS JOIN LATERAL jsonb_array_elements(ai.value::jsonb) as correction
WHERE ai.category = 'training_corrections'
  AND ai.key = 'corrections'
  AND ai.org_id = 'YOUR_ORG_ID'  -- Replace with your org ID
  AND correction->>'id' = 'CORRECTION_ID'  -- Replace with specific correction ID
LIMIT 1;

