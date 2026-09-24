"use client";

/**
 * Cuerpo del inicio, ordenado por plan.
 *
 *   pestañas + filtros con contador (fijos al hacer scroll)
 *   Diamond  — tarjetas grandes con brillo, primera fila
 *   Mapa     — banda ancha, la diferencia de UZEED
 *   Gold     — fila propia con borde dorado
 *   Silver   — listado infinito con la tarjeta base
 *
 * Cada plan pagado se ve más grande, más arriba y más destacado en el mapa.
 * Los filtros y la pestaña se aplican a las cuatro piezas a la vez, así que el
 * mapa y los listados siempre muestran el mismo universo de perfiles.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { apiFetch, isRateLimitError } from "../../lib/api";
import { buildCurrentPathWithSearch, buildLoginHref } from "../../lib/chat";
import { trackImpressions } from "../../hooks/useAnalytics";
import { LocationFilterContext } from "../../hooks/useLocationFilter";
import HomeMapSection from "./HomeMapSection";
import ProfileCard, { type HomeCategory, type HomeProfile } from "./ProfileCard";
import { buildSearchParams, toHomeProfile, type HomeCounts, type QuickFilter } from "./homeQuery";

const TABS: Array<{ key: HomeCategory; label: string }> = [
  { key: "escort", label: "Escorts" },
  { key: "masajes", label: "Masajistas" },
  { key: "trans", label: "Trans" },
];

const TAB_NOUN: Record<HomeCategory, string> = {
  escort: "Escorts",
  masajes: "Masajistas",
  trans: "Trans",
};

const FILTERS: Array<{ key: QuickFilter; label: string; count?: keyof HomeCounts; dot?: boolean }> = [
  { key: "all", label: "Todas" },
  { key: "availableNow", label: "Disponibles ahora", count: "availableNow", dot: true },
  { key: "new", label: "Nuevas", count: "new" },
  { key: "exams", label: "Con exámenes", count: "exams" },
  { key: "video", label: "Con video", count: "video" },
];

const TIER_LIMIT = "24";
const PAGE_SIZE = 24;
/* Posición de la tarjeta "Publícate" dentro del listado Silver. */
const PUBLISH_TILE_AT = 5;

type SearchResponse = {
  results: any[];
  total: number;
  hasMore?: boolean;
  counts?: HomeCounts;
};

type Props = {
  isAuthed: boolean;
  /** Texto de la prueba gratis para la tarjeta "Publícate" (ej. "3 meses gratis"). */
  trialText: string;
  /** Va entre Gold y Silver (banners publicitarios en móvil). */
  beforeSilver?: ReactNode;
};

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 mt-[18px] flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.1em]">
      {children}
    </h2>
  );
}

function TierEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="col-span-full rounded-[10px] border border-dashed border-white/[0.14] p-3.5 text-[12.5px] text-white/40">
      {children}
    </p>
  );
}

function Skeletons({ n, aspect }: { n: number; aspect: string }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className={`${aspect} animate-pulse rounded-lg bg-white/[0.04]`} />
      ))}
    </>
  );
}

export default function HomeTieredFeed({ isAuthed, trialText, beforeSilver }: Props) {
  const router = useRouter();
  const locationCtx = useContext(LocationFilterContext);
  const coords = locationCtx?.effectiveLocation ?? null;
  const city =
    locationCtx?.state.mode === "city" ? locationCtx.state.selectedCity?.name ?? null : null;
  const locKey = `${coords?.[0] ?? ""},${coords?.[1] ?? ""},${city ?? ""}`;

  const [category, setCategory] = useState<HomeCategory>("escort");
  const [filter, setFilter] = useState<QuickFilter>("all");
  const [counts, setCounts] = useState<HomeCounts | null>(null);

  const [diamond, setDiamond] = useState<HomeProfile[] | null>(null);
  const [gold, setGold] = useState<HomeProfile[] | null>(null);

  const [silver, setSilver] = useState<HomeProfile[]>([]);
  const [silverTotal, setSilverTotal] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);
  const inFlight = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const loc = useMemo(() => ({ coords, city }), [locKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Contadores: dependen de la pestaña, no del filtro elegido. */
  useEffect(() => {
    const controller = new AbortController();
    setCounts(null);
    const qp = buildSearchParams(category, "all", loc, { includeCounts: "true", limit: "1" });
    apiFetch<SearchResponse>(`/directory/search?${qp.toString()}`, { signal: controller.signal })
      .then((res) => setCounts(res?.counts ?? null))
      .catch(() => {});
    return () => controller.abort();
  }, [category, loc]);

  /* Diamond y Gold: pocos perfiles por plan, se piden completos. */
  useEffect(() => {
    const controller = new AbortController();
    setDiamond(null);
    setGold(null);
    for (const [level, set] of [
      ["DIAMOND", setDiamond],
      ["GOLD", setGold],
    ] as const) {
      const qp = buildSearchParams(category, filter, loc, {
        level,
        limit: TIER_LIMIT,
        withGallery: "true",
      });
      apiFetch<SearchResponse>(`/directory/search?${qp.toString()}`, { signal: controller.signal })
        .then((res) => {
          const list = (res?.results ?? []).map(toHomeProfile);
          trackImpressions(list.map((p) => p.id), 0);
          set(list);
        })
        .catch((err: any) => {
          if (err?.name !== "AbortError") set([]);
        });
    }
    return () => controller.abort();
  }, [category, filter, loc]);

  /* Silver: listado paginado. */
  const loadPage = useCallback(
    async (nextOffset: number, replace = false) => {
      if (inFlight.current && !replace) return;
      inFlight.current = true;
      const myReq = ++reqId.current;
      setLoading(true);
      setError(null);
      try {
        const qp = buildSearchParams(category, filter, loc, {
          level: "SILVER",
          limit: String(PAGE_SIZE),
          offset: String(nextOffset),
          withGallery: "true",
        });
        const data = await apiFetch<SearchResponse>(`/directory/search?${qp.toString()}`);
        if (myReq !== reqId.current) return;
        const incoming = (data?.results ?? []).map(toHomeProfile);
        trackImpressions(incoming.map((p) => p.id), nextOffset);
        setSilver((prev) => {
          const base = replace ? [] : prev;
          const known = new Set(base.map((p) => p.id));
          return [...base, ...incoming.filter((p) => !known.has(p.id))];
        });
        setSilverTotal(typeof data?.total === "number" ? data.total : null);
        setHasMore(typeof data?.hasMore === "boolean" ? data.hasMore : incoming.length === PAGE_SIZE);
        setOffset(nextOffset + incoming.length);
      } catch (err: unknown) {
        if (myReq !== reqId.current) return;
        setError(
          isRateLimitError(err)
            ? "Demasiadas solicitudes, intenta de nuevo en unos segundos."
            : "No se pudieron cargar más perfiles.",
        );
        setHasMore(false);
      } finally {
        if (myReq === reqId.current) {
          setLoading(false);
          inFlight.current = false;
        }
      }
    },
    [category, filter, loc],
  );

  useEffect(() => {
    setSilver([]);
    setSilverTotal(null);
    setOffset(0);
    setHasMore(true);
    void loadPage(0, true);
  }, [loadPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadPage(offset);
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadPage, offset]);

  /* Favoritas de la cuenta, para pintar la estrella. */
  useEffect(() => {
    if (!isAuthed) {
      setFavorites(new Set());
      return;
    }
    apiFetch<{ favorites: Array<{ professional?: { id: string } | null }> }>("/favorites")
      .then((res) =>
        setFavorites(
          new Set((res?.favorites ?? []).map((f) => f.professional?.id).filter(Boolean) as string[]),
        ),
      )
      .catch(() => {});
  }, [isAuthed]);

  const toggleFavorite = useCallback(
    (id: string) => {
      if (!isAuthed) {
        router.push(buildLoginHref(buildCurrentPathWithSearch()));
        return;
      }
      const wasFav = favorites.has(id);
      const flip = (on: boolean) =>
        setFavorites((prev) => {
          const next = new Set(prev);
          if (on) next.add(id);
          else next.delete(id);
          return next;
        });
      flip(!wasFav);
      apiFetch(`/favorites/${id}`, { method: wasFav ? "DELETE" : "POST" }).catch(() => flip(wasFav));
    },
    [favorites, isAuthed, router],
  );

  const card = (p: HomeProfile, eager = false) => (
    <ProfileCard
      key={p.id}
      profile={p}
      category={category}
      isFavorite={favorites.has(p.id)}
      onToggleFavorite={toggleFavorite}
      eager={eager}
    />
  );

  const activeFilter = FILTERS.find((f) => f.key === filter)!;
  const noPaidAtAll =
    filter === "all" && diamond !== null && gold !== null && !diamond.length && !gold.length;

  const silverItems: ReactNode[] = [];
  silver.forEach((p, i) => {
    silverItems.push(card(p));
    if (i === PUBLISH_TILE_AT - 1 && !isAuthed) {
      silverItems.push(
        <div
          key="publish-tile"
          className="relative flex aspect-[2/3] max-w-full flex-col justify-end gap-2 overflow-hidden rounded-lg border border-white/[0.14] p-3.5"
          style={{
            background:
              "linear-gradient(160deg, rgba(217,70,239,0.28), rgba(217,70,239,0.05) 60%), #121224",
          }}
        >
          <h3 className="text-base font-extrabold leading-tight [text-wrap:balance]">
            ¿Trabajas como independiente?
          </h3>
          <p className="text-xs text-white/60">Crea tu perfil en minutos. {trialText}.</p>
          <Link
            href="/empezar"
            className="self-start rounded-lg bg-fuchsia-500 px-3 py-[7px] text-xs font-bold text-white transition hover:bg-fuchsia-400"
          >
            Publícate
          </Link>
        </div>,
      );
    }
  });

  return (
    <>
      {/* ═══ Pestañas + filtros, fijos bajo la cabecera ═══ */}
      <div className="sticky top-[60px] z-20 -mx-4 grid gap-2.5 border-b border-white/[0.08] bg-uzeed-900 px-4 pb-2.5 pt-2 md:top-[72px]">
        <div role="tablist" aria-label="Categoría" className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={category === t.key}
              onClick={() => {
                setCategory(t.key);
                setFilter("all");
              }}
              className={`shrink-0 rounded-lg px-2.5 py-2 text-[12px] font-extrabold uppercase tracking-[0.04em] transition sm:px-3.5 sm:text-[13px] sm:tracking-[0.06em] ${
                category === t.key ? "bg-uzeed-700 text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              {t.label}
            </button>
          ))}
          {/* El inicio lista mujeres; esta es la entrada para quien busca hombres. */}
          <Link
            href="/escorts?gender=MALE"
            className="ml-auto shrink-0 px-2 text-xs font-semibold text-white/40 transition hover:text-sky-200"
          >
            Ellos →
          </Link>
        </div>

        <div className="scrollbar-none flex items-center gap-2 overflow-x-auto">
          {FILTERS.map((f) => {
            const n = f.count && counts ? counts[f.count] : null;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(active && f.key !== "all" ? "all" : f.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-[11px] py-1.5 text-[12.5px] font-semibold transition ${
                  active
                    ? "border-fuchsia-500/50 bg-fuchsia-500/[0.14] text-white"
                    : "border-white/[0.08] bg-white/[0.02] text-white/60 hover:border-white/20"
                }`}
              >
                {f.dot && (
                  <span className="h-[7px] w-[7px] rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.2)]" />
                )}
                {f.label}
                {f.count && (
                  <span className="min-w-[1.5rem] rounded-full bg-white/[0.07] px-[7px] text-center text-[11.5px] font-extrabold tabular-nums text-white">
                    {n ?? "·"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ DIAMOND ═══ */}
      <SectionTitle>
        <span className="text-tier-diamond">◆ Diamond</span>
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {diamond === null ? (
          <Skeletons n={4} aspect="aspect-[3/4]" />
        ) : diamond.length ? (
          diamond.map((p, i) => card(p, i < 4))
        ) : noPaidAtAll ? (
          <Link
            href="/ayuda/tiers"
            className="group col-span-full flex items-center justify-between gap-3 rounded-[10px] border border-white/[0.08] bg-white/[0.02] px-4 py-3 transition hover:border-white/20"
          >
            <span className="text-sm font-bold">
              Planes <span className="text-tier-diamond">Diamond</span> y{" "}
              <span className="text-tier-gold">Gold</span>
              <span className="mt-0.5 block text-[11px] font-normal text-white/45">
                Los perfiles con plan aparecen primero en el inicio
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <TierEmpty>Ningún perfil Diamond con este filtro.</TierEmpty>
        )}
      </div>

      {/* ═══ MAPA ═══ */}
      <HomeMapSection category={category} filter={filter} />

      {/* ═══ GOLD ═══ */}
      <SectionTitle>
        <span className="text-tier-gold">★ Gold</span>
      </SectionTitle>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {gold === null ? (
          <Skeletons n={5} aspect="aspect-[2/3]" />
        ) : gold.length ? (
          gold.map((p) => card(p))
        ) : noPaidAtAll ? null : (
          <TierEmpty>Ningún perfil Gold con este filtro.</TierEmpty>
        )}
      </div>

      {beforeSilver}

      {/* ═══ SILVER ═══ */}
      <SectionTitle>
        <span>
          {filter === "all" ? "Todas" : activeFilter.label} · {TAB_NOUN[category]}
        </span>
        {silverTotal != null && (
          <span className="font-semibold normal-case tracking-[0.02em] text-white/40">
            {silverTotal} perfiles
          </span>
        )}
      </SectionTitle>

      {error && (
        <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          {error}
        </div>
      )}

      {silver.length === 0 && !loading && !error ? (
        <p className="py-10 text-center text-white/40">No hay más perfiles con este filtro.</p>
      ) : (
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {silverItems}
          {loading && <Skeletons n={6} aspect="aspect-[2/3]" />}
        </div>
      )}

      {hasMore && (
        <>
          <div ref={sentinelRef} aria-hidden="true" className="h-8 w-full" />
          <div className="mb-6 mt-[18px] flex justify-center">
            <button
              type="button"
              onClick={() => loadPage(offset)}
              disabled={loading}
              className="rounded-full border border-fuchsia-500/35 bg-fuchsia-500/[0.14] px-[22px] py-[9px] text-[13px] font-bold text-fuchsia-100 transition hover:border-fuchsia-400/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Cargando…" : "Ver más perfiles"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
