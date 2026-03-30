import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPrefixes = ["/chat", "/chats", "/calificar", "/umate/account", "/umate/onboarding"];

/** Routes where payment gateways (Flow.cl) may POST-redirect users back. */
const paymentReturnPaths = ["/pago/exitoso", "/pago/tarjeta-registrada", "/wallet", "/umate/checkout"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Flow.cl redirects users back via POST after payment/card enrollment.
  // Next.js 14 misinterprets POST to page routes as Server Action calls,
  // causing "Failed to find Server Action" crashes. Convert to GET (303).
  // Preserve Flow's token from POST body by adding it as a query param.
  if (req.method === "POST" && paymentReturnPaths.includes(pathname)) {
    const url = req.nextUrl.clone();
    // Flow sends token in POST body for card registration callbacks.
    // Try to extract it from the URL-encoded body and add to query params.
    try {
      const body = await req.text();
      const params = new URLSearchParams(body);
      const token = params.get("token");
      if (token && !url.searchParams.has("token")) {
        url.searchParams.set("token", token);
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
  matcher: ["/chat/:path*", "/chats/:path*", "/calificar/:path*", "/pago/exitoso", "/pago/tarjeta-registrada", "/wallet", "/umate/account/:path*", "/umate/onboarding", "/umate/checkout"]
};
