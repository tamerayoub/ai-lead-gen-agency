-- Add ai_enabled column to leads table to toggle AI features per-lead
-- Matches schema definition in shared/schema.ts (aiEnabled: boolean default true, not null)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'ai_enabled'
    ) THEN
        ALTER TABLE leads
        ADD COLUMN ai_enabled BOOLEAN NOT NULL DEFAULT TRUE;

        COMMENT ON COLUMN leads.ai_enabled IS 'Enable/disable AI for this lead';
    END IF;
END $$;


