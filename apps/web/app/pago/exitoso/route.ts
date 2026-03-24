import { type NextRequest, NextResponse } from "next/server";

/**
 * Flow.cl redirects users back via POST after payment.
 * Next.js 14 interprets POST to page routes as Server Action calls,
 * which crashes with "Failed to find Server Action" since we have none.
 * This handler intercepts the POST and redirects to GET with the same params.
 */
export async function POST(req: NextRequest) {
  const url = req.nextUrl.clone();

  // Flow may send data as form-encoded body; extract ref if present
  try {
    const formData = await req.formData();
    const token = formData.get("token");
    if (token && !url.searchParams.has("ref")) {
      url.searchParams.set("token", String(token));
    }
  } catch {
    // Not form data — ignore
  }

  return NextResponse.redirect(url, 303);
}
