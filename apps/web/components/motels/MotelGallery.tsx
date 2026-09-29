"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { resolveMediaUrl } from "../../lib/api";

/**
 * Fotos de la ficha: en escritorio una grande y cuatro chicas; en el teléfono
 * un carrusel a lo ancho. Cualquier foto abre el visor a pantalla completa.
 */
export default function MotelGallery({ photos, name }: { photos: string[]; name: string }) {
  const list = photos.map((p) => resolveMediaUrl(p)).filter(Boolean) as string[];
  const [open, setOpen] = useState<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const move = useCallback((d: number) => setOpen((i) => (i == null ? i : (i + d + list.length) % list.length)), [list.length]);

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, move]);

  if (!list.length) {
    return (
      <div className="flex aspect-[16/7] items-center justify-center rounded-3xl border border-white/[0.08] bg-gradient-to-br from-fuchsia-900/30 via-violet-900/20 to-transparent">
        <span className="select-none text-7xl font-black text-white/[0.06]">{name[0]?.toUpperCase()}</span>
      </div>
    );
  }

  const img = (src: string, i: number, className: string) => (
    <button key={src + i} onClick={() => setOpen(i)} className={`group relative overflow-hidden bg-[#0a0a10] ${className}`} aria-label={`Ver foto ${i + 1}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`${name}, foto ${i + 1}`} loading={i === 0 ? "eager" : "lazy"} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] group-hover:brightness-110" />
    </button>
  );

  return (
    <>
      {/* Teléfono: carrusel */}
      <div className="relative -mx-4 sm:hidden">
        <div className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none">
          {list.map((src, i) => img(src, i, "aspect-[4/3] w-full shrink-0 snap-center"))}
        </div>
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white/85 backdrop-blur">
          {list.length} fotos
        </span>
      </div>

      {/* Escritorio: mosaico */}
      <div className="relative hidden sm:block">
        {list.length === 1 ? (
          <div className="aspect-[16/7] overflow-hidden rounded-3xl">{img(list[0], 0, "h-full w-full")}</div>
        ) : (
          <div className="grid aspect-[16/7] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-3xl">
            {img(list[0], 0, "col-span-2 row-span-2")}
            {list.slice(1, 5).map((src, i) => img(src, i + 1, list.length === 2 ? "col-span-2 row-span-2" : list.length === 3 ? "col-span-2" : ""))}
          </div>
        )}
        {list.length > 1 && (
          <button
            onClick={() => setOpen(0)}
            className="absolute bottom-4 right-4 flex items-center gap-2 rounded-xl border border-white/20 bg-black/60 px-3.5 py-2 text-sm font-medium backdrop-blur-xl transition hover:bg-black/75"
          >
            <Images className="h-4 w-4" /> Ver las {list.length} fotos
          </button>
        )}
      </div>

      {open != null && (
        <div role="dialog" aria-modal="true" aria-label={`Fotos de ${name}`} className="fixed inset-0 z-[120] flex flex-col bg-black/95">
          <div className="flex items-center justify-between px-4 py-3 text-sm text-white/70">
            <span>{open + 1} / {list.length}</span>
            <button onClick={close} className="rounded-full p-2 hover:bg-white/10" aria-label="Cerrar"><X className="h-5 w-5" /></button>
          </div>
          <div className="relative flex flex-1 items-center justify-center px-2 pb-6" onClick={close}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={list[open]} alt={`${name}, foto ${open + 1}`} className="max-h-full max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
            {list.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); move(-1); }} className="absolute left-3 rounded-full bg-white/10 p-2.5 hover:bg-white/20" aria-label="Anterior"><ChevronLeft className="h-5 w-5" /></button>
                <button onClick={(e) => { e.stopPropagation(); move(1); }} className="absolute right-3 rounded-full bg-white/10 p-2.5 hover:bg-white/20" aria-label="Siguiente"><ChevronRight className="h-5 w-5" /></button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
