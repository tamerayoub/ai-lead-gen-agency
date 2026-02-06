-- SQL Query to List Facebook Leads with Conversations and Messages
-- This query shows all Facebook leads, their conversations, and messages in chronological order

-- ============================================
-- MAIN QUERY: Facebook Leads with Full Conversation History
-- ============================================
SELECT 
  -- Lead Information
  l.id as lead_id,
  l.name as lead_name,
  l.email as lead_email,
  l.phone as lead_phone,
  l.org_id as organization_id,
  o.name as organization_name,
  l.source,
  l.status as lead_status,
  l.created_at as lead_created_at,
  l.last_contact_at as lead_last_contact_at,
  
  -- Facebook-specific metadata
  l.metadata->>'facebookProfileId' as facebook_profile_id,
  l.metadata->>'facebookProfileName' as facebook_profile_name,
  l.metadata->>'facebookConversationId' as facebook_conversation_id,
  l.metadata->>'facebookListingId' as facebook_listing_id,
  l.external_id as external_id,
  
  -- Conversation Information
  c.id as conversation_id,
  c.type as message_type,  -- 'incoming', 'outgoing', 'received', 'sent'
  c.channel as message_channel,  -- 'facebook', 'email', etc.
  c.message as message_content,
  c.created_at as message_created_at,
  c.delivery_status as delivery_status,
  c.ai_generated as ai_generated,
  c.external_id as message_external_id,
  
  -- Message ordering (for sorting)
  ROW_NUMBER() OVER (
    PARTITION BY l.id, c.lead_id 
    ORDER BY c.created_at ASC
  ) as message_order_in_conversation,
  
  -- Count messages per lead (for reference)
  COUNT(*) OVER (PARTITION BY l.id) as total_messages_for_lead,
  
  -- Count conversations per lead
  COUNT(DISTINCT c.id) OVER (PARTITION BY l.id) as total_conversations_for_lead

FROM leads l
INNER JOIN organizations o ON l.org_id = o.id
LEFT JOIN conversations c ON c.lead_id = l.id AND c.channel = 'facebook'
WHERE l.source = 'facebook'
  -- Optional: Filter by organization (uncomment and set org_id if needed)
  -- AND l.org_id = 'YOUR_ORG_ID_HERE'
ORDER BY 
  l.created_at DESC,  -- Newest leads first
  l.id,                -- Group by lead
  c.created_at ASC     -- Messages in chronological order (oldest first)
;

-- ============================================
-- SUMMARY QUERY: Count Facebook Leads and Messages
-- ============================================
SELECT 
  COUNT(DISTINCT l.id) as total_facebook_leads,
  COUNT(DISTINCT c.id) as total_facebook_conversations,
  COUNT(c.id) as total_facebook_messages,
  COUNT(CASE WHEN c.type IN ('incoming', 'received') THEN 1 END) as messages_from_leads,
  COUNT(CASE WHEN c.type IN ('outgoing', 'sent') THEN 1 END) as messages_to_leads,
  COUNT(CASE WHEN c.delivery_status = 'pending' THEN 1 END) as pending_messages,
  COUNT(CASE WHEN c.delivery_status = 'sent' THEN 1 END) as sent_messages,
  COUNT(CASE WHEN c.ai_generated = true THEN 1 END) as ai_generated_messages
FROM leads l
LEFT JOIN conversations c ON c.lead_id = l.id AND c.channel = 'facebook'
WHERE l.source = 'facebook'
  -- Optional: Filter by organization
  -- AND l.org_id = 'YOUR_ORG_ID_HERE'
;

-- ============================================
-- DETAILED VIEW: One Row Per Lead with Latest Message
-- ============================================
SELECT 
  l.id as lead_id,
  l.name as lead_name,
  l.email as lead_email,
  l.org_id as organization_id,
  o.name as organization_name,
  l.metadata->>'facebookProfileId' as facebook_profile_id,
  l.metadata->>'facebookProfileName' as facebook_profile_name,
  l.metadata->>'facebookConversationId' as facebook_conversation_id,
  l.metadata->>'facebookListingId' as facebook_listing_id,
  l.status as lead_status,
  l.created_at as lead_created_at,
  l.last_contact_at as lead_last_contact_at,
  
  -- Latest message info
  latest_msg.message as latest_message_content,
  latest_msg.type as latest_message_type,
  latest_msg.created_at as latest_message_at,
  latest_msg.delivery_status as latest_message_delivery_status,
  
  -- Message counts
  msg_counts.total_messages,
  msg_counts.messages_from_lead,
  msg_counts.messages_to_lead,
  msg_counts.pending_messages

FROM leads l
INNER JOIN organizations o ON l.org_id = o.id
LEFT JOIN LATERAL (
  SELECT 
    c.message,
    c.type,
    c.created_at,
    c.delivery_status
  FROM conversations c
  WHERE c.lead_id = l.id 
    AND c.channel = 'facebook'
  ORDER BY c.created_at DESC
  LIMIT 1
) latest_msg ON true
LEFT JOIN LATERAL (
  SELECT 
    COUNT(*) as total_messages,
    COUNT(CASE WHEN c.type IN ('incoming', 'received') THEN 1 END) as messages_from_lead,
    COUNT(CASE WHEN c.type IN ('outgoing', 'sent') THEN 1 END) as messages_to_lead,
    COUNT(CASE WHEN c.delivery_status = 'pending' THEN 1 END) as pending_messages
  FROM conversations c
  WHERE c.lead_id = l.id 
    AND c.channel = 'facebook'
) msg_counts ON true
WHERE l.source = 'facebook'
  -- Optional: Filter by organization
  -- AND l.org_id = 'YOUR_ORG_ID_HERE'
ORDER BY l.created_at DESC
;

-- ============================================
-- CONVERSATION THREAD VIEW: Messages Grouped by Lead
-- ============================================
-- This query shows messages in a thread-like format, easier to read
SELECT 
  l.id as lead_id,
  l.name as lead_name,
  l.metadata->>'facebookProfileName' as facebook_profile_name,
  l.metadata->>'facebookConversationId' as conversation_id,
  l.metadata->>'facebookListingId' as listing_id,
  
  -- Message details
  c.id as message_id,
  CASE 
    WHEN c.type IN ('incoming', 'received') THEN 'FROM LEAD'
    WHEN c.type IN ('outgoing', 'sent') THEN 'TO LEAD'
    ELSE c.type
  END as message_direction,
  c.message as message_text,
  c.created_at as message_timestamp,
  c.delivery_status,
  c.ai_generated,
  
  -- Message number in conversation (1 = first message, 2 = second, etc.)
  ROW_NUMBER() OVER (
    PARTITION BY l.id 
    ORDER BY c.created_at ASC
  ) as message_number

FROM leads l
LEFT JOIN conversations c ON c.lead_id = l.id AND c.channel = 'facebook'
WHERE l.source = 'facebook'
  -- Optional: Filter by organization
  -- AND l.org_id = 'YOUR_ORG_ID_HERE'
  -- Optional: Filter by specific lead
  -- AND l.id = 'YOUR_LEAD_ID_HERE'
ORDER BY 
  l.created_at DESC,
  l.id,
  c.created_at ASC  -- Messages in chronological order
;

-- ============================================
-- LEADS WITHOUT CONVERSATIONS
-- ============================================
-- Find Facebook leads that have no messages yet
SELECT 
  l.id as lead_id,
  l.name as lead_name,
  l.email as lead_email,
  l.org_id as organization_id,
  o.name as organization_name,
  l.metadata->>'facebookProfileId' as facebook_profile_id,
  l.metadata->>'facebookConversationId' as facebook_conversation_id,
  l.created_at as lead_created_at,
  l.last_contact_at as lead_last_contact_at
FROM leads l
INNER JOIN organizations o ON l.org_id = o.id
LEFT JOIN conversations c ON c.lead_id = l.id AND c.channel = 'facebook'
WHERE l.source = 'facebook'
  AND c.id IS NULL  -- No conversations found
  -- Optional: Filter by organization
  -- AND l.org_id = 'YOUR_ORG_ID_HERE'
ORDER BY l.created_at DESC
;

-- ============================================
-- MESSAGES BY TYPE AND STATUS
-- ============================================
-- Breakdown of messages by type and delivery status
SELECT 
  l.id as lead_id,
  l.name as lead_name,
  c.type as message_type,
  c.delivery_status,
  COUNT(*) as message_count,
  MIN(c.created_at) as first_message_at,
  MAX(c.created_at) as last_message_at
FROM leads l
INNER JOIN conversations c ON c.lead_id = l.id AND c.channel = 'facebook'
WHERE l.source = 'facebook'
  -- Optional: Filter by organization
  -- AND l.org_id = 'YOUR_ORG_ID_HERE'
GROUP BY l.id, l.name, c.type, c.delivery_status
ORDER BY l.name, c.type, c.delivery_status
;

-- ============================================
-- ALL CONVERSATIONS WITH ASSIGNED LEADS
-- ============================================
-- View all Facebook conversations and the leads they belong to
SELECT 
  -- Conversation Information
  c.id as conversation_id,
  c.lead_id,
  c.type as message_type,
  c.channel,
  c.message as message_content,
  c.created_at as conversation_created_at,
  c.delivery_status,
  c.ai_generated,
  c.external_id as conversation_external_id,
  
  -- Lead Information
  l.name as lead_name,
  l.email as lead_email,
  l.phone as lead_phone,
  l.org_id as organization_id,
  o.name as organization_name,
  l.source as lead_source,
  l.status as lead_status,
  l.created_at as lead_created_at,
  l.last_contact_at as lead_last_contact_at,
  
  -- Facebook-specific metadata
  l.metadata->>'facebookProfileId' as facebook_profile_id,
  l.metadata->>'facebookProfileName' as facebook_profile_name,
  l.metadata->>'facebookConversationId' as facebook_conversation_id,
  l.metadata->>'facebookListingId' as facebook_listing_id,
  l.external_id as lead_external_id,
  
  -- Conversation statistics for this lead
  conversation_stats.total_messages_for_lead,
  conversation_stats.messages_from_lead,
  conversation_stats.messages_to_lead,
  conversation_stats.first_message_at,
  conversation_stats.last_message_at

FROM conversations c
INNER JOIN leads l ON c.lead_id = l.id
INNER JOIN organizations o ON l.org_id = o.id
LEFT JOIN LATERAL (
  SELECT 
    COUNT(*) as total_messages_for_lead,
    COUNT(CASE WHEN c2.type IN ('incoming', 'received') THEN 1 END) as messages_from_lead,
    COUNT(CASE WHEN c2.type IN ('outgoing', 'sent') THEN 1 END) as messages_to_lead,
    MIN(c2.created_at) as first_message_at,
    MAX(c2.created_at) as last_message_at
  FROM conversations c2
  WHERE c2.lead_id = l.id 
    AND c2.channel = 'facebook'
) conversation_stats ON true
WHERE c.channel = 'facebook'
  -- Optional: Filter by organization
  -- AND l.org_id = 'YOUR_ORG_ID_HERE'
  -- Optional: Filter by specific lead
  -- AND l.id = 'YOUR_LEAD_ID_HERE'
ORDER BY 
  c.created_at DESC,  -- Newest conversations first
  l.name,             -- Group by lead name
  c.created_at ASC     -- Messages in chronological order
;

-- ============================================
-- CONVERSATION SUMMARY BY LEAD
-- ============================================
-- Summary view: All conversations grouped by lead
SELECT 
  -- Lead Information
  l.id as lead_id,
  l.name as lead_name,
  l.email as lead_email,
  l.phone as lead_phone,
  l.org_id as organization_id,
  o.name as organization_name,
  l.status as lead_status,
  l.metadata->>'facebookProfileName' as facebook_profile_name,
  l.metadata->>'facebookConversationId' as facebook_conversation_id,
  l.metadata->>'facebookListingId' as facebook_listing_id,
  
  -- Conversation Statistics
  COUNT(DISTINCT c.id) as total_conversations,
  COUNT(c.id) as total_messages,
  COUNT(CASE WHEN c.type IN ('incoming', 'received') THEN 1 END) as messages_from_lead,
  COUNT(CASE WHEN c.type IN ('outgoing', 'sent') THEN 1 END) as messages_to_lead,
  COUNT(CASE WHEN c.delivery_status = 'pending' THEN 1 END) as pending_messages,
  COUNT(CASE WHEN c.delivery_status = 'sent' THEN 1 END) as sent_messages,
  COUNT(CASE WHEN c.ai_generated = true THEN 1 END) as ai_generated_messages,
  MIN(c.created_at) as first_conversation_at,
  MAX(c.created_at) as last_conversation_at,
  l.created_at as lead_created_at,
  l.last_contact_at as lead_last_contact_at

FROM leads l
INNER JOIN organizations o ON l.org_id = o.id
LEFT JOIN conversations c ON c.lead_id = l.id AND c.channel = 'facebook'
WHERE l.source = 'facebook'
  -- Optional: Filter by organization
  -- AND l.org_id = 'YOUR_ORG_ID_HERE'
GROUP BY 
  l.id, 
  l.name, 
  l.email, 
  l.phone, 
  l.org_id, 
  o.name, 
  l.status, 
  l.metadata, 
  l.created_at, 
  l.last_contact_at
ORDER BY 
  MAX(c.created_at) DESC NULLS LAST,  -- Leads with recent conversations first
  l.created_at DESC                   -- Then by lead creation date
;

-- ============================================
-- CONVERSATION THREAD: Messages in Order for a Specific Lead
-- ============================================
-- View all messages for a specific lead in chronological order
-- Shows who sent each message (Lead or Me) in a clear thread format
-- 
-- Usage: Replace 'YOUR_LEAD_ID_HERE' with the actual lead ID
-- Or filter by lead name, email, or conversation ID

SELECT 
  -- Lead Information
  l.id as lead_id,
  l.name as lead_name,
  l.email as lead_email,
  l.phone as lead_phone,
  l.metadata->>'facebookProfileName' as facebook_profile_name,
  l.metadata->>'facebookConversationId' as facebook_conversation_id,
  l.metadata->>'facebookListingId' as facebook_listing_id,
  
  -- Message Information
  c.id as message_id,
  c.created_at as message_timestamp,
  
  -- Message Direction (who sent it)
  CASE 
    WHEN c.type IN ('incoming', 'received') THEN 'FROM LEAD'
    WHEN c.type IN ('outgoing', 'sent') THEN 'TO LEAD (ME)'
    ELSE UPPER(c.type)
  END as message_from,
  
  -- Message Content
  c.message as message_text,
  
  -- Message Metadata
  c.delivery_status,
  c.ai_generated,
  c.external_id as message_external_id,
  
  -- Message Number in Conversation (1 = first message, 2 = second, etc.)
  ROW_NUMBER() OVER (
    PARTITION BY l.id 
    ORDER BY c.created_at ASC
  ) as message_number,
  
  -- Total messages in this conversation
  COUNT(*) OVER (PARTITION BY l.id) as total_messages_in_conversation

FROM leads l
INNER JOIN conversations c ON c.lead_id = l.id
WHERE l.source = 'facebook'
  AND c.channel = 'facebook'
  -- Filter by specific lead (uncomment and set one of these):
  -- AND l.id = 'YOUR_LEAD_ID_HERE'
  -- AND l.name = 'Lead Name Here'
  -- AND l.email = 'lead@example.com'
  -- AND l.metadata->>'facebookConversationId' = 'YOUR_CONVERSATION_ID_HERE'
  -- Optional: Filter by organization
  -- AND l.org_id = 'YOUR_ORG_ID_HERE'
ORDER BY 
  l.id,
  c.created_at ASC  -- Messages in chronological order (oldest first)
;

-- ============================================
-- CONVERSATION THREAD: All Leads with Full Message Threads
-- ============================================
-- View all Facebook leads with their complete message threads in chronological order
-- This shows the full conversation history for each lead

SELECT 
  -- Lead Information
  l.id as lead_id,
  l.name as lead_name,
  l.email as lead_email,
  l.metadata->>'facebookProfileName' as facebook_profile_name,
  l.metadata->>'facebookConversationId' as facebook_conversation_id,
  l.metadata->>'facebookListingId' as facebook_listing_id,
  l.org_id as organization_id,
  o.name as organization_name,
  
  -- Message Information
  c.id as message_id,
  c.created_at as message_timestamp,
  
  -- Message Direction
  CASE 
    WHEN c.type IN ('incoming', 'received') THEN 'FROM LEAD'
    WHEN c.type IN ('outgoing', 'sent') THEN 'TO LEAD (ME)'
    ELSE UPPER(c.type)
  END as message_from,
  
  -- Message Content
  c.message as message_text,
  
  -- Message Metadata
  c.delivery_status,
  c.ai_generated,
  
  -- Message Number in Conversation
  ROW_NUMBER() OVER (
    PARTITION BY l.id 
    ORDER BY c.created_at ASC
  ) as message_number,
  
  -- Conversation Statistics
  COUNT(*) OVER (PARTITION BY l.id) as total_messages,
  COUNT(CASE WHEN c.type IN ('incoming', 'received') THEN 1 END) OVER (PARTITION BY l.id) as messages_from_lead,
  COUNT(CASE WHEN c.type IN ('outgoing', 'sent') THEN 1 END) OVER (PARTITION BY l.id) as messages_to_lead,
  MIN(c.created_at) OVER (PARTITION BY l.id) as first_message_at,
  MAX(c.created_at) OVER (PARTITION BY l.id) as last_message_at

FROM leads l
INNER JOIN organizations o ON l.org_id = o.id
INNER JOIN conversations c ON c.lead_id = l.id
WHERE l.source = 'facebook'
  AND c.channel = 'facebook'
  -- Optional: Filter by organization
  -- AND l.org_id = 'YOUR_ORG_ID_HERE'
ORDER BY 
  l.name,              -- Group by lead name
  c.created_at ASC     -- Messages in chronological order (oldest first)
;

