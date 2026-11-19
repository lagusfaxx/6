"use client";

import { useEffect, useRef, useState } from "react";
import { cachedApiFetch } from "../../lib/api";
import useMe from "../../hooks/useMe";

/**
 * Espacio de anuncio de ExoClick.
 *
 * - El interruptor y el zoneid de cada espacio vienen de /ads/config (se
 *   editan en /admin/anuncios). Apagado o sin zoneid, no se dibuja nada.
 * - Las profesionales, locales y tiendas con sesión no ven anuncios: son
 *   quienes pagan la web.
 * - El script de ExoClick se carga una sola vez y recién cuando el espacio
 *   está por entrar en pantalla, para no frenar la carga del inicio.
 * - El alto queda reservado desde el principio: la página no salta cuando
 *   llega el anuncio.
 */

export type AdSlotName = "homeFeed" | "homeCamsDesktop" | "homeCamsMobile" | "listing" | "stories" | "liveGate";

type AdsConfig = { enabled: boolean; zones: Partial<Record<AdSlotName, string | null>> };

const PROVIDER_SRC = "https://a.magsrv.com/ad-provider.js";
const INS_CLASS = "eas6a97888e2";
const NO_ADS_PROFILE_TYPES = new Set(["PROFESSIONAL", "ESTABLISHMENT", "SHOP"]);

let configPromise: Promise<AdsConfig | null> | null = null;
function loadAdsConfig() {
  if (!configPromise) {
    configPromise = cachedApiFetch<AdsConfig>("/ads/config").catch(() => null);
  }
  return configPromise;
}

let providerLoaded = false;
function ensureProvider() {
  if (providerLoaded || typeof document === "undefined") return;
  providerLoaded = true;
  const s = document.createElement("script");
  s.async = true;
  s.type = "application/javascript";
  s.src = PROVIDER_SRC;
  document.body.appendChild(s);
}

type Props = {
  slot: AdSlotName;
  width: number;
  height: number;
  /** Ocupa todo el ancho disponible: el anuncio de ExoClick llega con su
   *  tamaño fijo (300x250) y se amplía con CSS, manteniendo la proporción,
   *  hasta 1,6 veces. Los clics siguen funcionando igual. */
  fluid?: boolean;
  className?: string;
  /** Avisa si el anuncio llegó ("filled") o si no va a haber ("unavailable":
   *  anuncios apagados, sin zona, usuario sin anuncios o sin anuncio de
   *  ExoClick). Lo usan las pantallas de anuncio con cuenta regresiva. */
  onStatus?: (status: "filled" | "unavailable") => void;
  /** Segundos sin anuncio antes de rendirse (por defecto 12). */
  giveUpAfter?: number;
};

export default function AdSlot({ slot, width, height, fluid = false, className = "", onStatus, giveUpAfter = 12 }: Props) {
  const { me, loading: meLoading } = useMe();
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const served = useRef(false);
  const [scale, setScale] = useState(1);

  /* Escala del anuncio según el ancho real del espacio. */
  useEffect(() => {
    const el = boxRef.current;
    if (!fluid || !el || typeof ResizeObserver === "undefined") return;
    const update = () => setScale(Math.min(1.6, Math.max(0.5, el.clientWidth / width)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fluid, width, zoneId]);

  const hiddenForUser = NO_ADS_PROFILE_TYPES.has(String(me?.user?.profileType || "").toUpperCase());

  const [cfgLoaded, setCfgLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    loadAdsConfig().then((cfg) => {
      if (!alive) return;
      setCfgLoaded(true);
      if (!cfg?.enabled) return;
      setZoneId(cfg.zones?.[slot] || null);
    });
    return () => {
      alive = false;
    };
  }, [slot]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || !zoneId || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [zoneId, visible]);

  useEffect(() => {
    if (!visible || !zoneId || served.current || hiddenForUser || meLoading) return;
    served.current = true;
    ensureProvider();
    const w = window as unknown as { AdProvider?: unknown[] };
    (w.AdProvider = w.AdProvider || []).push({ serve: {} });
  }, [visible, zoneId, hiddenForUser, meLoading]);

  /* ¿Llegó el anuncio? ExoClick lo dibuja junto al <ins>. Si en 12 s no
     llegó nada (sin anuncio disponible, bloqueador), el espacio se oculta
     para no dejar un recuadro vacío. */
  const [filled, setFilled] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const adRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = adRef.current;
    if (!visible || !el) return;
    const check = () => {
      const got = el.querySelector("iframe, img, video") != null || el.childElementCount > 1;
      if (got) setFilled(true);
      return got;
    };
    if (check()) return;
    const mo = new MutationObserver(() => {
      if (check()) mo.disconnect();
    });
    mo.observe(el, { childList: true, subtree: true });
    const t = setTimeout(() => {
      if (!check()) setGaveUp(true);
      mo.disconnect();
    }, giveUpAfter * 1000);
    return () => {
      mo.disconnect();
      clearTimeout(t);
    };
  }, [visible, meLoading, giveUpAfter]);

  const unavailable =
    (cfgLoaded && !zoneId) || (!meLoading && hiddenForUser) || gaveUp;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  useEffect(() => {
    if (unavailable) onStatusRef.current?.("unavailable");
    else if (filled) onStatusRef.current?.("filled");
  }, [unavailable, filled]);

  if (!zoneId || hiddenForUser || gaveUp) return null;

  const ins = visible && !meLoading ? <ins className={INS_CLASS} data-zoneid={zoneId} /> : null;
  const cardMax = fluid ? Math.round(width * 1.6) + 12 : width + 12;

  return (
    <div className={`flex w-full justify-center ${className}`} aria-label="Publicidad">
      <div
        className="w-full rounded-2xl border border-white/[0.08] bg-[#0c0a14] p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
        style={{ maxWidth: cardMax }}
      >
        <div className="flex items-center justify-between px-1.5 pb-1.5 pt-0.5">
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35">Publicidad</span>
          {!filled && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-400/50" aria-hidden />}
        </div>
        {fluid ? (
          <div
            ref={boxRef}
            className="relative w-full overflow-hidden rounded-xl bg-black/40"
            style={{ height: Math.round(height * scale) }}
          >
            <div
              ref={adRef}
              className="absolute left-1/2 top-0 flex items-center justify-center"
              style={{ width, height, transform: `translateX(-50%) scale(${scale})`, transformOrigin: "top center" }}
            >
              {ins}
            </div>
          </div>
        ) : (
          <div
            ref={boxRef}
            className="mx-auto flex max-w-full items-center justify-center overflow-hidden rounded-xl bg-black/40"
            style={{ width, height }}
          >
            <div ref={adRef} className="flex items-center justify-center">
              {ins}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
