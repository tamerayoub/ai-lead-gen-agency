/**
 * Offer keys mapped to landing page paths for acquisition attribution
 */
export const OFFER_BY_PATH = {
  "/fb-integration": "facebook_marketplace_integration",
  "/fb-ai-leasing-agent": "fb_marketplace_ai_leasing_agent",
  "/book-demo": "book_demo",
} as const;

export type OfferKey = (typeof OFFER_BY_PATH)[keyof typeof OFFER_BY_PATH];

export const VALID_OFFERS: readonly string[] = [
  "facebook_marketplace_integration",
  "fb_marketplace_ai_leasing_agent",
  "book_demo",
] as const;
