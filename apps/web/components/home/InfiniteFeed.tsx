"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, isRateLimitError } from "../../lib/api";
import { trackImpressions } from "../../hooks/useAnalytics";
import { LocationFilterContext } from "../../hooks/useLocationFilter";
import type { DirectoryResult } from "../DirectoryPage";
import ProfileCard, { toHomeProfile } from "./ProfileCard";

type Props = {
  /** When omitted, the title is derived from the active city/GPS chip. */
  title?: string;
  /** Comma-separated list, e.g. "escort,masajes". */
  categorySlug?: string;
  entityType?: "professional" | "establishment" | "shop";
  pageSize?: number;
  excludeIds?: string[];
  emptyLabel?: string;
};

type SearchResponse = {
  results: DirectoryResult[];
  total: number;
  hasMore?: boolean;
  nextOffset?: number | null;
};

const PAGE_SIZE_DEFAULT = 24;

export default function InfiniteFeed({
  title,
  categorySlug = "escort,masajes",
  entityType = "professional",
  pageSize = PAGE_SIZE_DEFAULT,
  excludeIds,
  emptyLabel = "Sin resultados por ahora.",
}: Props) {
  const locationCtx = useContext(LocationFilterContext);
  const effectiveLoc = locationCtx?.effectiveLocation ?? null;
  const selectedCity = locationCtx?.state.selectedCity ?? null;
  const selectedCityName =
    locationCtx?.state.mode === "city" ? selectedCity?.name ?? null : null;

  // If parent didn't pass a title, derive one from the active chip / location.
  const resolvedTitle = useMemo(() => {
    if (title) return title;
    if (selectedCity?.name) return `Escorts en ${selectedCity.name}`;
    if (effectiveLoc) return "Escorts cerca de ti";
    return "Escorts en todo Chile";
  }, [title, selectedCity?.name, effectiveLoc]);

  const [items, setItems] = useState<DirectoryResult[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const inFlight = useRef(false);
  const reqId = useRef(0);

  const seenIds = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);

  const loadPage = useCallback(
    async (nextOffset: number, replace = false) => {
      if (inFlight.current) return;
      inFlight.current = true;
      const myReq = ++reqId.current;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          entityType,
          categorySlug,
          // Home is female-only — male and trans are handled in their own pages.
          gender: "FEMALE",
          // When a chip/GPS is active, sort by proximity so the user always
          // sees the nearest profiles even if their region has no listings.
          sort: effectiveLoc ? "near" : "featured",
          limit: String(pageSize),
          offset: String(nextOffset),
          withGallery: "true",
        });
        if (effectiveLoc) {
          params.set("lat", String(effectiveLoc[0]));
          params.set("lng", String(effectiveLoc[1]));
          // Wide radius so empty regions still show closest profiles.
          params.set("radiusKm", "2000");
        }
        // Con una comuna elegida en el chip, la distancia se mide contra su
        // centro: una vecina puede quedar más cerca de ese punto que un perfil
        // del otro extremo de la misma comuna. El nombre le dice a la API que
        // ponga primero los de la comuna y después el resto por cercanía.
        if (selectedCityName) params.set("city", selectedCityName);
        const data = await apiFetch<SearchResponse>(
          `/directory/search?${params.toString()}`,
        );
        if (myReq !== reqId.current) return;
        const incoming = data.results || [];
        trackImpressions(incoming.map((r) => r.id), nextOffset);
        setItems((prev) => {
          const base = replace ? [] : prev;
          const known = new Set([...base.map((r) => r.id), ...seenIds]);
          const merged = [...base];
          for (const r of incoming) {
            if (!known.has(r.id)) {
              known.add(r.id);
              merged.push(r);
            }
          }
          return merged;
        });
        const nextHasMore =
          typeof data.hasMore === "boolean"
            ? data.hasMore
            : incoming.length === pageSize;
        setHasMore(nextHasMore);
        setOffset(nextOffset + incoming.length);
      } catch (err: unknown) {
        if (myReq !== reqId.current) return;
        if (isRateLimitError(err)) {
          setError("Demasiadas solicitudes, intenta de nuevo en unos segundos.");
        } else {
          setError("No se pudieron cargar más perfiles.");
        }
        setHasMore(false);
      } finally {
        if (myReq === reqId.current) setLoading(false);
        inFlight.current = false;
      }
    },
    [categorySlug, effectiveLoc, entityType, pageSize, seenIds, selectedCityName],
  );

  // Reset whenever location/category changes
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setHasMore(true);
    void loadPage(0, true);
    // intentionally exclude loadPage to avoid re-running on its own re-creation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySlug, entityType, effectiveLoc?.[0], effectiveLoc?.[1], selectedCityName]);

  // IntersectionObserver to trigger next page
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    if (!hasMore || loading) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void loadPage(offset);
          }
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadPage, offset]);

  return (
    <section className="mb-12">
      <h2 className="mb-4 text-2xl font-extrabold tracking-tight">{resolvedTitle}</h2>

      {error && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          {error}
        </div>
      )}

      {items.length === 0 && !loading && !error ? (
        <p className="py-16 text-center text-white/40">{emptyLabel}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((p, i) => (
            <ProfileCard key={p.id} profile={toHomeProfile(p)} eager={i < 4} />
          ))}

          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className="aspect-[3/4] animate-pulse rounded-2xl bg-white/[0.04]"
              />
            ))}
        </div>
      )}

      {hasMore && (
        <>
          <div ref={sentinelRef} aria-hidden="true" className="h-8 w-full" />
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => loadPage(offset)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-6 py-2.5 text-sm font-semibold text-fuchsia-200 transition hover:border-fuchsia-400/60 hover:bg-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Cargando…" : "Ver más"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
