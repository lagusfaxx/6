import { NextResponse } from "next/server";

const CHATURBATE_API = "https://chaturbate.com/api/public/affiliates/onlinerooms/";
const WM = process.env.CHATURBATE_AFFILIATE_WM || "Ifv4A";

const CACHE_TTL_MS = 60_000;
let cache: { count: number; timestamp: number } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(
      { count: cache.count, cached: true },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
    );
  }

  try {
    const params = new URLSearchParams({
      wm: WM,
      client_ip: "request_ip",
      gender: "f",
      region: "southamerica",
      hd: "true",
      limit: "1",
      format: "json",
    });

    const res = await fetch(`${CHATURBATE_API}?${params}`, {
      headers: { "User-Agent": "Uzeed/1.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`API ${res.status}`);

    const data = await res.json();
    const count = typeof data?.count === "number" ? data.count : 0;

    cache = { count, timestamp: Date.now() };

    return NextResponse.json(
      { count, cached: false },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
    );
  } catch (error) {
    console.error("live-count error:", error);

    if (cache) {
      return NextResponse.json({ count: cache.count, cached: true, stale: true });
    }

    return NextResponse.json({ count: 50, fallback: true });
  }
}
