"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "../lib/api";

let sessionId: string | null = null;

function getSessionId(): string {
  if (sessionId) return sessionId;
  if (typeof window === "undefined") return "";
  sessionId = sessionStorage.getItem("uzeed_sid");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("uzeed_sid", sessionId);
  }
  return sessionId;
}

/** Automatically tracks page views on route changes */
export function usePageViewTracker() {
  const pathname = usePathname();
  const lastPath = useRef("");

  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;

    apiFetch("/analytics/pageview", {
      method: "POST",
      body: JSON.stringify({
        path: pathname,
        referrer: document.referrer || null,
        sessionId: getSessionId(),
      }),
    }).catch(() => {});
  }, [pathname]);
}

/** Track a specific user action (survives page navigation/close via keepalive) */
export function trackAction(action: string, targetId?: string, metadata?: Record<string, unknown>) {
  const payload = JSON.stringify({ action, targetId, metadata });

  // Use keepalive so the request completes even when navigating away (e.g. opening WhatsApp)
  apiFetch("/analytics/action", {
    method: "POST",
    body: payload,
    keepalive: true,
  }).catch(() => {});
}
