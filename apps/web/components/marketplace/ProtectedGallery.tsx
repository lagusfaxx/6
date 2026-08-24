"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Lock, ShieldCheck, Video as VideoIcon, X } from "lucide-react";
import type { MarketOrderAsset } from "../../lib/marketplace";

/**
 * Visor del contenido comprado.
 *
 * Ningún visor web puede impedir una captura de pantalla de verdad: lo que sí
 * se puede es quitar todas las vías cómodas de copia (descarga, menú
 * contextual, arrastrar, seleccionar), marcar cada imagen con los datos de
 * quien la está viendo — que es lo que desincentiva compartirla — y ocultar el
 * contenido cuando la pestaña deja de estar en primer plano, que es el momento
 * en que se dispara la mayoría de las capturas de escritorio.
 */

type Props = {
  assets: MarketOrderAsset[];
  /** Marca de agua: identifica a quien compró el contenido. */
  watermark: string;
  onRefreshUrls?: () => void | Promise<void>;
};

export default function ProtectedGallery({ assets, watermark, onRefreshUrls }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [hidden, setHidden] = useState(false);
  const [manualHide, setManualHide] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  /* Ocultar al perder el foco: al invocar la herramienta de captura del
     sistema la pestaña deja de estar visible o pierde el foco primero. */
  useEffect(() => {
    const hide = () => setHidden(true);
    const show = () => setHidden(false);
    const onVisibility = () => (document.visibilityState === "visible" ? show() : hide());
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", hide);
    window.addEventListener("focus", show);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", show);
    };
  }, []);

  /* Atajos habituales de captura e impresión. */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key?.toLowerCase();
      if (key === "printscreen" || (e.metaKey && e.shiftKey) || (e.ctrlKey && (key === "p" || key === "s"))) {
        e.preventDefault();
        setHidden(true);
        window.setTimeout(() => setHidden(false), 1500);
      }
      if (key === "escape") setOpenIndex(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const block = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    return false;
  }, []);

  const refresh = useCallback(async () => {
    if (onRefreshUrls) await onRefreshUrls();
  }, [onRefreshUrls]);

  if (!assets.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center">
        <Lock className="mx-auto mb-2 h-6 w-6 text-white/30" />
        <p className="text-sm text-white/50">Todavía no hay contenido entregado en este pedido.</p>
      </div>
    );
  }

  const veiled = hidden || manualHide;

  return (
    <div ref={containerRef} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-white/50">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          Contenido protegido: no se puede descargar y queda marcado con tus datos.
        </div>
        <button
          type="button"
          onClick={() => setManualHide((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/[0.08]"
        >
          {manualHide ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {manualHide ? "Mostrar" : "Ocultar"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {assets.map((asset, index) => (
          <button
            key={asset.id}
            type="button"
            onClick={() => setOpenIndex(index)}
            className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-black/40"
          >
            <ProtectedFrame asset={asset} watermark={watermark} veiled={veiled} thumb onError={refresh} />
            {asset.type === "VIDEO" && (
              <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
                <VideoIcon className="h-3 w-3" /> Video
              </span>
            )}
          </button>
        ))}
      </div>

      {openIndex !== null && assets[openIndex] && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 p-4"
          onContextMenu={block}
          onClick={() => setOpenIndex(null)}
        >
          <button
            type="button"
            onClick={() => setOpenIndex(null)}
            className="absolute right-4 top-4 rounded-full border border-white/15 bg-white/10 p-2 text-white"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="max-h-[86vh] w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <ProtectedFrame asset={assets[openIndex]} watermark={watermark} veiled={veiled} onError={refresh} />
          </div>
        </div>
      )}
    </div>
  );
}

function ProtectedFrame({
  asset,
  watermark,
  veiled,
  thumb,
  onError,
}: {
  asset: MarketOrderAsset;
  watermark: string;
  veiled: boolean;
  thumb?: boolean;
  onError?: () => void;
}) {
  const block = (e: React.SyntheticEvent) => {
    e.preventDefault();
    return false;
  };

  const source = thumb && asset.thumbnailUrl ? asset.thumbnailUrl : asset.url;
  const isVideo = asset.type === "VIDEO" && !thumb;

  return (
    <div
      className="relative h-full w-full select-none overflow-hidden rounded-2xl bg-black"
      onContextMenu={block}
      onDragStart={block}
      style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
    >
      {isVideo ? (
        <video
          src={source}
          controls
          controlsList="nodownload noplaybackrate noremoteplayback"
          disablePictureInPicture
          playsInline
          onContextMenu={block}
          onError={onError}
          className="h-full w-full object-contain"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source}
          alt=""
          draggable={false}
          onContextMenu={block}
          onDragStart={block}
          onError={onError}
          className={`h-full w-full ${thumb ? "object-cover" : "object-contain"}`}
        />
      )}

      {/* Capa transparente: evita el "guardar imagen" por pulsación larga en móvil. */}
      {!isVideo && <div className="absolute inset-0" aria-hidden />}

      {/* Marca de agua repetida con los datos de quien compró. */}
      <div className="pointer-events-none absolute inset-0 flex flex-wrap items-center justify-center gap-6 overflow-hidden opacity-[0.14]">
        {Array.from({ length: thumb ? 3 : 12 }).map((_, i) => (
          <span key={i} className="-rotate-[24deg] whitespace-nowrap text-[10px] font-semibold uppercase tracking-widest text-white sm:text-xs">
            {watermark}
          </span>
        ))}
      </div>

      {veiled && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/95 backdrop-blur-xl">
          <EyeOff className="h-6 w-6 text-white/40" />
          <p className="px-4 text-center text-[11px] text-white/50">
            Contenido oculto mientras la ventana no está activa
          </p>
        </div>
      )}
    </div>
  );
}
