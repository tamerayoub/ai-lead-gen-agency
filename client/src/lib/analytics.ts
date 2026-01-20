// Google Analytics initialization and utility functions

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
 * Initialize Google Analytics
 * This should be called once when the app loads
 */
export function initGoogleAnalytics() {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  
  if (!measurementId) {
    console.log('[Analytics] Google Analytics not configured - VITE_GA_MEASUREMENT_ID not set');
    return;
  }

  // Check if already initialized
  if (window.gtag && window.dataLayer) {
    console.log('[Analytics] Google Analytics already initialized');
    return;
  }

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  
  // Define gtag function
  function gtag(...args: any[]) {
    window.dataLayer!.push(arguments);
  }
  window.gtag = gtag;

  // Load Google Analytics script
  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script1);

  // Initialize GA4
  gtag('js', new Date());
  gtag('config', measurementId, {
    page_path: window.location.pathname,
  });

  console.log('[Analytics] Google Analytics initialized with ID:', measurementId);
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

  // Track page view using GA4 config (this updates the page_path)
  window.gtag('config', import.meta.env.VITE_GA_MEASUREMENT_ID || '', {
    page_path: path,
    page_title: document.title,
  });
}

