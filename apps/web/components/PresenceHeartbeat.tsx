"use client";

import { useEffect } from "react";
import useMe from "../hooks/useMe";
import { apiFetch } from "../lib/api";

const HEARTBEAT_MS = 45_000;

export default function PresenceHeartbeat() {
  const { me, loading } = useMe();

  useEffect(() => {
    if (loading || !me?.user?.id) return;

    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const ping = async () => {
      if (!active || document.visibilityState !== "visible") return;
      await apiFetch("/auth/ping", { method: "POST" }).catch(() => undefined);
    };

    ping();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        ping();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    timer = setInterval(() => {
      ping();
    }, HEARTBEAT_MS);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timer) clearInterval(timer);
    };
  }, [loading, me?.user?.id]);

  return null;
}
