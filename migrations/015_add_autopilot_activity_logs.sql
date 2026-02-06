-- Create autopilot_activity_logs table
-- This table stores activity logs for the Auto-Pilot AI Leasing Agent feature
-- Migration: 015_add_autopilot_activity_logs

-- Create table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'autopilot_activity_logs'
    ) THEN
        CREATE TABLE autopilot_activity_logs (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          org_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          lead_id VARCHAR NOT NULL REFERENCES leads(id),
          lead_name TEXT NOT NULL,
          lead_message TEXT NOT NULL,
          ai_reply TEXT NOT NULL,
          sent BOOLEAN NOT NULL DEFAULT false,
          channel TEXT NOT NULL, -- 'email', 'facebook', etc.
          conversation_id VARCHAR REFERENCES conversations(id),
          metadata JSONB, -- Additional context like autoPilotReason, confidenceLevel, etc.
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        -- Create indexes for better query performance
        CREATE INDEX idx_autopilot_org_created ON autopilot_activity_logs(org_id, created_at);
        CREATE INDEX idx_autopilot_lead ON autopilot_activity_logs(lead_id);

        COMMENT ON TABLE autopilot_activity_logs IS 'Stores activity logs for the Auto-Pilot AI Leasing Agent feature';
    END IF;
END $$;

