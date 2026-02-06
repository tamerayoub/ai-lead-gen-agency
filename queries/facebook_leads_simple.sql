-- Simple query to display all Facebook leads with their IDs
-- Run this query to see all Facebook lead data

SELECT 
  l.id AS lead_id,
  l.name AS lead_name,
  l.email,
  l.phone,
  l.status,
  l.created_at,
  
  -- Facebook Profile ID (from external_id)
  l.external_id AS facebook_profile_id,
  
  -- Facebook Listing ID (from metadata)
  l.metadata->>'facebookListingId' AS facebook_listing_id,
  
  -- Facebook Conversation ID (from metadata)
  l.metadata->>'facebookConversationId' AS facebook_conversation_id,
  
  -- Organization
  o.name AS organization_name,
  
  -- Property (if linked)
  p.name AS property_name

FROM leads l
LEFT JOIN organizations o ON l.org_id = o.id
LEFT JOIN properties p ON l.property_id = p.id
WHERE l.source = 'facebook'
ORDER BY l.created_at DESC;

