"use client";

import Link from "next/link";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, ShieldCheck, Video } from "lucide-react";
import { apiFetch, isRateLimitError, resolveMediaUrl } from "../../lib/api";
import { LocationFilterContext } from "../../hooks/useLocationFilter";
import { hasPremiumBadge, hasVerifiedBadge } from "../../lib/systemBadges";
import StatusBadgeIcon from "../StatusBadgeIcon";
import UserLevelBadge from "../UserLevelBadge";
import type { DirectoryResult } from "../DirectoryPage";

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

function profileImage(p: DirectoryResult) {
  return (
    resolveMediaUrl(p.coverUrl) ??
    resolveMediaUrl(p.avatarUrl) ??
    "/brand/isotipo-new.png"
  );
}

function hasExamsBadge(p: DirectoryResult) {
  return (p.profileTags || []).some((t) => {
    const n = String(t || "").trim().toLowerCase();
    return n === "profesional con examenes" || n === "profesional con exámenes";
  });
}

function hasVideoCallBadge(p: DirectoryResult) {
  const all = [...(p.serviceTags || []), ...(p.profileTags || [])];
  return all.some((t) => {
    const n = String(t || "").trim().toLowerCase();
    return n === "videollamada" || n === "videollamadas";
  });
}

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
        });
        if (effectiveLoc) {
          params.set("lat", String(effectiveLoc[0]));
          params.set("lng", String(effectiveLoc[1]));
          // Wide radius so empty regions still show closest profiles.
          params.set("radiusKm", "2000");
        }
        const data = await apiFetch<SearchResponse>(
          `/directory/search?${params.toString()}`,
        );
        if (myReq !== reqId.current) return;
        const incoming = data.results || [];
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
    [categorySlug, effectiveLoc, entityType, pageSize, seenIds],
  );

  // Reset whenever location/category changes
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setHasMore(true);
    void loadPage(0, true);
    // intentionally exclude loadPage to avoid re-running on its own re-creation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySlug, entityType, effectiveLoc?.[0], effectiveLoc?.[1]]);

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
          {items.map((p) => (
            <Link
              key={p.id}
              href={`/profesional/${p.id}`}
              className="group relative block overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0a14]"
            >
              <div className="relative aspect-[3/4] overflow-hidden">
                <img
                  src={profileImage(p)}
                  alt={p.displayName}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      "/brand/isotipo-new.png";
                  }}
                />
                <div className="absolute left-2 top-2 z-[3] flex flex-col gap-1">
                  {p.availableNow && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-400/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Online
                    </span>
                  )}
                  {hasExamsBadge(p) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[9px] font-bold text-sky-300 ring-1 ring-sky-400/30">
                      <ShieldCheck className="h-2.5 w-2.5" /> Exámenes
                    </span>
                  )}
                  {hasVideoCallBadge(p) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-bold text-violet-300 ring-1 ring-violet-400/30">
                      <Video className="h-2.5 w-2.5" /> Videollamada
                    </span>
                  )}
                </div>
                <div className="absolute right-2 top-2 z-[3]">
                  <UserLevelBadge
                    level={
                      p.userLevel as "SILVER" | "GOLD" | "DIAMOND" | null
                    }
                  />
                </div>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="flex items-center gap-1 truncate text-sm font-bold text-white">
                    <span className="truncate">{p.displayName}</span>
                    {hasPremiumBadge(p.profileTags) && (
                      <StatusBadgeIcon type="premium" size="h-3.5 w-3.5" />
                    )}
                    {hasVerifiedBadge(p.profileTags) && (
                      <StatusBadgeIcon type="verificada" size="h-3.5 w-3.5" />
                    )}
                    {p.age ? (
                      <span className="ml-1 text-[11px] font-normal tabular-nums text-white/55">
                        {p.age}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/55">
                    {p.city && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0 text-fuchsia-400/60" />
                        {p.city}
                      </span>
                    )}
                    {p.distance != null && (
                      <span className="shrink-0 tabular-nums text-white/40">
                        ·{" "}
                        {p.distance < 1
                          ? `${Math.round(p.distance * 1000)}m`
                          : `${p.distance.toFixed(1)}km`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
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
