-- Demo requests with acquisition attribution (offer, source, campaign, landing page)
-- Run to see demo submissions by offer/source

SELECT
  id,
  email,
  first_name,
  last_name,
  company,
  phone,
  units_under_management,
  created_at,
  initial_offer AS offer,
  utm_source AS source,
  utm_medium AS medium,
  utm_campaign AS campaign,
  landing_page,
  first_touch_ts
FROM demo_requests
ORDER BY created_at DESC;
