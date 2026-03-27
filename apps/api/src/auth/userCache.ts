// ── User cache — avoid 1 DB query per request for recently-seen users ──
const USER_CACHE_TTL = 60_000; // 1 minute
const USER_CACHE_MAX = 10_000;

type CachedUser = {
  data: { id: string; email: string; role: string; profileType: string; membershipExpiresAt: Date | null; shopTrialEndsAt: Date | null; createdAt: Date };
  ts: number;
};

const userCache = new Map<string, CachedUser>();

export function getCachedUser(userId: string): CachedUser["data"] | null {
  const entry = userCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.ts > USER_CACHE_TTL) {
    userCache.delete(userId);
    return null;
  }
  return entry.data;
}

export function setCachedUser(userId: string, data: CachedUser["data"]) {
  if (userCache.size >= USER_CACHE_MAX) {
    // Evict oldest 20% by timestamp
    const entries = Array.from(userCache.entries()).sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < entries.length * 0.2; i++) userCache.delete(entries[i][0]);
  }
  userCache.set(userId, { data, ts: Date.now() });
}

export function invalidateUserCache(userId: string) {
  userCache.delete(userId);
}

export type { CachedUser };
