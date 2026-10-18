"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, Camera, Flame, Lock, Sparkles, ShoppingBag } from "lucide-react";
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

/* Lo que se elige a primera vista: físico y origen. */
const LOOKS = [
  "rubia", "morena", "pelirroja", "trigueña",
  "tetona", "culona", "delgada", "fitness", "gordita",
  "tatuada", "natural",
  "chilena", "colombiana", "venezolana", "argentina",
] as const;

const GENDERS = [
  { value: "FEMALE", label: "Ellas" },
  { value: "OTHER", label: "Trans" },
  { value: "MALE", label: "Ellos" },
] as const;

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
      className={`group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0b0910] shadow-[0_20px_50px_-25px_rgba(236,72,153,0.45)] ${
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
                className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
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
                <span className="grid h-14 w-14 place-items-center rounded-full border border-white/20 bg-white/10 backdrop-blur">
                  <Lock className="h-6 w-6 text-white" />
                </span>
                <span className="text-base font-bold text-white">
                  {c.shop.productCount} {c.shop.productCount === 1 ? "pack exclusivo" : "packs exclusivos"}
                </span>
                <span className="text-xs text-white/70">Lo que no publica en ningún otro lado</span>
                <span className="rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 px-4 py-2 text-xs font-bold text-white shadow-lg">
                  Desbloquear
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
          {c.shop && c.shop.sales >= 5 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold text-black">
              <Flame className="h-3 w-3" /> Top ventas
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
          <h3 className={`flex items-center gap-1.5 font-extrabold text-white ${featured ? "text-2xl" : "text-base"}`}>
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
              className="flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 py-2 text-xs font-bold text-white shadow-[0_8px_20px_-8px_rgba(236,72,153,0.9)] transition active:scale-[0.97]"
            >
              {c.shop ? <ShoppingBag className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
              <span className="truncate">
                {c.shop?.minPriceClp
                  ? `${featured ? "Packs desde" : "Desde"} ${formatClp(c.shop.minPriceClp)}`
                  : featured ? "Ver su contenido" : "Ver más"}
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
  return <div className="aspect-[3/4] animate-pulse rounded-3xl bg-white/[0.04]" />;
}

export default function ContenidoClient() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [look, setLook] = useState<string | null>(null);
  const [gender, setGender] = useState<string>("FEMALE");
  const [sort, setSort] = useState<"popular" | "new">("popular");

  const buildQuery = useCallback(
    (offset: number) => {
      const qp = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), sort, gender });
      if (look) qp.set("tags", look);
      return `/directory/creators?${qp.toString()}`;
    },
    [look, gender, sort],
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

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
      active
        ? "border-fuchsia-400/60 bg-gradient-to-r from-fuchsia-500/30 to-rose-500/25 text-white shadow-[0_0_18px_rgba(236,72,153,0.25)]"
        : "border-white/10 bg-white/[0.03] text-white/60 hover:border-fuchsia-400/30 hover:text-white"
    }`;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16">
      {/* Hero */}
      <section className="relative -mx-4 mb-6 overflow-hidden px-4 pb-8 pt-8 text-center sm:mx-0 sm:mt-4 sm:rounded-3xl sm:border sm:border-white/[0.06]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(236,72,153,0.35),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(168,85,247,0.25),transparent_55%)]" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-fuchsia-200">
            <Sparkles className="h-3.5 w-3.5" /> Contenido exclusivo
          </span>
          <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl">
            Elige a la que más{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 via-pink-400 to-rose-400 bg-clip-text text-transparent">
              te guste
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/60 sm:text-base">
            Fotos y videos que no publican en ningún otro lado. Lo compras directo a ella y te llega al instante.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-white/50">
            <span className="flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5 text-sky-400" /> Perfiles verificados</span>
            <span className="flex items-center gap-1"><Lock className="h-3.5 w-3.5 text-fuchsia-300" /> Compra discreta</span>
            <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-amber-300" /> Entrega inmediata</span>
          </div>
        </div>
      </section>

      {/* Filtros: a quién quiere ver, no dónde está */}
      <div className="sticky top-0 z-20 -mx-4 mb-5 space-y-2.5 border-b border-white/[0.05] bg-[#09070d]/85 px-4 py-3 backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
            {GENDERS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setGender(g.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  gender === g.value ? "bg-gradient-to-r from-fuchsia-600 to-rose-500 text-white" : "text-white/55 hover:text-white"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 text-xs">
            {(["popular", "new"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                className={`whitespace-nowrap rounded-full px-3 py-1 font-semibold transition ${
                  sort === s ? "bg-white/10 text-white" : "text-white/45 hover:text-white/80"
                }`}
              >
                {s === "popular" ? "Top" : "Nuevas"}
              </button>
            ))}
          </div>
        </div>
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          <button type="button" onClick={() => setLook(null)} className={chip(look === null)}>
            Todas
          </button>
          {LOOKS.map((t) => (
            <button key={t} type="button" onClick={() => setLook(look === t ? null : t)} className={chip(look === t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {!loading && total > 0 && (
        <p className="mb-3 text-xs text-white/40">
          {total} {total === 1 ? "creadora" : "creadoras"}
          {look ? ` · ${look}` : ""}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : creators.length === 0 ? (
        <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] px-6 py-16 text-center">
          <Camera className="mx-auto h-10 w-10 text-white/20" />
          <p className="mt-3 text-sm text-white/60">
            {look ? `Todavía no hay creadoras "${look}".` : "Todavía no hay creadoras publicadas."}
          </p>
          {look && (
            <button type="button" onClick={() => setLook(null)} className="mt-4 text-xs font-semibold text-fuchsia-300 hover:text-fuchsia-200">
              Ver todas
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-flow-dense grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {creators.map((c, i) => (
              <CreatorCard key={c.id} c={c} featured={i === 0 && sort === "popular" && !look} />
            ))}
          </div>
          {hasMore && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-6 py-2.5 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/20 disabled:opacity-50"
              >
                {loadingMore ? "Cargando…" : "Ver más creadoras"}
              </button>
            </div>
          )}
        </>
      )}

      {/* Lado oferta */}
      <section className="mt-12 rounded-3xl border border-white/[0.06] bg-gradient-to-br from-fuchsia-500/[0.08] to-transparent p-6 text-center">
        <h2 className="text-lg font-bold text-white">¿Vendes contenido?</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-white/55">
          Publica tus packs gratis y llega a miles de clientes que buscan justo lo que haces.
        </p>
        <Link
          href="/vender-contenido"
          className="mt-4 inline-flex rounded-full bg-white px-5 py-2 text-sm font-bold text-black transition hover:bg-white/90"
        >
          Empezar a vender
        </Link>
      </section>
    </div>
  );
}
