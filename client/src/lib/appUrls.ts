import { getAcquisitionContext } from "@/lib/acquisition";

// Canonical production app URL - used for links from marketing domain and when hostname is unknown (e.g. SSR)
const PRODUCTION_APP_BASE = "https://app.lead2lease.ai";

export function isReplitDev(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname.endsWith('.replit.dev') ||
         hostname.endsWith('.repl.co') ||
         hostname.includes('.riker.replit.dev');
}

export function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname === 'localhost' ||
         hostname === '127.0.0.1' ||
         hostname.includes(':5000');
}

export function isDevEnvironment(): boolean {
  return isLocalhost() || isReplitDev();
}

export function isProductionApp(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname === 'app.lead2lease.ai';
}

export function isProductionMarketing(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname === 'lead2lease.ai' || hostname === 'www.lead2lease.ai';
}

export function isProduction(): boolean {
  return isProductionApp() || isProductionMarketing();
}

export function getAppUrl(path: string = '/'): string {
  const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';

  // Dev environments - use relative paths
  if (isDevEnvironment()) {
    return path.startsWith('/app') ? path : `/app${path === '/' ? '' : path}`;
  }

  // Already on app.lead2lease.ai - use relative path
  if (hostname === 'app.lead2lease.ai') {
    return path;
  }

  // Any other host (marketing, SSR with empty hostname, preview, proxy): use full app URL so CTAs go to app
  return `${PRODUCTION_APP_BASE}${path}`;
}

/** Append acquisition query params to URL when on marketing and context exists (so app.lead2lease.ai/register gets it) */
function appendAcquisitionParams(url: string): string {
  if (typeof window === "undefined" || !isProductionMarketing()) return url;
  try {
    const ctx = getAcquisitionContext();
    if (!ctx) return url;
    const sep = url.includes("?") ? "&" : "?";
    const params = new URLSearchParams();
    params.set("acq_offer", ctx.offer);
    params.set("acq_landing_page", ctx.landing_page);
    if (ctx.source) params.set("acq_source", ctx.source);
    if (ctx.medium) params.set("acq_medium", ctx.medium);
    if (ctx.campaign) params.set("acq_campaign", ctx.campaign);
    if (ctx.term) params.set("acq_term", ctx.term);
    if (ctx.content) params.set("acq_content", ctx.content);
    return `${url}${sep}${params.toString()}`;
  } catch {
    return url;
  }
}

export function getLoginUrl(returnTo?: string): string {
  const basePath = returnTo
    ? `/login?returnTo=${encodeURIComponent(returnTo)}`
    : "/login";
  return appendAcquisitionParams(getAppUrl(basePath));
}

export function getRegisterUrl(returnTo?: string): string {
  const basePath = returnTo
    ? `/register?returnTo=${encodeURIComponent(returnTo)}`
    : "/register";
  return appendAcquisitionParams(getAppUrl(basePath));
}

export function isOnMarketingDomain(): boolean {
  return isProductionMarketing();
}

// Get the appropriate redirect path after login
export function getPostLoginRedirect(): string {
  if (isDevEnvironment()) {
    return '/app';
  }
  if (isProductionApp()) {
    return '/';
  }
  if (isProductionMarketing()) {
    return 'https://app.lead2lease.ai';
  }
  return '/app';
}
