import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/session";

/*
 * Next.js 16 renamed `middleware.ts` to `proxy.ts` (the exported function is
 * `proxy`, and it runs on the Node.js runtime by default).
 *
 * This is a routing convenience, NOT the security boundary. It checks only
 * that a session cookie is PRESENT so that a signed-out visitor is redirected
 * without paying for a Firebase round trip. It deliberately does not verify
 * the cookie: a forged one gets past this file and is then rejected by
 * `getCurrentUser()`, which every page, route handler and Server Action calls.
 *
 * That split matters because Next.js runs Server Functions as POSTs to the
 * page route, so a change to the matcher below can silently remove proxy
 * coverage from an action. Authorization lives with the code that reads data.
 */
const PUBLIC_PATHS = ["/login", "/signup"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!hasSession && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    // Preserve where they were going, including filters, so a shared link to
    // a filtered conversation list survives the sign-in detour.
    const target = `${pathname}${search}`;
    if (target !== "/") loginUrl.searchParams.set("next", target);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL("/analytics", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except:
     * - api routes (they authenticate themselves)
     * - _next/static and _next/image (build output)
     * - favicon and other root-level static files
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
