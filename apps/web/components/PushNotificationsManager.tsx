"use client";

import { useEffect, useState } from "react";
import useMe from "../hooks/useMe";
import { apiFetch } from "../lib/api";

const PUBLIC_VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return registration;
}

function isLikelyMobileDevice() {
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

function isIosDevice() {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua);
}

function isStandalonePwa() {
  const mediaStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iosStandalone = (window.navigator as any).standalone === true;
  return Boolean(mediaStandalone || iosStandalone);
}

export default function PushNotificationsManager() {
  const { me, loading } = useMe();
  const [showInstallHint, setShowInstallHint] = useState(false);

  useEffect(() => {
    if (!("window" in globalThis)) return;
    if (!isLikelyMobileDevice()) return;

    const mustInstallOnIos = isIosDevice() && !isStandalonePwa();
    setShowInstallHint(mustInstallOnIos);
  }, []);

  useEffect(() => {
    if (loading || !me?.user?.id) return;
    if (!PUBLIC_VAPID_KEY) return;
    if (!("Notification" in window) || !("PushManager" in window)) return;

    let cancelled = false;

    (async () => {
      const registration = await registerServiceWorker();
      if (!registration || cancelled) return;

      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted" || cancelled) return;

      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription =
        existingSubscription ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
        }));

      await apiFetch("/notifications/push/subscribe", {
        method: "POST",
        body: JSON.stringify({ subscription })
      });
    })().catch((err) => {
      console.error("[push] registration failed", err);
    });

    return () => {
      cancelled = true;
    };
  }, [loading, me?.user?.id]);

  if (!showInstallHint) return null;

  return (
    <div className="mx-4 mt-2 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/85 md:hidden">
      Para recibir notificaciones en iPhone: abre en Safari y usa <strong>Compartir → Añadir a pantalla de inicio</strong>.
    </div>
  );
}
