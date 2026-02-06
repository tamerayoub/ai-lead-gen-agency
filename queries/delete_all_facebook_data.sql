-- Simple Script to Delete All Facebook Data
-- ⚠️ WARNING: This will permanently delete all Facebook-related data! ⚠️
-- Run at your own risk. Consider backing up first.

-- ============================================
-- PREVIEW: See what will be deleted
-- ============================================
SELECT 
  COUNT(*) as facebook_conversations_to_delete
FROM conversations
WHERE channel = 'facebook';

SELECT 
  COUNT(*) as facebook_leads_to_delete
FROM leads
WHERE source = 'facebook';

SELECT 
  COUNT(*) as leads_with_facebook_metadata
FROM leads
WHERE metadata->>'facebookProfileId' IS NOT NULL
   OR metadata->>'facebookConversationId' IS NOT NULL
   OR metadata->>'facebookListingId' IS NOT NULL
   OR metadata->>'facebookProfileName' IS NOT NULL
   OR external_id IS NOT NULL;

-- ============================================
-- DELETE: Select all three statements below and run together
-- Replit will automatically wrap them in a transaction
-- ============================================

-- 1. Delete all Facebook conversations/messages
DELETE FROM conversations
WHERE channel = 'facebook';

-- 2. Clear Facebook metadata from leads
UPDATE leads
SET 
  metadata = metadata - 'facebookProfileId' - 'facebookProfileName' - 'facebookConversationId' - 'facebookListingId',
  external_id = NULL
WHERE metadata ? 'facebookProfileId'
   OR metadata ? 'facebookConversationId'
   OR metadata ? 'facebookListingId'
   OR metadata ? 'facebookProfileName'
   OR external_id IS NOT NULL;

-- 3. Delete Facebook leads
DELETE FROM leads
WHERE source = 'facebook';

-- ============================================
-- VERIFY: Check if anything remains
-- ============================================
SELECT 
  COUNT(*) as remaining_facebook_conversations
FROM conversations
WHERE channel = 'facebook';

SELECT 
  COUNT(*) as remaining_facebook_leads
FROM leads
WHERE source = 'facebook';

SELECT 
  COUNT(*) as remaining_facebook_metadata
FROM leads
WHERE metadata->>'facebookProfileId' IS NOT NULL
   OR metadata->>'facebookConversationId' IS NOT NULL
   OR metadata->>'facebookListingId' IS NOT NULL
   OR metadata->>'facebookProfileName' IS NOT NULL
   OR external_id IS NOT NULL;
