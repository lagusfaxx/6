"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, Lock, ShoppingBag } from "lucide-react";
import BackButton from "../../components/BackButton";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import { cleanProfileHref } from "../../lib/profileUrl";

/*
 * Vitrina de creadoras de contenido. No es un directorio: no hay mapa ni
 * distancia, porque acá el cliente no busca a alguien cerca sino a la que más
 * le gusta. Todo gira alrededor de la foto y de ir directo a comprar.
 */

type Creator = {
  id: string;
  username: string;
  displayName: string;
  age: number | null;
  city: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  photos: string[];
  heightCm: number | null;
  measurements: string | null;
  hairColor: string | null;
  profileTags: string[];
  alsoEscort: boolean;
  availableNow: boolean;
  isNew: boolean;
  shop: { productCount: number; minPriceClp: number | null; sales: number } | null;
};

const PAGE_SIZE = 24;

function formatClp(n: number) {
  return `$${n.toLocaleString("es-CL")}`;
}

function shopHref(c: Creator) {
  return `/marketplace/tienda/${encodeURIComponent(c.username)}`;
}

function profileHref(c: Creator) {
  return cleanProfileHref({ id: c.id, username: c.username, serviceCategory: null, name: c.displayName, city: c.city });
}

/** Línea corta con el físico: "1,65 m · Rubia · 90-60-90". */
function looksLine(c: Creator) {
  const parts: string[] = [];
  if (c.heightCm) parts.push(`${(c.heightCm / 100).toFixed(2).replace(".", ",")} m`);
  if (c.hairColor) parts.push(c.hairColor);
  if (c.measurements) parts.push(c.measurements);
  return parts.join(" · ");
}

function CreatorCard({ c, featured = false }: { c: Creator; featured?: boolean }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState(0);
  const photos = c.photos.slice(0, 5);
  /* La última lámina es la tentación: su foto borrosa y el candado. */
  const slides = c.shop ? photos.length + 1 : photos.length;
  const target = c.shop ? shopHref(c) : profileHref(c);
  const teaser = photos[photos.length - 1] || c.avatarUrl;

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    setSlide(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
  }

  const looks = looksLine(c);

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0e1a] ${
        featured ? "col-span-2 sm:row-span-2" : ""
      }`}
    >
      <div className={`relative ${featured ? "aspect-[4/5] sm:aspect-auto sm:h-full" : "aspect-[3/4]"}`}>
        <div
          ref={scroller}
          onScroll={onScroll}
          className="scrollbar-none absolute inset-0 flex snap-x snap-mandatory overflow-x-auto"
        >
          {photos.map((url, i) => (
            <Link key={url + i} href={target} className="relative h-full w-full shrink-0 snap-center">
              <img
                src={resolveMediaUrl(url) ?? undefined}
                alt={i === 0 ? c.displayName : ""}
                loading={featured && i === 0 ? "eager" : "lazy"}
                decoding="async"
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/brand/isotipo-new.png";
                }}
              />
            </Link>
          ))}
          {c.shop && (
            <Link href={target} className="relative h-full w-full shrink-0 snap-center overflow-hidden">
              {teaser && (
                <img
                  src={resolveMediaUrl(teaser) ?? undefined}
                  alt=""
                  loading="lazy"
                  className="h-full w-full scale-110 object-cover blur-2xl brightness-50"
                />
              )}
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-black/40">
                  <Lock className="h-5 w-5 text-white" />
                </span>
                <span className="text-sm font-semibold text-white">
                  {c.shop.productCount} {c.shop.productCount === 1 ? "pack a la venta" : "packs a la venta"}
                </span>
                <span className="rounded-full bg-white px-4 py-2 text-xs font-bold text-black">
                  Ver sus packs
                </span>
              </span>
            </Link>
          )}
        </div>

        {/* Insignias */}
        <div className="pointer-events-none absolute left-3 top-3 z-[2] flex flex-wrap gap-1.5">
          {c.availableNow && (
            <span className="flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Online
            </span>
          )}
          {c.isNew && (
            <span className="rounded-full bg-fuchsia-500/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Nueva
            </span>
          )}
        </div>

        {/* Puntos de la galería */}
        {slides > 1 && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[2] flex justify-end gap-1 pr-3">
            {Array.from({ length: slides }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === slide ? "w-4 bg-white" : "w-1.5 bg-white/45"}`}
              />
            ))}
          </div>
        )}

        {/* Nombre, físico y precio */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black via-black/70 to-transparent px-3.5 pb-3.5 pt-16">
          <h3 className={`flex items-center gap-1.5 font-bold text-white ${featured ? "text-xl" : "text-[15px]"}`}>
            <span className="truncate">{c.displayName}</span>
            {c.age != null && <span className="font-medium text-white/70">{c.age}</span>}
            <BadgeCheck className="h-4 w-4 shrink-0 text-sky-400" aria-label="Verificada" />
          </h3>
          {(looks || c.city) && (
            <p className="mt-0.5 truncate text-[11px] text-white/65">{looks || c.city}</p>
          )}
          <div className="pointer-events-auto mt-2.5 flex items-center gap-2">
            <Link
              href={target}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full py-2 text-xs font-bold text-white transition active:scale-[0.97] ${
                c.shop
                  ? "bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:brightness-110"
                  : "border border-white/20 bg-black/40 backdrop-blur hover:bg-black/60"
              }`}
            >
              {c.shop && <ShoppingBag className="h-3.5 w-3.5" />}
              <span className="truncate">
                {c.shop?.minPriceClp
                  ? `${featured ? "Packs desde" : "Desde"} ${formatClp(c.shop.minPriceClp)}`
                  : "Ver perfil"}
              </span>
            </Link>
            {c.shop && featured && (
              <Link
                href={profileHref(c)}
                className="rounded-full border border-white/20 bg-black/40 px-3 py-2 text-xs font-semibold text-white/85 backdrop-blur transition hover:bg-black/60"
              >
                Perfil
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function SkeletonCard() {
  return <div className="aspect-[3/4] animate-pulse rounded-2xl bg-white/[0.04]" />;
}

export default function ContenidoClient() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const buildQuery = useCallback(
    (offset: number) => {
      /* Sin filtros: todas las mujeres, el cliente elige por la foto. */
      const qp = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), gender: "FEMALE" });
      return `/directory/creators?${qp.toString()}`;
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    apiFetch<{ creators: Creator[]; total: number; hasMore: boolean }>(buildQuery(0), { signal: controller.signal })
      .then((r) => {
        setCreators(r?.creators ?? []);
        setTotal(r?.total ?? 0);
        setHasMore(Boolean(r?.hasMore));
      })
      .catch(() => {
        if (!controller.signal.aborted) setCreators([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [buildQuery]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const r = await apiFetch<{ creators: Creator[]; hasMore: boolean }>(buildQuery(creators.length));
      setCreators((prev) => [...prev, ...(r?.creators ?? [])]);
      setHasMore(Boolean(r?.hasMore));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl pb-16">
      {/* Cabecera: la misma de las demás secciones (volver, título, conteo). */}
      <header className="flex items-center gap-3 py-1">
        <BackButton inline />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">Contenido</h1>
          <p className="mt-0.5 truncate text-[11px] text-white/45">
            {loading ? "Cargando…" : `${total} ${total === 1 ? "perfil" : "perfiles"} · fotos y videos`}
          </p>
        </div>
      </header>

      <div className="mt-3">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : creators.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-white/55">Pronto vas a ver perfiles acá.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-flow-dense grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {creators.map((c, i) => (
                <CreatorCard key={c.id} c={c} featured={i === 0} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-full border border-white/10 px-6 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/5 disabled:opacity-50"
                >
                  {loadingMore ? "Cargando…" : "Ver más"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <p className="mt-14 text-center text-xs text-white/40">
        ¿Vendes contenido?{" "}
        <Link href="/vender-contenido" className="font-semibold text-fuchsia-300 hover:text-fuchsia-200">
          Publica tus packs gratis
        </Link>
      </p>
    </div>
  );
}
