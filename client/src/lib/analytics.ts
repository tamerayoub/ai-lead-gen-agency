/**
 * Analytics wrapper - emits acquisition and lifecycle events.
 * TODO: Integrate with PostHog, GA, or Mixpanel when available.
 * In dev, logs to console for verification.
 */

const isDev = typeof window !== "undefined" && (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.endsWith(".replit.dev") ||
  window.location.hostname.endsWith(".repl.co")
);

export interface AcquisitionEventProps {
  offer?: string | null;
  source?: string | null;
  campaign?: string | null;
  landing_page?: string | null;
}

function logEvent(name: string, props: Record<string, unknown>): void {
  if (isDev) {
    console.log(`[Analytics] ${name}`, props);
  }
  // TODO: PostHog capture
  // if (window.posthog) window.posthog.capture(name, props);
  // TODO: GA4
  // if (window.gtag) window.gtag('event', name, props);
  // TODO: Mixpanel
  // if (window.mixpanel) window.mixpanel.track(name, props);
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

/** Initialize Google Analytics (no-op stub - add GA measurement ID to enable) */
export function initGoogleAnalytics(): void {
  // TODO: Add GA4 init when measurement ID is configured
  // if (import.meta.env.VITE_GA_MEASUREMENT_ID) {
  //   // Load gtag script and init
  // }
}
