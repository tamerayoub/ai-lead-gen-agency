-- Delete Pending Replies for Facebook Leads
-- ⚠️ WARNING: This will permanently delete pending replies for Facebook leads! ⚠️
-- Run at your own risk. Consider backing up first.

-- ============================================
-- PREVIEW: See what will be deleted
-- ============================================

-- Query 1: Count pending replies for Facebook leads (by lead source)
SELECT 
  COUNT(*) as pending_replies_for_facebook_leads,
  COUNT(DISTINCT pr.lead_id) as unique_facebook_leads_affected
FROM pending_replies pr
INNER JOIN leads l ON pr.lead_id = l.id
WHERE l.source = 'facebook';

-- Query 2: Count pending replies with Facebook channel
SELECT 
  COUNT(*) as pending_replies_with_facebook_channel
FROM pending_replies
WHERE channel = 'facebook';

-- Query 3: Detailed view of ALL pending replies that will be deleted (comprehensive)
SELECT 
  pr.id,
  pr.lead_id,
  pr.lead_name,
  pr.lead_email,
  pr.subject,
  pr.channel,
  pr.status,
  pr.created_at,
  l.source as lead_source,
  l.name as lead_name_from_leads,
  CASE 
    WHEN l.source = 'facebook' THEN 'Lead source is facebook'
    WHEN pr.channel = 'facebook' THEN 'Pending reply channel is facebook'
    WHEN l.metadata->>'facebookProfileId' IS NOT NULL THEN 'Has facebookProfileId'
    WHEN l.metadata->>'facebookConversationId' IS NOT NULL THEN 'Has facebookConversationId'
    WHEN l.metadata->>'facebookListingId' IS NOT NULL THEN 'Has facebookListingId'
    WHEN l.metadata->>'facebookProfileName' IS NOT NULL THEN 'Has facebookProfileName'
    ELSE 'Other'
  END as deletion_reason
FROM pending_replies pr
INNER JOIN leads l ON pr.lead_id = l.id
WHERE l.source = 'facebook' 
   OR pr.channel = 'facebook'
   OR l.metadata->>'facebookProfileId' IS NOT NULL
   OR l.metadata->>'facebookConversationId' IS NOT NULL
   OR l.metadata->>'facebookListingId' IS NOT NULL
   OR l.metadata->>'facebookProfileName' IS NOT NULL
ORDER BY pr.created_at DESC;

-- Query 4: Summary by status (comprehensive)
SELECT 
  pr.status,
  COUNT(*) as count
FROM pending_replies pr
INNER JOIN leads l ON pr.lead_id = l.id
WHERE l.source = 'facebook' 
   OR pr.channel = 'facebook'
   OR l.metadata->>'facebookProfileId' IS NOT NULL
   OR l.metadata->>'facebookConversationId' IS NOT NULL
   OR l.metadata->>'facebookListingId' IS NOT NULL
   OR l.metadata->>'facebookProfileName' IS NOT NULL
GROUP BY pr.status
ORDER BY pr.status;

-- Query 4b: Count ALL unsent outgoing conversations for Facebook leads (these show in messages view)
SELECT 
  COUNT(*) as unsent_facebook_conversations,
  COUNT(DISTINCT c.lead_id) as unique_leads_affected
FROM conversations c
INNER JOIN leads l ON c.lead_id = l.id
WHERE (l.source = 'facebook'
   OR c.channel = 'facebook'
   OR l.metadata->>'facebookProfileId' IS NOT NULL
   OR l.metadata->>'facebookConversationId' IS NOT NULL
   OR l.metadata->>'facebookListingId' IS NOT NULL
   OR l.metadata->>'facebookProfileName' IS NOT NULL)
AND c.type = 'outgoing'
AND (c.delivery_status = 'pending' OR c.delivery_status IS NULL);

-- Query 5: Preview ALL unsent conversations that will be deleted (these show in messages view)
-- This shows ALL outgoing conversations with pending status for Facebook leads
SELECT 
  c.id,
  c.lead_id,
  c.type,
  c.channel,
  LEFT(c.message, 100) as message_preview,
  c.delivery_status,
  c.created_at,
  l.source as lead_source,
  l.name as lead_name,
  CASE 
    WHEN l.source = 'facebook' THEN 'Lead source is facebook'
    WHEN c.channel = 'facebook' THEN 'Conversation channel is facebook'
    WHEN l.metadata->>'facebookProfileId' IS NOT NULL THEN 'Has facebookProfileId'
    WHEN l.metadata->>'facebookConversationId' IS NOT NULL THEN 'Has facebookConversationId'
    WHEN l.metadata->>'facebookListingId' IS NOT NULL THEN 'Has facebookListingId'
    WHEN l.metadata->>'facebookProfileName' IS NOT NULL THEN 'Has facebookProfileName'
    ELSE 'Other'
  END as deletion_reason
FROM conversations c
INNER JOIN leads l ON c.lead_id = l.id
WHERE (l.source = 'facebook'
   OR c.channel = 'facebook'
   OR l.metadata->>'facebookProfileId' IS NOT NULL
   OR l.metadata->>'facebookConversationId' IS NOT NULL
   OR l.metadata->>'facebookListingId' IS NOT NULL
   OR l.metadata->>'facebookProfileName' IS NOT NULL)
AND c.type = 'outgoing'
AND (c.delivery_status = 'pending' OR c.delivery_status IS NULL)
ORDER BY c.created_at DESC;

-- ============================================
-- DELETE: Select BOTH DELETE statements below and run them together
-- ============================================

-- Step 1: First, remove the foreign key references in autopilot_activity_logs
-- Set conversation_id to NULL for any autopilot logs that reference the conversations we're about to delete
-- This prevents the foreign key constraint error
UPDATE autopilot_activity_logs
SET conversation_id = NULL
WHERE conversation_id IN (
  SELECT c.id
  FROM conversations c
  INNER JOIN leads l ON c.lead_id = l.id
  WHERE (l.source = 'facebook'
     OR c.channel = 'facebook'
     OR l.metadata->>'facebookProfileId' IS NOT NULL
     OR l.metadata->>'facebookConversationId' IS NOT NULL
     OR l.metadata->>'facebookListingId' IS NOT NULL
     OR l.metadata->>'facebookProfileName' IS NOT NULL)
  AND c.channel = 'facebook'
  AND c.type = 'outgoing'
  AND (c.delivery_status = 'pending' OR c.delivery_status IS NULL)
);

-- Step 2: Delete ALL unsent outgoing conversations for Facebook leads (these show in messages view)
-- This deletes ALL outgoing conversations with pending status for Facebook leads, regardless of pending_replies linkage
-- This ensures we catch all conversations that appear in the messages view
DELETE FROM conversations
WHERE lead_id IN (
  SELECT id 
  FROM leads 
  WHERE source = 'facebook'
     OR metadata->>'facebookProfileId' IS NOT NULL
     OR metadata->>'facebookConversationId' IS NOT NULL
     OR metadata->>'facebookListingId' IS NOT NULL
     OR metadata->>'facebookProfileName' IS NOT NULL
)
AND channel = 'facebook'
AND type = 'outgoing'
AND (delivery_status = 'pending' OR delivery_status IS NULL);

-- Step 2: Delete ALL pending replies for Facebook leads
-- This deletes pending replies where:
-- - Lead source is 'facebook', OR
-- - Pending reply channel is 'facebook', OR  
-- - Lead has Facebook metadata (facebookProfileId, facebookConversationId, etc.)
DELETE FROM pending_replies
WHERE lead_id IN (
  SELECT id 
  FROM leads 
  WHERE source = 'facebook'
     OR metadata->>'facebookProfileId' IS NOT NULL
     OR metadata->>'facebookConversationId' IS NOT NULL
     OR metadata->>'facebookListingId' IS NOT NULL
     OR metadata->>'facebookProfileName' IS NOT NULL
)
OR channel = 'facebook';

-- ============================================
-- VERIFY: Check that deletions were successful
-- ============================================

-- Should return 0 rows for pending replies after deletion
SELECT 
  COUNT(*) as remaining_facebook_pending_replies
FROM pending_replies pr
INNER JOIN leads l ON pr.lead_id = l.id
WHERE l.source = 'facebook' 
   OR pr.channel = 'facebook'
   OR l.metadata->>'facebookProfileId' IS NOT NULL
   OR l.metadata->>'facebookConversationId' IS NOT NULL
   OR l.metadata->>'facebookListingId' IS NOT NULL
   OR l.metadata->>'facebookProfileName' IS NOT NULL;

-- Should return 0 rows for unsent conversations after deletion
SELECT 
  COUNT(*) as remaining_unsent_facebook_conversations
FROM conversations c
INNER JOIN leads l ON c.lead_id = l.id
WHERE (l.source = 'facebook'
   OR c.channel = 'facebook'
   OR l.metadata->>'facebookProfileId' IS NOT NULL
   OR l.metadata->>'facebookConversationId' IS NOT NULL
   OR l.metadata->>'facebookListingId' IS NOT NULL
   OR l.metadata->>'facebookProfileName' IS NOT NULL)
AND c.type = 'outgoing'
AND (c.delivery_status = 'pending' OR c.delivery_status IS NULL);

