## Playwright notes (Facebook Marketplace)

Auth
- Set `PLAYWRIGHT_FB_EMAIL` and `PLAYWRIGHT_FB_PASSWORD` then run `npm run test:e2e -- --project=chromium` once to create `playwright/.auth/facebook.json`.
- Optional: `PLAYWRIGHT_HEADLESS=false` to watch the login.

Marketplace flow
- Set `TARGET_LISTING_URL` to the exact Marketplace listing URL you want to message.
- Optional message overrides:
  - `PLAYWRIGHT_FB_PREQUAL_MESSAGE`
  - `PLAYWRIGHT_FB_AVAILABILITY_MESSAGE`
  - `PLAYWRIGHT_FB_BOOKING_MESSAGE`
- Default messages sent:
  - Pre-qualify: "Hi! Are you looking to move in the next 30 days?"
  - Availability: "When are you available for a tour this week?"
  - Booking link: "Great — you can pick a time here: https://example.com/booking"

Running
- One-time login + flow: `npm run test:e2e -- --project=chromium`
- Re-run without envs as long as `playwright/.auth/facebook.json` is still valid.








