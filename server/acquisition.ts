/**
 * Server-side acquisition attribution helpers
 * Validates and normalizes acquisition context from client; stores only on first-touch
 */

const VALID_OFFERS = ["fb_marketplace_ai_leasing_agent", "facebook_marketplace_integration", "book_demo"] as const;
const MAX_LEN = 200;

export interface AcquisitionContextInput {
  offer?: string | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  term?: string | null;
  content?: string | null;
  landing_page?: string | null;
  referrer?: string | null;
  first_touch_ts?: string | null;
}

export interface NormalizedAcquisition {
  initialOffer: string;
  acquisitionContextJson: Record<string, unknown>;
  firstTouchTs: Date | null;
  landingPage: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
}

function trimLimit(val: string | null | undefined, max: number = MAX_LEN): string | null {
  if (val == null || typeof val !== "string") return null;
  const t = val.trim();
  return t ? t.slice(0, max) : null;
}

/** Validate and normalize acquisition context from client */
export function normalizeAcquisitionContext(
  ctx: AcquisitionContextInput | null | undefined,
  fallbackUtms?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string },
  fallbackLanding?: string
): NormalizedAcquisition | null {
  const offer = trimLimit(ctx?.offer, 100);
  const validOffer = offer && VALID_OFFERS.includes(offer as (typeof VALID_OFFERS)[number]) ? offer : "unknown";
  const source = trimLimit(ctx?.source) || trimLimit(fallbackUtms?.source) || "direct";
  const medium = trimLimit(ctx?.medium) || trimLimit(fallbackUtms?.medium);
  const campaign = trimLimit(ctx?.campaign) || trimLimit(fallbackUtms?.campaign);
  const term = trimLimit(ctx?.term) || trimLimit(fallbackUtms?.term);
  const content = trimLimit(ctx?.content) || trimLimit(fallbackUtms?.content);
  const landingPage = trimLimit(ctx?.landing_page, 500) || trimLimit(fallbackLanding, 500);
  let firstTouchTs: Date | null = null;
  if (ctx?.first_touch_ts && typeof ctx.first_touch_ts === "string") {
    const d = new Date(ctx.first_touch_ts);
    if (!isNaN(d.getTime())) firstTouchTs = d;
  }
  const acquisitionContextJson = {
    offer: validOffer,
    source,
    medium,
    campaign,
    term,
    content,
    landing_page: landingPage,
    referrer: trimLimit(ctx?.referrer, 500),
    first_touch_ts: ctx?.first_touch_ts ?? null,
  };
  return {
    initialOffer: validOffer,
    acquisitionContextJson,
    firstTouchTs,
    landingPage,
    utmSource: source,
    utmMedium: medium,
    utmCampaign: campaign,
    utmTerm: term,
    utmContent: content,
  };
}
