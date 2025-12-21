-- Add deleted_at column to organizations table for soft delete functionality
-- This column is defined in the schema but may not exist in the database yet

-- Add deleted_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE organizations ADD COLUMN deleted_at TIMESTAMP;
        COMMENT ON COLUMN organizations.deleted_at IS 'When organization was deleted (soft delete - 30 days grace period before permanent deletion)';
    END IF;
END $$;


