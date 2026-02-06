const splitCsv = (v?: string) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export const domainConfig = {
  appHosts: new Set(splitCsv(process.env.APP_HOSTS)),
  marketingHosts: new Set(splitCsv(process.env.MARKETING_HOSTS)),
  localDevHosts: new Set(splitCsv(process.env.LOCAL_DEV_HOSTS)),
  canonicalAppUrl: process.env.CANONICAL_APP_URL || "",
  canonicalMarketingUrl: process.env.CANONICAL_MARKETING_URL || "",
  appPath: process.env.APP_PATH || "/app",
};

export function getHostname(req: any): string {
  const raw =
    (req.headers["x-forwarded-host"] as string) ||
    (req.headers["host"] as string) ||
    "";
  return raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

export function isLocalHost(hostname: string): boolean {
  return domainConfig.localDevHosts.has(hostname);
}

export function isAppHost(hostname: string): boolean {
  return domainConfig.appHosts.has(hostname);
}

export function isMarketingHost(hostname: string): boolean {
  return domainConfig.marketingHosts.has(hostname);
}

/**
 * Get base URL for booking links (AI leasing agent, reschedule URLs, etc.).
 * In local/dev: uses localhost or dev domain. In production: uses canonical app URL.
 */
export function getBaseUrlForBookingLink(): string {
  // Local development: skip production domain, use localhost or dev URL
  // (NODE_ENV undefined or not 'production' when not deployed = local dev)
  const isLocalDev =
    !process.env.REPLIT_DEPLOYMENT &&
    process.env.NODE_ENV !== "production" &&
    !process.env.REPL_ID;

  if (isLocalDev) {
    return process.env.PUBLIC_URL || "http://localhost:5000";
  }

  // Replit dev (has REPL_ID but not deployed): use Replit workspace URL
  if (process.env.REPL_SLUG && process.env.REPL_OWNER && !process.env.REPLIT_DEPLOYMENT) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }

  // Production: canonical URL > Replit deployment domain
  const baseUrl =
    process.env.CANONICAL_APP_URL ||
    (process.env.REPL_SLUG && process.env.REPL_OWNER
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : "") ||
    process.env.PUBLIC_URL ||
    process.env.REPLIT_DOMAINS?.split(",")[0]?.trim() ||
    "http://localhost:5000";

  if (baseUrl && !baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    return `https://${baseUrl}`;
  }
  return baseUrl;
}
