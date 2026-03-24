import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPrefixes = ["/chat", "/chats", "/calificar", "/umate/account", "/umate/onboarding"];

/** Routes where payment gateways (Flow.cl) may POST-redirect users back. */
const paymentReturnPaths = ["/pago/exitoso", "/wallet", "/umate/checkout"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Flow.cl redirects users back via POST after payment.
  // Next.js 14 misinterprets POST to page routes as Server Action calls,
  // causing "Failed to find Server Action" crashes. Convert to GET (303).
  if (req.method === "POST" && paymentReturnPaths.includes(pathname)) {
    return NextResponse.redirect(req.nextUrl, 303);
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
  matcher: ["/chat/:path*", "/chats/:path*", "/calificar/:path*", "/pago/exitoso", "/wallet", "/umate/account/:path*", "/umate/onboarding", "/umate/checkout"]
};
