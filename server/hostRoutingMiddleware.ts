import type { Request, Response, NextFunction } from "express";
import { domainConfig, getHostname, isAppHost, isLocalHost } from "./domainConfig";

function isAssetOrApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/@") ||
    pathname.startsWith("/node_modules") ||
    pathname.startsWith("/src") ||
    pathname.match(/\.(css|js|map|png|jpg|jpeg|webp|svg|ico|woff2?|ts|tsx)$/i) !== null
  );
}

export function hostRoutingMiddleware(req: Request, res: Response, next: NextFunction) {
  const hostname = getHostname(req);
  const path = req.path;

  if (isAssetOrApiPath(path)) {
    return next();
  }

  const local = isLocalHost(hostname);
  const appHost = isAppHost(hostname);

  if (local) {
    return next();
  }

  if (appHost) {
    return next();
  }

  if (path === domainConfig.appPath || path.startsWith(domainConfig.appPath + "/")) {
    if (domainConfig.canonicalAppUrl) {
      const rest = path.slice(domainConfig.appPath.length) || "/";
      return res.redirect(302, domainConfig.canonicalAppUrl + rest);
    }
  }

  return next();
}
