-- Diagnostic query to check for data sharing issues within organizations
-- Run this to see if there are any data issues

-- 1. Check for NULL orgId values (should be 0 after migration)
SELECT 
  'leads' as table_name,
  COUNT(*) as null_org_id_count
FROM leads 
WHERE org_id IS NULL
UNION ALL
SELECT 
  'properties' as table_name,
  COUNT(*) as null_org_id_count
FROM properties 
WHERE org_id IS NULL
UNION ALL
SELECT 
  'listings' as table_name,
  COUNT(*) as null_org_id_count
FROM listings 
WHERE org_id IS NULL
UNION ALL
SELECT 
  'property_units' as table_name,
  COUNT(*) as null_org_id_count
FROM property_units 
WHERE org_id IS NULL
UNION ALL
SELECT 
  'conversations' as table_name,
  COUNT(*) as null_org_id_count
FROM conversations c
LEFT JOIN leads l ON c.lead_id = l.id
WHERE l.org_id IS NULL;

-- 2. Check data distribution by orgId
SELECT 
  org_id,
  COUNT(*) as lead_count,
  COUNT(DISTINCT created_at::date) as days_with_activity
FROM leads
GROUP BY org_id
ORDER BY lead_count DESC;

-- 3. Check if conversations are accessible via orgId (join with leads)
SELECT 
  l.org_id,
  COUNT(DISTINCT c.lead_id) as leads_with_conversations,
  COUNT(c.id) as total_conversations
FROM conversations c
INNER JOIN leads l ON c.lead_id = l.id
GROUP BY l.org_id
ORDER BY total_conversations DESC;

-- 4. Check for orphaned conversations (conversations without valid leads)
SELECT 
  COUNT(*) as orphaned_conversations
FROM conversations c
LEFT JOIN leads l ON c.lead_id = l.id
WHERE l.id IS NULL;

-- 5. Check user memberships and their currentOrgId
SELECT 
  u.id as user_id,
  u.email,
  u.current_org_id as user_current_org_id,
  m.org_id as membership_org_id,
  m.role,
  m.status
FROM users u
LEFT JOIN memberships m ON u.id = m.user_id
WHERE m.status = 'active'
ORDER BY u.email, m.org_id;

-- 6. Check if there are leads/properties/listings that don't match user's currentOrgId
-- This would indicate data isolation issues
SELECT 
  u.id as user_id,
  u.email,
  u.current_org_id,
  COUNT(DISTINCT l.id) as leads_in_current_org,
  COUNT(DISTINCT p.id) as properties_in_current_org,
  COUNT(DISTINCT li.id) as listings_in_current_org
FROM users u
LEFT JOIN leads l ON l.org_id = u.current_org_id
LEFT JOIN properties p ON p.org_id = u.current_org_id
LEFT JOIN listings li ON li.org_id = u.current_org_id
WHERE u.current_org_id IS NOT NULL
GROUP BY u.id, u.email, u.current_org_id
ORDER BY u.email;

