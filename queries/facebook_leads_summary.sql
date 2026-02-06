-- Summary statistics for Facebook leads
-- Run this to get counts and statistics

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
  COUNT(DISTINCT l.metadata->>'facebookConversationId') AS unique_conversations,
  COUNT(DISTINCT l.org_id) AS organizations_with_facebook_leads
FROM leads l
WHERE l.source = 'facebook';

