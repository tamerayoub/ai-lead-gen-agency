-- Migration: Add lead_ai_memory table for conversation memory
-- This table stores rolling conversation summaries and state per lead

CREATE TABLE IF NOT EXISTS lead_ai_memory (
  lead_id VARCHAR PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL DEFAULT '',
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_lead_ai_memory_updated_at ON lead_ai_memory(updated_at);

-- Add comment
COMMENT ON TABLE lead_ai_memory IS 'Stores conversation memory (summary and state) for each lead to enable context-aware AI responses';

