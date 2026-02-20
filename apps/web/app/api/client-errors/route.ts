import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Log without sensitive data
    console.error(
      JSON.stringify({
        level: "client-error",
        message: body?.message || "Unknown",
        url: body?.url || "",
        timestamp: body?.timestamp || new Date().toISOString(),
      }),
    );
  } catch {
    // ignore malformed body
  }
  return NextResponse.json({ ok: true });
}
