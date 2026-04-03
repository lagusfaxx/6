import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPrefixes = ["/chat", "/chats", "/calificar", "/umate/account", "/umate/onboarding", "/admin", "/dashboard", "/cuenta", "/favoritos", "/wallet"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // This app has no Server Actions. Any POST to a page route is either a
  // payment-gateway callback (Flow.cl POST-redirects after payment/card
  // enrollment) or a stale/misdirected request. Next.js 14 misinterprets
  // such POSTs as Server Action calls, crashing with "Failed to find Server
  // Action". Convert every non-API POST to a GET (303 See Other) and
  // preserve URL-encoded body params as query strings so pages can read them.
  if (req.method === "POST") {
    const url = req.nextUrl.clone();
    try {
      const body = await req.text();
      const params = new URLSearchParams(body);
      for (const [key, value] of params) {
        if (!url.searchParams.has(key)) {
          url.searchParams.set(key, value);
        }
      }
    } catch {
      // Body not readable — continue with redirect anyway
    }
    return NextResponse.redirect(url, 303);
  }

  const needsAuth = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (!needsAuth) return NextResponse.next();

  const hasSession = Boolean(req.cookies.get("uzeed_session")?.value);
  if (hasSession) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Run on all page routes. Exclude Next.js internals, static assets, and
  // /api (which rewrites to the Express backend and needs POST intact).
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|brand/|api/).*)"],
};
