// (blueprint:javascript_log_in_with_replit) Auth utility functions
export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}
