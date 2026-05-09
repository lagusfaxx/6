import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CHATURBATE_API = "https://chaturbate.com/api/public/affiliates/onlinerooms/";
const WM = process.env.CHATURBATE_AFFILIATE_WM || "Ifv4A";

const CACHE_TTL_MS = 60_000;
const FETCH_LIMIT = 30;
const VISIBLE_COUNT = 12;
const ROTATION_STEP = 6;
const FETCH_TIMEOUT_MS = 4000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 500;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

type Cam = {
  username: string;
  displayName: string;
  thumbnail: string;
  age: number | null;
  viewers: number;
  isHd: boolean;
};

let pool: Cam[] = [];
let rotationOffset = 0;
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

function rotateSlice(p: Cam[], offset: number, count: number): Cam[] {
  if (p.length === 0) return [];
  if (p.length <= count) return p.slice();
  const out: Cam[] = [];
  for (let i = 0; i < count; i++) {
    out.push(p[(offset + i) % p.length]);
  }
  return out;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function fetchCams(): Promise<Cam[]> {
  const params = new URLSearchParams({
    wm: WM,
    client_ip: "request_ip",
    gender: "f",
    region: "southamerica",
    hd: "true",
    limit: String(FETCH_LIMIT),
    format: "json",
  });
  const url = `${CHATURBATE_API}?${params}`;

  let lastErr: Error = new Error("upstream failed");

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS);

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Uzeed/1.0" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        const results: any[] = Array.isArray(data?.results) ? data.results : [];
        return results
          .filter((r) => r && typeof r.username === "string" && typeof r.image_url_360x270 === "string")
          .map((r) => ({
            username: String(r.username),
            displayName: humanize(String(r.username)),
            thumbnail: String(r.image_url_360x270),
            age: typeof r.age === "number" && r.age > 0 ? r.age : null,
            viewers: typeof r.num_users === "number" ? r.num_users : 0,
            isHd: Boolean(r.is_hd),
          }));
      }

      lastErr = new Error(`upstream ${res.status}`);
      if (res.status < 500) break;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastErr;
}

export async function GET(request: Request) {
  void request;

  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(
      { cams: cache.cams, cached: true, ts: cache.timestamp },
      { headers: NO_CACHE_HEADERS },
    );
  }

  try {
    const fresh = await fetchCams();

    pool = fresh;
    const visible = rotateSlice(pool, rotationOffset, VISIBLE_COUNT);
    rotationOffset = pool.length > 0 ? (rotationOffset + ROTATION_STEP) % pool.length : 0;
    cache = { cams: visible, timestamp: Date.now() };

    return NextResponse.json(
      { cams: visible, cached: false, ts: cache.timestamp },
      { headers: NO_CACHE_HEADERS },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`live-feed upstream unavailable: ${msg}`);

    if (cache) {
      return NextResponse.json(
        { cams: cache.cams, cached: true, stale: true, ts: cache.timestamp },
        { headers: NO_CACHE_HEADERS },
      );
    }
    return NextResponse.json({ cams: [] }, { headers: NO_CACHE_HEADERS });
  }
}
