/**
 * Analytics wrapper - emits acquisition, lifecycle, and CTA events.
 * Sends to gtag (Google Analytics / Google Ads) when available.
 */

const isDev = typeof window !== "undefined" && (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.endsWith(".replit.dev") ||
  window.location.hostname.endsWith(".repl.co")
);

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export interface AcquisitionEventProps {
  offer?: string | null;
  source?: string | null;
  campaign?: string | null;
  landing_page?: string | null;
}

/** Offer identifiers for GA4 - maps landing paths to distinct tags for filtering */
export const GA_OFFER_KEYS = {
  "/fb-integration": "fb_integration",
  "/fb-ai-leasing-agent": "fb_ai_leasing_agent",
} as const;

export type GAOfferKey = (typeof GA_OFFER_KEYS)[keyof typeof GA_OFFER_KEYS];

export interface CTAClickProps {
  /** Offer / landing page identifier for GA4 segmentation */
  offer: GAOfferKey;
  /** Button label text (e.g. "Get Started Free") */
  button_label: string;
  /** Placement on page: hero | header | bottom | footer */
  placement: "hero" | "header" | "bottom" | "footer";
}

function logEvent(name: string, props: Record<string, unknown>): void {
  const hasGtag = typeof window !== "undefined" && typeof window.gtag === "function";
  if (isDev) {
    console.log(`[Analytics] ${name}`, props);
  }
  if (hasGtag) {
    window.gtag!("event", name, props);
    if (name === "cta_click") {
      console.log("[Analytics] CTA event sent to gtag:", { event: name, ...props });
    }
  } else if (name === "cta_click") {
    console.warn("[Analytics] CTA click NOT sent - gtag not available. Ensure Google tag (gtag.js) is loaded in index.html.");
  }
}

/** Emitted when a CTA button is clicked - distinct per offer for GA4 segmentation */
export function trackCTAClick(props: CTAClickProps): void {
  const payload = {
    ...props,
    event_category: "engagement",
    event_label: `${props.offer}_${props.placement}_${props.button_label.replace(/\s+/g, "_")}`,
  };
  logEvent("cta_click", payload);
}

/** Emitted when acquisition context is first captured on a landing page */
export function trackAcquisitionCaptured(props: AcquisitionEventProps): void {
  logEvent("acquisition_captured", props);
}

/** Emitted when signup completes (email or OAuth) */
export function trackSignupCompleted(props: AcquisitionEventProps): void {
  logEvent("signup_completed", props);
}

/** Emitted when onboarding is completed */
export function trackOnboardingCompleted(props: AcquisitionEventProps): void {
  logEvent("onboarding_completed", props);
}

/** Initialize Google Analytics (gtag loaded via index.html) */
export function initGoogleAnalytics(): void {
  if (typeof window === "undefined") return;
  const hasGtag = typeof window.gtag === "function";
  const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;

  if (hasGtag) {
    console.log("[Analytics] gtag available - CTA events will be sent to Google Analytics/Ads on click");
    if (gaId) {
      window.gtag!("config", gaId);
    }
  } else {
    console.warn("[Analytics] gtag not found - CTA clicks will NOT be sent to Google. Ensure Google tag (gtag.js) is loaded in index.html.");
  }
}
