-- Add organization_name column to onboarding_intakes table
ALTER TABLE onboarding_intakes ADD COLUMN IF NOT EXISTS organization_name TEXT;

