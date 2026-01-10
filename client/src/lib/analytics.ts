// Google Analytics utility functions
// Assumes Google Analytics is already initialized in HTML <head>

declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string | Date,
      config?: Record<string, any>
    ) => void;
    dataLayer?: any[];
  }
}

/**
 * Track a custom event in Google Analytics
 * Uses the existing gtag function that should be initialized in HTML <head>
 */
export function trackEvent(
  eventName: string,
  eventParams?: {
    event_category?: string;
    event_label?: string;
    value?: number;
    [key: string]: any;
  }
) {
  if (typeof window === 'undefined' || !window.gtag) {
    // Silently fail if gtag is not available (GA might not be loaded yet or not configured)
    return;
  }

  window.gtag('event', eventName, {
    ...eventParams,
  });
}

/**
 * Track page view
 * Uses the existing gtag function that should be initialized in HTML <head>
 * Note: GA4 automatically tracks page views, but this can be used for custom page tracking
 */
export function trackPageView(path: string) {
  if (typeof window === 'undefined' || !window.gtag) {
    return;
  }

  // Track page view event (GA4 automatically tracks page views, but this allows custom tracking)
  window.gtag('event', 'page_view', {
    page_path: path,
  });
}

