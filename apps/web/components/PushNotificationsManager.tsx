"use client";

import { useEffect, useState } from "react";
import useMe from "../hooks/useMe";
import { apiFetch } from "../lib/api";

const PUBLIC_VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const IOS_INSTALL_HINT_KEY = "uzeed:ios-install-hint-dismissed";

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

function isIosDevice() {
  const ua = navigator.userAgent || "";
  const isClassicIos = /iPhone|iPad|iPod/i.test(ua);
  const isIpadOsDesktopUa = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  return isClassicIos || isIpadOsDesktopUa;
}

function isStandalonePwa() {
  const mediaStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iosStandalone = (window.navigator as any).standalone === true;
  return Boolean(mediaStandalone || iosStandalone);
}

function wasIosInstallHintDismissed() {
  try {
    return window.localStorage.getItem(IOS_INSTALL_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

export default function PushNotificationsManager() {
  const { me, loading } = useMe();
  const [showInstallHint, setShowInstallHint] = useState(false);
  const [showIosEnablePush, setShowIosEnablePush] = useState(false);
  const [activatingPush, setActivatingPush] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // iOS/Safari is strict: permission prompts must be triggered directly by a user gesture.
  // Pre-register the service worker in the background so the "Activar" click doesn't need
  // to await SW registration before calling Notification.requestPermission().
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const reg = await registerServiceWorker();
        if (!cancelled) setSwRegistration(reg);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Service Worker update detection - auto-reload when new version available
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let refreshing = false;

    // Detect when new service worker is installed and waiting
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      console.log('[SW] New version detected, reloading page...');
      window.location.reload();
    });

    // Check for updates periodically
    const checkForUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
        }
      } catch (err) {
        console.error('[SW] Update check failed:', err);
      }
    };

    // Check for updates every 30 minutes
    const interval = setInterval(checkForUpdates, 30 * 60 * 1000);

    // Check once on mount
    checkForUpdates();

    return () => clearInterval(interval);
  }, []);

  async function ensureServiceWorkerRegistration() {
    if (swRegistration) return swRegistration;
    const reg = await registerServiceWorker();
    setSwRegistration(reg);
    return reg;
  }

  async function subscribePush({ requestPermission }: { requestPermission: boolean }) {
    if (!PUBLIC_VAPID_KEY) return false;
    if (!("Notification" in window) || !("PushManager" in window)) return false;

    // IMPORTANT (iOS): request permission as directly as possible from the user gesture.
    // Do not await unrelated work before calling Notification.requestPermission().
    let permission = Notification.permission;
    if (permission === "default" && requestPermission) {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") return false;

    const registration = await ensureServiceWorkerRegistration();
    if (!registration) return false;

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

    return true;
  }

  useEffect(() => {
    if (!("window" in globalThis)) return;
    const ios = isIosDevice();
    const standalone = isStandalonePwa();

    if (ios && !standalone && !wasIosInstallHintDismissed()) {
      setShowInstallHint(true);
    } else {
      setShowInstallHint(false);
    }

    if (ios && standalone && Notification.permission !== "granted") {
      setShowIosEnablePush(true);
    } else {
      setShowIosEnablePush(false);
    }
  }, []);

  useEffect(() => {
    if (loading || !me?.user?.id) return;

    let cancelled = false;

    (async () => {
      try {
        const ios = isIosDevice();
        const standalone = isStandalonePwa();
        const canAskInBackground = !ios || !standalone;

        const ok = await subscribePush({ requestPermission: canAskInBackground });
        if (!cancelled && ok) {
          setShowIosEnablePush(false);
          setPushError(null);
        }
      } catch (err) {
        console.error("[push] registration failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, me?.user?.id]);

  return (
    <>
      {showInstallHint ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 md:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-[#12021f] p-4 text-sm text-white shadow-2xl">
            <h3 className="text-base font-semibold">Instala UZEED en iPhone</h3>
            <p className="mt-2 text-white/80">Para habilitar notificaciones en iOS debes instalar la app PWA:</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-white/80">
              <li>Abre este sitio en Safari.</li>
              <li>Toca el botón <strong>Compartir</strong>.</li>
              <li>Selecciona <strong>Añadir a pantalla de inicio</strong>.</li>
              <li>Abre la app instalada y activa notificaciones.</li>
            </ol>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 hover:bg-white/20"
                onClick={() => {
                  try {
                    window.localStorage.setItem(IOS_INSTALL_HINT_KEY, "1");
                  } catch {
                    // ignore
                  }
                  setShowInstallHint(false);
                }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showIosEnablePush ? (
        <div className="fixed bottom-20 left-4 right-4 z-[65] mx-auto w-auto max-w-md rounded-2xl border border-fuchsia-300/40 bg-[#1a0630] p-4 text-sm text-white shadow-xl">
          <div className="font-semibold">Activa notificaciones en iOS</div>
          <p className="mt-1 text-white/80">
            Para recibir mensajes y servicios en tiempo real, toca el botón y acepta permisos.
          </p>
          {pushError ? <p className="mt-1 text-rose-200">{pushError}</p> : null}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 hover:bg-white/20"
              onClick={() => setShowIosEnablePush(false)}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="rounded-xl border border-fuchsia-200/40 bg-fuchsia-500/30 px-3 py-1.5 hover:bg-fuchsia-500/40"
              disabled={activatingPush}
              onClick={async () => {
                setActivatingPush(true);
                setPushError(null);
                try {
                  const ok = await subscribePush({ requestPermission: true });
                  if (!ok) {
                    if (Notification.permission === "denied") {
                      setPushError("Notificaciones bloqueadas en iOS. Habilítalas en Configuración > Notificaciones.");
                    } else {
                      setPushError("No se pudo activar push. Intenta nuevamente.");
                    }
                    return;
                  }
                  setShowIosEnablePush(false);
                } catch {
                  setPushError("No se pudo activar push. Revisa conexión e intenta nuevamente.");
                } finally {
                  setActivatingPush(false);
                }
              }}
            >
              {activatingPush ? "Activando..." : "Activar notificaciones"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
