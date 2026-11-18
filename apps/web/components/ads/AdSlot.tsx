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

export type AdSlotName = "homeFeed" | "homeCamsDesktop" | "homeCamsMobile" | "listing";

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
  className?: string;
};

export default function AdSlot({ slot, width, height, className = "" }: Props) {
  const { me, loading: meLoading } = useMe();
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const served = useRef(false);

  const hiddenForUser = NO_ADS_PROFILE_TYPES.has(String(me?.user?.profileType || "").toUpperCase());

  useEffect(() => {
    let alive = true;
    loadAdsConfig().then((cfg) => {
      if (!alive || !cfg?.enabled) return;
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

  if (!zoneId || hiddenForUser) return null;

  return (
    <div className={`flex w-full flex-col items-center ${className}`} aria-label="Publicidad">
      <span className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-white/25">Publicidad</span>
      <div
        ref={boxRef}
        className="flex max-w-full items-center justify-center overflow-hidden rounded-lg bg-white/[0.02]"
        style={{ width, height }}
      >
        {visible && !meLoading && <ins className={INS_CLASS} data-zoneid={zoneId} />}
      </div>
    </div>
  );
}
