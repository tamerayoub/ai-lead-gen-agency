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
