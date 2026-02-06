-- External auth secrets: store only Key Vault secret references (no plaintext).
-- See server/facebookAuthSecrets.service.ts and server/keyVault.ts

CREATE TABLE IF NOT EXISTS external_auth_secrets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR NOT NULL DEFAULT 'facebook',
  credential_kind VARCHAR NOT NULL,
  secret_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  last_used_at TIMESTAMP,
  rotated_at TIMESTAMP,
  UNIQUE(org_id, user_id, provider, credential_kind)
);

CREATE INDEX IF NOT EXISTS idx_external_auth_secrets_org_user ON external_auth_secrets(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_external_auth_secrets_provider ON external_auth_secrets(provider);

COMMENT ON TABLE external_auth_secrets IS 'References to secrets in Azure Key Vault; no plaintext stored';

-- Audit log for secret access (no secret values)
CREATE TABLE IF NOT EXISTS external_auth_secret_audit (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR NOT NULL DEFAULT 'facebook',
  action TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_external_auth_secret_audit_org_created ON external_auth_secret_audit(org_id, created_at);
