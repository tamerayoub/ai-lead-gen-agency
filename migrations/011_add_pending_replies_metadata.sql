-- Add metadata column to pending_replies table
-- This column is defined in the schema but may not exist in the database yet
-- Migration: 011_add_pending_replies_metadata

-- Add metadata column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pending_replies' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE pending_replies ADD COLUMN metadata JSONB;
        COMMENT ON COLUMN pending_replies.metadata IS 'Stores auto-pilot metadata: { sentViaAutoPilot, confidenceLevel, autoPilotReason, questionType, originalContent, editedByUser, editedAt }';
    END IF;
END $$;

