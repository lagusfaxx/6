"use client";

import { useEffect, useState } from "react";

const REFRESH_INTERVAL_MS = 90_000;
const ENDPOINT = "/live-count";

export function useLiveCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchCount = async () => {
      try {
        const res = await fetch(ENDPOINT);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data?.count === "number") {
          setCount(data.count);
        }
      } catch {
        // silent fail — keep previous count
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return count;
}
