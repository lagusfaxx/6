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

  async function subscribePush({ requestPermission }: { requestPermission: boolean }) {
    if (!PUBLIC_VAPID_KEY) {
      return { ok: false as const, reason: "missing_vapid" as const };
    }
    if (!("Notification" in window) || !("PushManager" in window)) {
      return { ok: false as const, reason: "unsupported" as const };
    }

    const registration = await registerServiceWorker();
    if (!registration) {
      return { ok: false as const, reason: "service_worker_unavailable" as const };
    }

    let permission = Notification.permission;
    if (permission === "default" && requestPermission) {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      return {
        ok: false as const,
        reason: permission === "denied" ? ("permission_denied" as const) : ("permission_not_granted" as const)
      };
    }

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

    return { ok: true as const };
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

        const result = await subscribePush({ requestPermission: canAskInBackground });
        if (!cancelled && result.ok) {
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
                  const result = await subscribePush({ requestPermission: true });
                  if (!result.ok) {
                    if (result.reason === "permission_denied") {
                      setPushError("Notificaciones bloqueadas en iOS. Habilítalas en Configuración > Notificaciones.");
                    } else if (result.reason === "unsupported" || result.reason === "service_worker_unavailable") {
                      setPushError("Este navegador no soporta push en iOS. Ábrelo en Safari e instala la app en pantalla de inicio.");
                    } else if (result.reason === "missing_vapid") {
                      setPushError("Push no está configurado en este entorno. Intenta nuevamente más tarde.");
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
