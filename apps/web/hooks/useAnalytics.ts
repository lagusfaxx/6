"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "../lib/api";

let sessionId: string | null = null;
let visitorId: string | null = null;

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** Lee o crea un id en el storage dado. Si el storage falla (modo privado), vive en memoria. */
function storedId(storage: () => Storage, key: string): string {
  try {
    const existing = storage().getItem(key);
    if (existing) return existing;
    const created = newId();
    storage().setItem(key, created);
    return created;
  } catch {
    return newId();
  }
}

/** Id por pestaña: agrupa las páginas de una misma visita. */
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  if (!sessionId) sessionId = storedId(() => window.sessionStorage, "uzeed_sid");
  return sessionId;
}

/**
 * Id del navegador que persiste entre visitas y pestañas: es lo que permite
 * contar visitantes únicos de verdad y no repetir a quien abre varias pestañas.
 */
function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  if (!visitorId) visitorId = storedId(() => window.localStorage, "uzeed_vid");
  return visitorId;
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
        visitorId: getVisitorId(),
      }),
    }).catch(() => {});
  }, [pathname]);
}

/** Track a specific user action */
export function trackAction(action: string, targetId?: string, metadata?: Record<string, unknown>) {
  console.log("[uzeed] trackAction:", action, targetId);
  apiFetch("/analytics/action", {
    method: "POST",
    body: JSON.stringify({ action, targetId, metadata, sessionId: getSessionId(), visitorId: getVisitorId() }),
  }).then(() => {
    console.log("[uzeed] trackAction OK:", action);
  }).catch((err) => {
    console.error("[uzeed] trackAction FAILED:", action, err);
  });
}
