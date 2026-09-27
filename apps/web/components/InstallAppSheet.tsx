"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  Check,
  Copy,
  Compass,
  EllipsisVertical,
  MoreHorizontal,
  PlusSquare,
  Share,
  Smartphone,
  X,
  Zap,
} from "lucide-react";

/** Evento para que el aviso automático se cierre si se abre el panel a mano. */
export const INSTALL_SHEET_OPEN_EVENT = "uzeed:install-sheet-open";

export type InstallPlatform = "ios-safari" | "ios-other" | "android" | "desktop";

/**
 * Plataforma para las instrucciones de instalación. En iPhone sólo Safari
 * agrega a la pantalla de inicio de forma confiable: desde Chrome, Instagram
 * o Facebook primero hay que abrir la página en Safari.
 */
export function detectInstallPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS se presenta como Mac con pantalla táctil.
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (isIOS) {
    const notSafari = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|Instagram|FBAN|FBAV|Line\/|TikTok|Twitter/i.test(ua);
    return notSafari ? "ios-other" : "ios-safari";
  }
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function Step({
  n,
  icon,
  children,
}: {
  n: number;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-xs font-bold text-white">
        {n}
      </span>
      <span className="min-w-0 flex-1 text-[14px] leading-snug text-white/75">{children}</span>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-sky-400">
        {icon}
      </span>
    </li>
  );
}

/** Nombre de un botón del sistema, destacado igual en todos los pasos. */
function Key({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-white">{children}</strong>;
}

export default function InstallAppSheet({
  platform,
  onClose,
}: {
  platform: InstallPlatform;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Sin permiso de portapapeles: el texto ya explica qué hacer. */
    }
  };

  if (!mounted) return null;

  /* En un portal: dentro de la home heredaba el centrado del texto, y un
     padre con transform deja de anclar el position: fixed a la pantalla. */
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 text-left text-white backdrop-blur-md sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-title"
    >
      <div
        className="relative max-h-[92svh] w-full overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#0e0e14] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:max-w-md sm:rounded-[28px] sm:pt-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Asa del panel en el teléfono */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-2 text-white/50 transition hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Cabecera */}
        <div className="flex items-center gap-3.5 pr-10">
          <img
            src="/brand/isotipo-new.png"
            alt=""
            className="h-14 w-14 rounded-2xl shadow-lg shadow-fuchsia-500/25"
          />
          <div>
            <h3 id="install-title" className="text-lg font-bold leading-tight">
              Instala UZEED
            </h3>
            <p className="mt-0.5 text-[13px] text-white/50">Gratis y sin pasar por la tienda de apps</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {[
            { icon: Zap, text: "Abre al instante" },
            { icon: Bell, text: "Avisos de mensajes" },
            { icon: Smartphone, text: "Pantalla completa" },
          ].map(({ icon: Icon, text }) => (
            <span
              key={text}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/65"
            >
              <Icon className="h-3 w-3 text-fuchsia-300" />
              {text}
            </span>
          ))}
        </div>

        {/* Pasos por plataforma */}
        <div className="mt-5">
          {platform === "ios-other" && (
            <>
              <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] p-3.5">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                  <Compass className="h-4 w-4 text-amber-300" />
                  Ábrela primero en Safari
                </p>
                <p className="mt-1 text-[13px] leading-snug text-white/60">
                  En iPhone la app se instala desde Safari. Copia el enlace, abre Safari y pégalo en
                  la barra de direcciones.
                </p>
                <button
                  type="button"
                  onClick={copyLink}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Enlace copiado" : "Copiar enlace"}
                </button>
              </div>
              <p className="mt-4 mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/35">
                Después, en Safari
              </p>
            </>
          )}

          {(platform === "ios-safari" || platform === "ios-other") && (
            <ol className="grid gap-2">
              <Step n={1} icon={<Share className="h-5 w-5" />}>
                Toca <Key>Compartir</Key>. Si no lo ves abajo, toca primero{" "}
                <Key>⋯</Key> y luego <Key>Compartir</Key>.
              </Step>
              <Step n={2} icon={<PlusSquare className="h-5 w-5" />}>
                Desliza hacia abajo y toca <Key>Agregar a inicio</Key>.
              </Step>
              <Step n={3} icon={<Check className="h-5 w-5" />}>
                Toca <Key>Agregar</Key> arriba a la derecha. ¡Listo! Búscala en tu pantalla de inicio.
              </Step>
            </ol>
          )}

          {platform === "android" && (
            <ol className="grid gap-2">
              <Step n={1} icon={<EllipsisVertical className="h-5 w-5" />}>
                Toca el menú <Key>⋮</Key> arriba a la derecha del navegador.
              </Step>
              <Step n={2} icon={<Smartphone className="h-5 w-5" />}>
                Toca <Key>Instalar app</Key> o <Key>Agregar a la pantalla principal</Key>.
              </Step>
              <Step n={3} icon={<Check className="h-5 w-5" />}>
                Confirma con <Key>Instalar</Key>.
              </Step>
            </ol>
          )}

          {platform === "desktop" && (
            <ol className="grid gap-2">
              <Step n={1} icon={<MoreHorizontal className="h-5 w-5" />}>
                En Chrome o Edge, busca el ícono de <Key>instalar</Key> al final de la barra de
                direcciones, o abre el menú del navegador.
              </Step>
              <Step n={2} icon={<Check className="h-5 w-5" />}>
                Elige <Key>Instalar UZEED</Key> y confirma.
              </Step>
            </ol>
          )}
        </div>

        {/* En iPhone los avisos de mensajes sólo llegan con la app instalada. */}
        {(platform === "ios-safari" || platform === "ios-other") && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-sky-400/15 bg-sky-400/[0.06] px-3 py-2.5 text-[12px] leading-snug text-sky-100/80">
            <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" />
            En iPhone, los avisos de mensajes nuevos solo llegan si instalas la app. Ábrela desde tu
            pantalla de inicio y acepta las notificaciones.
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(168,85,247,0.25)]"
        >
          Entendido
        </button>
      </div>
    </div>,
    document.body,
  );
}
