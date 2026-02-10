-- Users with acquisition attribution (offer, source, campaign, landing page)
-- Run to see signups by offer/source

SELECT
  id,
  email,
  first_name,
  last_name,
  company,
  provider,
  created_at,
  initial_offer AS offer,
  utm_source AS source,
  
  utm_medium AS medium,
  utm_campaign AS campaign,
  utm_content AS content,
  landing_page,
  first_touch_ts
FROM users
ORDER BY created_at DESC;
