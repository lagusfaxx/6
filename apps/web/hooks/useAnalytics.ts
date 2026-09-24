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

/** UTM de la URL actual (campañas). Sólo source/medium/campaign. */
function readUtm(): { source?: string; medium?: string; campaign?: string } | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const p = new URLSearchParams(window.location.search);
    const source = p.get("utm_source") || undefined;
    const medium = p.get("utm_medium") || undefined;
    const campaign = p.get("utm_campaign") || undefined;
    return source || medium || campaign ? { source, medium, campaign } : undefined;
  } catch {
    return undefined;
  }
}

/** true si corre como app instalada (PWA), no en una pestaña del navegador. */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

/** Ids de visitante y sesión para adjuntar a otras llamadas (búsquedas). */
export function analyticsIds(): { sid: string; vid: string } {
  return { sid: getSessionId(), vid: getVisitorId() };
}

/**
 * Impresiones en un listado: una llamada por página de resultados con los
 * ids en el orden mostrado y la posición del primero. Se deduplica por
 * sesión para no contar dos veces el mismo perfil al volver atrás.
 */
const impressed = new Set<string>();
export function trackImpressions(ids: string[], start: number) {
  const fresh = ids.filter((id) => !impressed.has(id));
  if (!fresh.length) return;
  for (const id of fresh) impressed.add(id);
  apiFetch("/analytics/impressions", {
    method: "POST",
    body: JSON.stringify({ ids: fresh, start: start + (ids.length - fresh.length) }),
  }).catch(() => {});
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
        utm: readUtm(),
        standalone: isStandalone(),
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
