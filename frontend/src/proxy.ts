import { NextResponse, type NextRequest } from "next/server";

// Must match the backend's SESSION_COOKIE_NAME (backend/config.py).
const SESSION_COOKIE = "session";

/**
 * First, optimistic layer of route protection (Next 16's replacement for middleware.ts).
 *
 * It only checks that a session cookie EXISTS: it can't tell whether the session is
 * still valid without asking the backend. A missing cookie means "definitely logged
 * out", so we redirect on the server before any protected HTML is sent. Expired or
 * forged cookies get through here and are caught by <AuthGuard> (GET /api/auth/me),
 * and the backend's 401 is the real security boundary.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // /login is public. Deliberately NOT redirecting a cookie-holder away from /login
  // here: with an expired cookie that would loop (proxy -> "/", guard -> "/login", ...).
  // The login page asks /me instead and redirects only if the session is really valid.
  if (pathname === "/login" || request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  // Remember where the user was going (path + query), unless it's just the home page.
  const target = pathname + search;
  const loginUrl = new URL("/login", request.url);
  if (target !== "/") loginUrl.searchParams.set("next", target);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Everything except API calls (the backend answers those with 401 itself),
  // Next's build assets and static metadata files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
