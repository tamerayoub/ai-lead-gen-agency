-- Fix ai_settings rows with NULL org_id
-- Migration 008 tries to insert a global setting with org_id = NULL,
-- but the schema requires org_id to be NOT NULL.
-- This migration deletes or fixes those rows before 008 runs.

-- Option 1: Delete rows with NULL org_id (if they're not needed)
DELETE FROM ai_settings WHERE org_id IS NULL;

-- If you need global settings, you would need to change the schema to allow NULL org_id
-- But for now, we'll just delete them since we can't have NULL org_id

