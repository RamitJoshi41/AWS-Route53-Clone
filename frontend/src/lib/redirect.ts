const DEFAULT_REDIRECT = "/";

/**
 * Validate the `?next=` value the login page redirects to after signing in.
 *
 * Only same-site paths are allowed: otherwise /login?next=https://evil.example would
 * be an open redirect. Browsers treat "//host" and "/\host" as other origins.
 */
export function safeRedirectPath(next: string | string[] | undefined): string {
  if (typeof next !== "string") return DEFAULT_REDIRECT;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_REDIRECT;
  }
  // Never bounce back to the login page itself.
  if (next === "/login" || next.startsWith("/login?")) return DEFAULT_REDIRECT;
  return next;
}
