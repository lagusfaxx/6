"use client";

/**
 * TEMPORARY — admin impersonation banner.
 * Shown when an admin is acting as another user via POST /auth/impersonate.
 * Remove together with the backend endpoints when the one-off content
 * restore is completed.
 */

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

type MeResponse = {
  user: { id: string; username?: string; displayName?: string | null } | null;
  impersonatedBy: string | null;
};

export default function ImpersonationBanner() {
  const [target, setTarget] = useState<{ username?: string; displayName?: string | null } | null>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<MeResponse>("/auth/me")
      .then((data) => {
        if (cancelled) return;
        if (data?.impersonatedBy && data.user) {
          setTarget({ username: data.user.username, displayName: data.user.displayName });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!target) return null;

  const exit = async () => {
    setExiting(true);
    try {
      await apiFetch("/auth/stop-impersonate", { method: "POST" });
    } catch {
      setExiting(false);
      return;
    }
    window.location.href = "/umate/admin";
  };

  const label = target.displayName || target.username || "usuario";

  return (
    <div className="fixed left-0 right-0 top-0 z-[100] bg-amber-500 text-black shadow-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-xs font-semibold">
        <span>
          Estás actuando como <span className="font-bold">@{target.username || label}</span> — todas las acciones quedan en nombre de este usuario.
        </span>
        <button
          onClick={exit}
          disabled={exiting}
          className="shrink-0 rounded-md bg-black px-3 py-1 text-[11px] font-bold text-amber-300 transition hover:bg-black/80 disabled:opacity-50"
        >
          {exiting ? "Saliendo..." : "Volver a admin"}
        </button>
      </div>
    </div>
  );
}
