import { NextResponse } from "next/server";

const CHATURBATE_API = "https://chaturbate.com/api/public/affiliates/onlinerooms/";
const WM = process.env.CHATURBATE_AFFILIATE_WM || "Ifv4A";

const CACHE_TTL_MS = 60_000;

type Cam = {
  username: string;
  displayName: string;
  thumbnail: string;
  age: number | null;
  viewers: number;
  isHd: boolean;
};

let cache: { cams: Cam[]; timestamp: number } | null = null;

function humanize(username: string): string {
  const cleaned = username
    .replace(/[_-]+/g, " ")
    .replace(/\d+/g, "")
    .trim();
  if (!cleaned) return username;
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export async function GET() {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(
      { cams: cache.cams, cached: true },
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
      limit: "12",
      format: "json",
    });

    const res = await fetch(`${CHATURBATE_API}?${params}`, {
      headers: { "User-Agent": "Uzeed/1.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`API ${res.status}`);

    const data = await res.json();
    const results: any[] = Array.isArray(data?.results) ? data.results : [];

    const cams: Cam[] = results
      .filter((r) => r && typeof r.username === "string" && typeof r.image_url_360x270 === "string")
      .map((r) => ({
        username: String(r.username),
        displayName: humanize(String(r.username)),
        thumbnail: String(r.image_url_360x270),
        age: typeof r.age === "number" && r.age > 0 ? r.age : null,
        viewers: typeof r.num_users === "number" ? r.num_users : 0,
        isHd: Boolean(r.is_hd),
      }))
      .slice(0, 12);

    cache = { cams, timestamp: Date.now() };

    return NextResponse.json(
      { cams, cached: false },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
    );
  } catch (error) {
    console.error("live-feed error:", error);

    if (cache) {
      return NextResponse.json({ cams: cache.cams, cached: true, stale: true });
    }
    return NextResponse.json({ cams: [] });
  }
}
