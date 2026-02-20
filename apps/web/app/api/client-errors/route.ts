import { NextResponse } from "next/server";
import { headers } from "next/headers";

// ── Simple in-memory sliding-window rate-limit ──
// Prevents abuse of this logging endpoint.  Max 20 reports per IP per minute.
// NOTE: In-memory state is per-process.  For multi-instance deployments, swap
// this for a shared store (Redis) or accept the per-instance approximation.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const timestamps = (hits.get(ip) || []).filter((t) => t > windowStart);
  if (timestamps.length >= MAX_PER_WINDOW) {
    hits.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  hits.set(ip, timestamps);
  return false;
}

// Periodic cleanup so the map doesn't grow unbounded (runs at most once/min)
let lastCleanup = Date.now();
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < WINDOW_MS) return;
  lastCleanup = now;
  const cutoff = now - WINDOW_MS;
  for (const [key, timestamps] of hits) {
    const valid = timestamps.filter((t) => t > cutoff);
    if (valid.length === 0) hits.delete(key);
    else hits.set(key, valid);
  }
}

export async function POST(req: Request) {
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown";

  maybeCleanup();

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "TOO_MANY_REQUESTS" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  try {
    const body = await req.json();
    const message = String(body?.message || "Unknown").slice(0, 500);
    const url = String(body?.url || "").slice(0, 200);
    const stack = String(body?.stack || "").slice(0, 2000);
    const componentStack = String(body?.componentStack || "").slice(0, 2000);

    console.error(
      JSON.stringify({
        level: "client-error",
        ip,
        message,
        url,
        stack,
        componentStack,
        timestamp: body?.timestamp || new Date().toISOString(),
      }),
    );
  } catch {
    // ignore malformed body
  }
  return NextResponse.json({ ok: true });
}
