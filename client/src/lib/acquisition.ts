/**
 * Acquisition attribution - first-touch tracking for landing pages + UTMs
 * Persists across navigation and OAuth redirects via localStorage + cookie
 */

import { OFFER_BY_PATH } from "./offers";
import { trackAcquisitionCaptured } from "./analytics";

const STORAGE_KEY = "acq_ctx";
const COOKIE_NAME = "acq_ctx";
const COOKIE_MAX_AGE_DAYS = 30;

export interface AcquisitionContext {
  offer: string;
  source: string;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
  landing_page: string;
  referrer: string | null;
  first_touch_ts: string;
}

export interface ParsedUTMs {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
}

/** Parse UTM params from search string (e.g. ?utm_source=google&utm_medium=cpc) */
export function parseUTMs(search: string): ParsedUTMs {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return {
    source: params.get("utm_source") || null,
    medium: params.get("utm_medium") || null,
    campaign: params.get("utm_campaign") || null,
    term: params.get("utm_term") || null,
    content: params.get("utm_content") || null,
  };
}

/** Encode context to base64 JSON for cookie */
function encodeContext(ctx: AcquisitionContext): string {
  if (typeof btoa === "undefined") return "";
  try {
    return btoa(encodeURIComponent(JSON.stringify(ctx)));
  } catch {
    return "";
  }
}

/** Decode base64 JSON to context */
function decodeContext(encoded: string): AcquisitionContext | null {
  if (typeof atob === "undefined") return null;
  try {
    const json = decodeURIComponent(atob(encoded));
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed.offer === "string" && typeof parsed.landing_page === "string") {
      return parsed as AcquisitionContext;
    }
    return null;
  } catch {
    return null;
  }
}

/** Set cookie (30 day expiry). Use domain=lead2lease.ai on marketing so app.lead2lease.ai can read it on register. */
function setCookie(value: string): void {
  if (typeof document === "undefined") return;
  const hostname = document.location.hostname.toLowerCase();
  const isMarketing = hostname === "lead2lease.ai" || hostname === "www.lead2lease.ai";
  const maxAge = COOKIE_MAX_AGE_DAYS * 86400;
  const base = `${COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = isMarketing ? `${base}; domain=lead2lease.ai` : base;
}

/** Get cookie value */
function getCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  }
  return null;
}

/** Build acquisition context from URL search params (e.g. from ?acq_offer=...&acq_landing_page=... on app.lead2lease.ai/register) */
export function getAcquisitionContextFromSearchParams(search: string): AcquisitionContext | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const offer = params.get("acq_offer");
  const landing_page = params.get("acq_landing_page");
  if (!offer || !landing_page) return null;
  return {
    offer,
    landing_page,
    source: params.get("acq_source") || "direct",
    medium: params.get("acq_medium") || null,
    campaign: params.get("acq_campaign") || null,
    term: params.get("acq_term") || null,
    content: params.get("acq_content") || null,
    referrer: null,
    first_touch_ts: new Date().toISOString(),
  };
}

/** Read acquisition context: localStorage first, then cookie, then URL params (for cross-origin from marketing) */
export function getAcquisitionContext(): AcquisitionContext | null {
  if (typeof window === "undefined") return null;
  try {
    const fromStorage = localStorage.getItem(STORAGE_KEY);
    if (fromStorage) {
      const parsed = JSON.parse(fromStorage) as AcquisitionContext;
      if (parsed && typeof parsed.offer === "string" && typeof parsed.landing_page === "string") {
        return parsed;
      }
    }
    const fromCookie = getCookie();
    if (fromCookie) {
      const decoded = decodeContext(fromCookie);
      if (decoded) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(decoded));
        return decoded;
      }
    }
    const fromUrl = getAcquisitionContextFromSearchParams(window.location.search);
    if (fromUrl) return fromUrl;
  } catch (e) {
    console.warn("[Acquisition] Error reading context:", e);
  }
  return null;
}

/** Store acquisition context - ONLY if not already set (first-touch wins) */
export function setAcquisitionContextOnce(ctx: AcquisitionContext): boolean {
  if (typeof window === "undefined") return false;
  try {
    const existing = getAcquisitionContext();
    if (existing) {
      return false; // Already set, do not overwrite
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
    setCookie(encodeContext(ctx));
    return true;
  } catch (e) {
    console.warn("[Acquisition] Error storing context:", e);
    return false;
  }
}

/** On landing pages: capture context if path matches OFFER_BY_PATH and not already set */
export function ensureAcquisitionContextFromLanding(): void {
  if (typeof window === "undefined") return;
  const pathname = window.location.pathname || "/";
  const offer = OFFER_BY_PATH[pathname as keyof typeof OFFER_BY_PATH];
  if (!offer) return; // Not a tracked landing page
  if (getAcquisitionContext()) return; // Already captured
  const utms = parseUTMs(window.location.search);
  const ctx: AcquisitionContext = {
    offer,
    source: utms.source || "direct",
    medium: utms.medium,
    campaign: utms.campaign,
    term: utms.term,
    content: utms.content,
    landing_page: pathname,
    referrer: document.referrer || null,
    first_touch_ts: new Date().toISOString(),
  };
  if (setAcquisitionContextOnce(ctx)) {
    trackAcquisitionCaptured({
      offer: ctx.offer,
      source: ctx.source,
      campaign: ctx.campaign ?? undefined,
      landing_page: ctx.landing_page,
    });
  }
}
