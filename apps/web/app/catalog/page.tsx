"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { apiFetchWithRetry, resolveMediaUrl } from "../../lib/api";
import { useActiveLocation } from "../../hooks/useActiveLocation";
import UserLevelBadge from "../../components/UserLevelBadge";
import {
  Filter,
  MapPin,
  Search,
} from "lucide-react";

/* ── Types ── */

type VipProfile = {
  id: string;
  username: string;
  displayName: string;
  age: number | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
  availableNow: boolean;
  isActive: boolean;
  userLevel: string;
  tier: string | null;
  completedServices: number;
  profileViews: number;
  lastActiveAt: string | null;
  city: string | null;
  zone: string | null;
};

type Zone = { name: string; count: number };

/* ── Helpers ── */

function resolveProfileImage(profile: VipProfile) {
  return (
    resolveMediaUrl(profile.coverUrl) ??
    resolveMediaUrl(profile.avatarUrl) ??
    "/brand/isotipo-new.png"
  );
}

function formatLastSeenLabel(lastSeen?: string | null) {
  if (!lastSeen) return "Activa recientemente";
  const diff = Date.now() - Date.parse(lastSeen);
  if (!Number.isFinite(diff) || diff < 0) return "Activa recientemente";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `Activa hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Activa hace ${hours} hora${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `Activa hace ${days} día${days === 1 ? "" : "s"}`;
}

function tierBorderClass(tier: string | null, userLevel: string): string {
  const t = (tier ?? userLevel ?? "").toUpperCase();
  if (t === "PLATINUM" || t === "PREMIUM")
    return "shadow-[0_0_0_1px_rgba(34,211,238,0.4),0_0_28px_rgba(34,211,238,0.15)] border-cyan-200/40";
  if (t === "GOLD" || t === "DIAMOND")
    return "shadow-[0_0_0_1px_rgba(251,191,36,0.4),0_0_24px_rgba(251,191,36,0.12)] border-amber-300/40";
  return "border-white/[0.08]";
}

const SORT_OPTIONS = [
  { value: "vip", label: "VIP" },
  { value: "trending", label: "Tendencias" },
  { value: "new", label: "Nuevas" },
  { value: "availableNow", label: "Disponibles" },
] as const;

const cardFade = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

/* ── Page ── */

export default function CatalogPage() {
  const searchParams = useSearchParams();

  // Filters from URL
  const urlSort = searchParams.get("sort") || "vip";
  const urlTier = searchParams.get("tier") || "";
  const urlCity = searchParams.get("city") || "";

  const [profiles, setProfiles] = useState<VipProfile[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Local filter state
  const [sort, setSort] = useState(urlSort);
  const [tierFilter, setTierFilter] = useState(urlTier);
  const [zoneFilter, setZoneFilter] = useState(urlCity);

  const { activeLocation } = useActiveLocation();
  const location = useMemo<[number, number] | null>(
    () =>
      activeLocation ? [activeLocation.lat, activeLocation.lng] : null,
    [activeLocation?.lat, activeLocation?.lng],
  );

  const cityLabel = zoneFilter || activeLocation?.label || null;
  const showDistance = activeLocation?.source === "gps";

  // Fetch profiles from /home/sections (reuses same endpoint)
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const params = new URLSearchParams();
    if (cityLabel) params.set("city", cityLabel);
    if (location) {
      params.set("lat", String(location[0]));
      params.set("lng", String(location[1]));
    }
    params.set("limit", "24");

    apiFetchWithRetry<{
      platinum: VipProfile[];
      trending: VipProfile[];
      availableNow: VipProfile[];
      newArrivals: VipProfile[];
      zones: Zone[];
    }>(`/home/sections?${params.toString()}`, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;

        // Pick the right section based on sort
        let items: VipProfile[];
        if (sort === "new") {
          items = res?.newArrivals ?? [];
        } else if (sort === "availableNow") {
          items = res?.availableNow ?? [];
        } else if (sort === "trending") {
          items = res?.trending ?? [];
        } else {
          // VIP: merge platinum first, then trending (deduped)
          const seen = new Set<string>();
          items = [];
          for (const p of [...(res?.platinum ?? []), ...(res?.trending ?? [])]) {
            if (!seen.has(p.id)) {
              seen.add(p.id);
              items.push(p);
            }
          }
        }

        // Apply tier filter client-side
        if (tierFilter) {
          items = items.filter(
            (p) =>
              (p.tier ?? p.userLevel ?? "")
                .toUpperCase()
                .includes(tierFilter.toUpperCase()),
          );
        }

        setProfiles(items);
        setZones(res?.zones ?? []);
      })
      .catch((err: any) => {
        if (err?.name === "AbortError") return;
        setProfiles([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [location, cityLabel, sort, tierFilter]);

  return (
    <div className="min-h-[100dvh] text-white antialiased">
      {/* ── Sticky header with filters ── */}
      <div className="sticky top-[84px] z-30 border-b border-white/[0.06] bg-[#0e0e12]/95 px-4 py-3 backdrop-blur-xl md:top-[96px]">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <h1 className="shrink-0 text-lg font-bold">Catálogo</h1>

          {/* Sort pills */}
          <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSort(opt.value)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                  sort === opt.value
                    ? "bg-fuchsia-600 text-white"
                    : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Tier filter */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.08]"
          >
            <Filter className="h-3.5 w-3.5" />
            Filtros
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mx-auto mt-3 max-w-6xl rounded-xl border border-white/[0.08] bg-[#0c0c14] p-4">
            <div className="flex flex-wrap gap-3">
              {/* Tier */}
              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Nivel
                </p>
                <div className="flex gap-1.5">
                  {["", "PLATINUM", "GOLD", "SILVER"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTierFilter(t)}
                      className={`rounded-full px-3 py-1 text-xs transition ${
                        tierFilter === t
                          ? "bg-fuchsia-600 text-white"
                          : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1]"
                      }`}
                    >
                      {t || "Todos"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Zone chips */}
              {zones.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-white/40">
                    Zona
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setZoneFilter("")}
                      className={`rounded-full px-3 py-1 text-xs transition ${
                        !zoneFilter
                          ? "bg-fuchsia-600 text-white"
                          : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1]"
                      }`}
                    >
                      Todas
                    </button>
                    {zones.map((z) => (
                      <button
                        key={z.name}
                        onClick={() => setZoneFilter(z.name)}
                        className={`rounded-full px-3 py-1 text-xs transition ${
                          zoneFilter === z.name
                            ? "bg-fuchsia-600 text-white"
                            : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1]"
                        }`}
                      >
                        {z.name} ({z.count})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="aspect-[4/5] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]"
              />
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="mb-4 h-10 w-10 text-white/20" />
            <p className="text-lg font-semibold text-white/60">
              No se encontraron perfiles
            </p>
            <p className="mt-1 text-sm text-white/40">
              Intenta con otros filtros o cambia de zona
            </p>
            <button
              onClick={() => {
                setTierFilter("");
                setZoneFilter("");
                setSort("vip");
              }}
              className="mt-4 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 hover:bg-white/[0.08]"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
          >
            {profiles.map((p) => {
              const cover = resolveProfileImage(p);
              const href = `/perfil/${p.username}`;
              const border = tierBorderClass(p.tier, p.userLevel);

              return (
                <motion.div key={p.id} variants={cardFade}>
                  <Link
                    href={href}
                    className={`group relative block overflow-hidden rounded-2xl border bg-white/[0.03] transition-all duration-200 hover:-translate-y-1 hover:scale-[1.02] ${border}`}
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-white/5 to-transparent">
                      <img
                        src={cover ?? undefined}
                        alt={p.displayName}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          img.onerror = null;
                          img.src = "/brand/isotipo-new.png";
                          img.className =
                            "h-20 w-20 mx-auto mt-20 opacity-40";
                        }}
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                      <UserLevelBadge
                        level={p.userLevel as any}
                        className="absolute left-2 top-2 px-2 py-1 text-[11px]"
                      />

                      {p.availableNow ? (
                        <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-100">
                          <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                          Disponible
                        </div>
                      ) : (
                        <div className="absolute right-2 top-2 rounded-full border border-white/15 bg-black/45 px-2 py-1 text-[11px] text-white/80">
                          {formatLastSeenLabel(p.lastActiveAt)}
                        </div>
                      )}

                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h3 className="truncate text-sm font-semibold">
                          {p.displayName}
                          {p.age != null ? `, ${p.age}` : ""}
                        </h3>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-white/55">
                          {showDistance && p.distanceKm != null ? (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />
                              {p.distanceKm.toFixed(1)} km
                            </span>
                          ) : (
                            (p.zone || p.city) && (
                              <span>{p.zone ?? p.city}</span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
