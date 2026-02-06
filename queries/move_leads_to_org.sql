-- SQL Script to Move Leads to Organization 'da29aa13-a844-451a-a872-5ad96f221265'
-- IMPORTANT: Review and adjust the WHERE clause before running!

-- ============================================
-- STEP 1: PREVIEW - See what will be moved
-- ============================================
-- Run this first to see which leads will be moved

-- Option A: Move ALL Facebook leads (recommended)
SELECT 
  l.id,
  l.name,
  l.email,
  l.source,
  l.org_id as current_org_id,
  o.name as current_org_name,
  'da29aa13-a844-451a-a872-5ad96f221265' as target_org_id
FROM leads l
LEFT JOIN organizations o ON l.org_id = o.id
WHERE l.source = 'facebook'
  AND l.org_id != 'da29aa13-a844-451a-a872-5ad96f221265'
ORDER BY l.created_at DESC;

-- Option B: Move leads from a specific organization (e.g., "test 1")
-- Uncomment and replace 'YOUR_OLD_ORG_ID' with the actual org ID
/*
SELECT 
  l.id,
  l.name,
  l.email,
  l.source,
  l.org_id as current_org_id,
  o.name as current_org_name,
  'da29aa13-a844-451a-a872-5ad96f221265' as target_org_id
FROM leads l
LEFT JOIN organizations o ON l.org_id = o.id
WHERE l.org_id = 'YOUR_OLD_ORG_ID'  -- Replace with the old org ID
ORDER BY l.created_at DESC;
*/

-- Option C: Move ALL leads (use with caution!)
/*
SELECT 
  l.id,
  l.name,
  l.email,
  l.source,
  l.org_id as current_org_id,
  o.name as current_org_name,
  'da29aa13-a844-451a-a872-5ad96f221265' as target_org_id
FROM leads l
LEFT JOIN organizations o ON l.org_id = o.id
WHERE l.org_id != 'da29aa13-a844-451a-a872-5ad96f221265'
ORDER BY l.created_at DESC;
*/

-- ============================================
-- STEP 2: VERIFY TARGET ORGANIZATION EXISTS
-- ============================================
SELECT 
  id,
  name,
  created_at
FROM organizations
WHERE id = 'da29aa13-a844-451a-a872-5ad96f221265';

-- ============================================
-- STEP 3: COUNT LEADS TO BE MOVED
-- ============================================
-- Count Facebook leads that will be moved
SELECT 
  COUNT(*) as leads_to_move,
  COUNT(DISTINCT l.org_id) as source_organizations
FROM leads l
WHERE l.source = 'facebook'
  AND l.org_id != 'da29aa13-a844-451a-a872-5ad96f221265';

-- ============================================
-- STEP 4: ACTUAL UPDATE (Run after reviewing above)
-- ============================================
-- ⚠️ UNCOMMENT THE BELOW TO EXECUTE THE UPDATE ⚠️

-- Option A: Move ALL Facebook leads (recommended)
/*
BEGIN;

UPDATE leads
SET org_id = 'da29aa13-a844-451a-a872-5ad96f221265'
WHERE source = 'facebook'
  AND org_id != 'da29aa13-a844-451a-a872-5ad96f221265';

-- Verify the update
SELECT 
  COUNT(*) as moved_leads,
  COUNT(DISTINCT source) as sources
FROM leads
WHERE org_id = 'da29aa13-a844-451a-a872-5ad96f221265'
  AND source = 'facebook';

COMMIT;
*/

-- Option B: Move leads from a specific organization
-- Uncomment and replace 'YOUR_OLD_ORG_ID' with the actual org ID
/*
BEGIN;

UPDATE leads
SET org_id = 'da29aa13-a844-451a-a872-5ad96f221265'
WHERE org_id = 'YOUR_OLD_ORG_ID';  -- Replace with the old org ID

-- Verify the update
SELECT 
  COUNT(*) as moved_leads
FROM leads
WHERE org_id = 'da29aa13-a844-451a-a872-5ad96f221265'
  AND org_id = 'YOUR_OLD_ORG_ID';

COMMIT;
*/

-- ============================================
-- STEP 5: VERIFY CONVERSATIONS ARE STILL LINKED
-- ============================================
-- After moving leads, verify conversations are still properly linked
-- (They should be fine since they reference lead_id, not org_id directly)

SELECT 
  l.id as lead_id,
  l.name as lead_name,
  l.org_id as lead_org_id,
  COUNT(c.id) as conversation_count
FROM leads l
LEFT JOIN conversations c ON c.lead_id = l.id
WHERE l.org_id = 'da29aa13-a844-451a-a872-5ad96f221265'
  AND l.source = 'facebook'
GROUP BY l.id, l.name, l.org_id
ORDER BY conversation_count DESC;

-- ============================================
-- ROLLBACK (if needed)
-- ============================================
-- If you need to rollback, you'll need to know the original org_id
-- This is why we recommend running the preview queries first!

