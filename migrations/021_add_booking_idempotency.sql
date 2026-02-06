-- Idempotency table for in-chat tour bookings
-- Prevents double-booking when user confirms twice or network retries
CREATE TABLE IF NOT EXISTS booking_idempotency (
  idempotency_key VARCHAR(128) PRIMARY KEY,
  lead_id VARCHAR(255) NOT NULL,
  org_id VARCHAR(255) NOT NULL,
  showing_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_booking_idempotency_lead ON booking_idempotency(lead_id);
CREATE INDEX IF NOT EXISTS idx_booking_idempotency_org ON booking_idempotency(org_id);
