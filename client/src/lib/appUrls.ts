export function getAppUrl(path: string = '/'): string {
  const hostname = window.location.hostname.toLowerCase();
  const isProductionMarketing = hostname === 'lead2lease.ai' || hostname === 'www.lead2lease.ai';
  
  if (isProductionMarketing) {
    return `https://app.lead2lease.ai${path}`;
  }
  
  return path;
}

export function getLoginUrl(returnTo?: string): string {
  const basePath = returnTo 
    ? `/login?returnTo=${encodeURIComponent(returnTo)}`
    : '/login';
  return getAppUrl(basePath);
}

export function getRegisterUrl(returnTo?: string): string {
  const basePath = returnTo 
    ? `/register?returnTo=${encodeURIComponent(returnTo)}`
    : '/register';
  return getAppUrl(basePath);
}

export function isOnMarketingDomain(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  return hostname === 'lead2lease.ai' || hostname === 'www.lead2lease.ai';
}
