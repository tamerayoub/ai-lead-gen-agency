-- Performance indexes for messages inbox query
-- Run these ONE AT A TIME in Replit database console
-- Replit may not support IF NOT EXISTS, so check if index exists first

-- 1. Index on conversations.lead_id (for joins and window functions)
CREATE INDEX idx_conversations_lead_id ON conversations(lead_id);

-- 2. Index on conversations.created_at (for ordering and window functions)
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);

-- 3. Composite index for unread count queries (type + created_at + lead_id)
CREATE INDEX idx_conversations_type_created_lead 
  ON conversations(type, created_at DESC, lead_id) 
  WHERE type IN ('received', 'incoming');

-- 4. Index on conversations.type for filtering
CREATE INDEX idx_conversations_type ON conversations(type) 
  WHERE type IN ('outgoing', 'sent', 'received', 'incoming');

-- 5. Index on leads.org_id (critical for filtering by organization)
CREATE INDEX idx_leads_org_id ON leads(org_id);

-- 6. Composite index for the main query (org_id + created_at for ordering)
CREATE INDEX idx_leads_org_created ON leads(org_id, created_at DESC);

-- 7. Index on conversations for the unread count subquery
CREATE INDEX idx_conversations_lead_type_created 
  ON conversations(lead_id, type, created_at DESC);
