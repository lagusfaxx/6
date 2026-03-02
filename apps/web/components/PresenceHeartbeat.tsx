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

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const start = () => {
      if (document.visibilityState !== "visible" || timer) return;
      ping();
      timer = setInterval(() => {
        ping();
      }, HEARTBEAT_MS);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    start();

    return () => {
      active = false;
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loading, me?.user?.id]);

  return null;
}
