// Environment detection helpers
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
  
  // Production marketing domain - redirect to app subdomain
  if (isProductionMarketing()) {
    return `https://app.lead2lease.ai${path}`;
  }
  
  // Already on app.lead2lease.ai - use relative path
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
