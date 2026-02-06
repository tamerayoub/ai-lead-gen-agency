-- Acquisition attribution: first-touch tracking for landing pages + UTMs
-- Stored on users table; never overwritten after initial set

ALTER TABLE users ADD COLUMN IF NOT EXISTS initial_offer varchar(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS acquisition_context_json jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_touch_ts timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS landing_page varchar(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_source varchar(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_medium varchar(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_campaign varchar(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_term varchar(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_content varchar(200);
