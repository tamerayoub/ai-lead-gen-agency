-- Query to display all Facebook leads with their associated data
-- This query extracts profile ID, listing ID, and conversation ID from the leads table

SELECT 
  -- Lead basic information
  l.id AS lead_id,
  l.name AS lead_name,
  l.email,
  l.phone,
  l.status,
  l.source,
  l.created_at,
  l.last_contact_at,
  
  -- Facebook IDs
  l.external_id AS facebook_profile_id,
  l.metadata->>'facebookProfileId' AS metadata_profile_id,
  l.metadata->>'facebookListingId' AS facebook_listing_id,
  l.metadata->>'facebookConversationId' AS facebook_conversation_id,
  
  -- Organization information
  l.org_id,
  o.name AS organization_name,
  
  -- Property information (if linked)
  l.property_id,
  p.name AS property_name,
  
  -- Full metadata for reference
  l.metadata AS full_metadata,
  
  -- Conversation count
  (SELECT COUNT(*) 
   FROM conversations c 
   WHERE c.lead_id = l.id 
   AND c.channel = 'facebook') AS facebook_conversation_count

FROM leads l
LEFT JOIN organizations o ON l.org_id = o.id
LEFT JOIN properties p ON l.property_id = p.id
WHERE l.source = 'facebook'
ORDER BY l.created_at DESC;

-- Summary statistics
-- Run this separately to get counts
/*
SELECT 
  COUNT(*) AS total_facebook_leads,
  COUNT(l.external_id) AS leads_with_profile_id,
  COUNT(l.metadata->>'facebookListingId') AS leads_with_listing_id,
  COUNT(l.metadata->>'facebookConversationId') AS leads_with_conversation_id,
  COUNT(CASE 
    WHEN l.external_id IS NOT NULL 
      AND l.metadata->>'facebookListingId' IS NOT NULL 
      AND l.metadata->>'facebookConversationId' IS NOT NULL 
    THEN 1 
  END) AS leads_with_all_three_ids,
  COUNT(DISTINCT l.metadata->>'facebookListingId') AS unique_listings,
  COUNT(DISTINCT l.metadata->>'facebookConversationId') AS unique_conversations
FROM leads l
WHERE l.source = 'facebook';
*/

-- Detailed view with conversation details
-- Run this to see all Facebook conversations for each lead
/*
SELECT 
  l.id AS lead_id,
  l.name AS lead_name,
  l.external_id AS facebook_profile_id,
  l.metadata->>'facebookListingId' AS listing_id,
  l.metadata->>'facebookConversationId' AS conversation_id,
  c.id AS conversation_record_id,
  c.type AS conversation_type,
  c.message,
  c.created_at AS conversation_created_at
FROM leads l
LEFT JOIN conversations c ON c.lead_id = l.id AND c.channel = 'facebook'
WHERE l.source = 'facebook'
ORDER BY l.created_at DESC, c.created_at DESC;
*/

