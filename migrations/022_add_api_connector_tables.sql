-- API Connector: API keys, audit log, idempotency, webhook endpoints and deliveries
-- See server/API_CONNECTOR_ARCHITECTURE.md

-- API keys (hashed, prefix for lookup)
CREATE TABLE IF NOT EXISTS integration_api_keys (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hashed_key TEXT NOT NULL,
  key_prefix VARCHAR(8) NOT NULL,
  scopes JSONB NOT NULL DEFAULT '[]',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_by_user_id VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  revoked_at TIMESTAMP,
  last_used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_integration_api_keys_org_prefix ON integration_api_keys(org_id, key_prefix);
CREATE INDEX IF NOT EXISTS idx_integration_api_keys_org ON integration_api_keys(org_id);

-- Audit log for every API request
CREATE TABLE IF NOT EXISTS integration_api_audit_log (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  api_key_id VARCHAR REFERENCES integration_api_keys(id),
  actor_type VARCHAR NOT NULL DEFAULT 'api_key',
  method VARCHAR(10) NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER,
  request_id TEXT,
  idempotency_key TEXT,
  ip TEXT,
  user_agent TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_integration_api_audit_org_created ON integration_api_audit_log(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_integration_api_audit_key ON integration_api_audit_log(api_key_id);

-- Idempotency for writes (POST/PUT/PATCH)
CREATE TABLE IF NOT EXISTS integration_api_idempotency (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  api_key_id VARCHAR REFERENCES integration_api_keys(id),
  idempotency_key VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  path TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body_json TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(org_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_integration_api_idempotency_org ON integration_api_idempotency(org_id);

-- Webhook endpoints
CREATE TABLE IF NOT EXISTS integration_api_webhook_endpoints (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events JSONB NOT NULL DEFAULT '[]',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_integration_api_webhook_endpoints_org ON integration_api_webhook_endpoints(org_id);

-- Webhook deliveries (attempts, retries)
CREATE TABLE IF NOT EXISTS integration_api_webhook_deliveries (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  endpoint_id VARCHAR NOT NULL REFERENCES integration_api_webhook_endpoints(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMP,
  next_retry_at TIMESTAMP,
  response_code INTEGER,
  response_body_snippet TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_integration_api_webhook_deliveries_endpoint ON integration_api_webhook_deliveries(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_integration_api_webhook_deliveries_next_retry ON integration_api_webhook_deliveries(next_retry_at) WHERE status = 'pending';
