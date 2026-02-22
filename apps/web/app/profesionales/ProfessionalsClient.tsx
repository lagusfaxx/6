"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import MapboxMap from "../../components/MapboxMap";
import Avatar from "../../components/Avatar";
import StarRating from "../../components/StarRating";
import SkeletonCard from "../../components/SkeletonCard";
import { LocationFilterContext } from "../../hooks/useLocationFilter";
import useMe from "../../hooks/useMe";
import { MessageCircle, Eye, MapPin } from "lucide-react";

const tiers = ["PREMIUM", "GOLD", "SILVER"] as const;

type Professional = {
  id: string;
  name: string;
  avatarUrl: string | null;
  coverUrl?: string | null;
  rating: number | null;
  distance: number | null;
  latitude?: number | null;
  longitude?: number | null;
  locality?: string | null;
  approxAreaM?: number | null;
  isActive: boolean;
  tier: string | null;
  gender: string | null;
  age?: number | null;
  serviceSummary?: string | null;
  availableNow?: boolean;
  category: { id: string; name: string; displayName?: string | null; kind: string } | null;
};

type CategoryRef = {
  id: string;
  name: string;
  displayName?: string | null;
  slug?: string | null;
};

function tierBorderPro(t: string | null) {
  if (t === "PREMIUM" || t === "DIAMOND") return "border-cyan-400/30 hover:border-cyan-400/50 hover:shadow-[0_8px_24px_rgba(34,211,238,0.08)]";
  if (t === "GOLD") return "border-amber-400/30 hover:border-amber-400/50 hover:shadow-[0_8px_24px_rgba(251,191,36,0.08)]";
  return "border-white/10 hover:border-fuchsia-400/30";
}

export default function ProfessionalsClient() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || "";

  const [rangeKm, setRangeKm] = useState("30");
  const [tier, setTier] = useState("");
  const locationCtx = useContext(LocationFilterContext);
  const location = locationCtx?.effectiveLocation ?? null;
  const [items, setItems] = useState<Professional[]>([]);
  const [categoryInfo, setCategoryInfo] = useState<CategoryRef | null>(null);
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);
  const [categoryWarning, setCategoryWarning] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (rangeKm) params.set("rangeKm", rangeKm);
    if (tier) params.set("tier", tier);
    if (location) {
      params.set("lat", String(location[0]));
      params.set("lng", String(location[1]));
    }
    return params.toString();
  }, [category, rangeKm, tier, location]);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ professionals: Professional[]; category: CategoryRef | null; message?: string; warning?: string }>(`/professionals?${queryString}`)
      .then((res) => {
        setItems(res.professionals);
        setCategoryInfo(res.category || null);
        setCategoryMessage(res.message || null);
        setCategoryWarning(res.warning || null);
      })
      .finally(() => setLoading(false));
  }, [queryString]);

  const displayCategory =
    categoryInfo?.displayName ||
    categoryInfo?.name ||
    (category ? category.replace(/-/g, " ") : "");

  const breadcrumbCategory = displayCategory || "Experiencias";
  const filtersContent = (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="grid gap-2 text-xs text-white/60">
        Rango (km)
        <input
          value={rangeKm}
          onChange={(e) => setRangeKm(e.target.value)}
          className="input"
          type="number"
          min="1"
        />
      </label>
      <label className="grid gap-2 text-xs text-white/60">
        Tier
        <select value={tier} onChange={(e) => setTier(e.target.value)} className="input">
          <option value="">Todos</option>
          {tiers.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  return (
    <div className="grid gap-6">
      <div className="card p-6">
        <div className="flex flex-col gap-2">
          <nav className="text-xs text-white/50">
            <Link href="/" className="hover:text-white">Home</Link> /{" "}
            <Link href="/profesionales" className="hover:text-white">Experiencias</Link> /{" "}
            <span className="text-white/80">{breadcrumbCategory || "Explorar"}</span>
          </nav>
          <h1 className="text-2xl font-semibold">{displayCategory || "Experiencias"}</h1>
          <p className="text-sm text-white/70">Experiencias disponibles cerca de ti.</p>
        </div>

        <div className="mt-4 hidden md:block">{filtersContent}</div>
        <div className="mt-4 flex items-center gap-3 md:hidden">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/80 hover:bg-white/10"
          >
            Filtrar
          </button>
        </div>
        {categoryMessage ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
            {categoryMessage}
          </div>
        ) : null}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-lg font-semibold">Mapa principal</h2>
          <p className="mt-1 text-xs text-white/60">Ubicaciones aproximadas y perfiles activos disponibles.</p>
        </div>
        <div className="p-3">
          <MapboxMap
            userLocation={location}
            focusMarkerId={focusedId}
            onMarkerFocus={(id) => setFocusedId(id)}
            markers={items
              .filter((p) => p.latitude != null && p.longitude != null)
              .map((p) => ({
                id: p.id,
                name: p.name,
                lat: Number(p.latitude),
                lng: Number(p.longitude),
                subtitle: p.category?.displayName || p.category?.name || null,
                locality: p.locality || null,
                age: p.age ?? null,
                gender: p.gender ?? null,
                description: p.serviceSummary || null,
                href: `/profesional/${p.id}`,
                messageHref: isAuthed ? `/chats?user=${p.id}` : `/login?next=${encodeURIComponent(`/chats?user=${p.id}`)}`,
                avatarUrl: p.avatarUrl,
                tier: p.tier,
                areaRadiusM: p.approxAreaM ?? 600
              }))}
            rangeKm={Number(rangeKm) || 15}
          />
        </div>
      </div>

      {filtersOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 md:hidden">
          <div className="w-full rounded-t-2xl border border-white/10 bg-[#120b2a] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold">Filtros</div>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="text-xs text-white/60 hover:text-white"
              >
                Cerrar
              </button>
            </div>
            {filtersContent}
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="mt-4 w-full rounded-xl bg-white text-black py-2 text-sm font-semibold"
            >
              Aplicar filtros
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : categoryWarning === "category_not_found" ? (
        <div className="card p-6 text-white/70">
          <div className="text-lg font-semibold">Categoría no disponible</div>
          <p className="mt-2 text-sm text-white/60">Prueba con otra categoría o vuelve al listado general.</p>
          <Link href="/profesionales" className="mt-4 inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/80 hover:bg-white/10">
            Volver a experiencias
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => {
            const chatHref = isAuthed
              ? `/chats?user=${p.id}`
              : `/login?next=${encodeURIComponent(`/chats?user=${p.id}`)}`;
            const coverImg = p.coverUrl ? resolveMediaUrl(p.coverUrl) : null;
            const avatarImg = p.avatarUrl ? resolveMediaUrl(p.avatarUrl) : null;
            const heroImg = coverImg || avatarImg;

            return (
              <div
                key={p.id}
                onClick={() => setFocusedId(p.id)}
                className={`group overflow-hidden rounded-2xl border ${tierBorderPro(p.tier)} bg-white/[0.03] transition-all duration-200 hover:-translate-y-0.5 cursor-pointer`}
              >
                {/* Card image */}
                <Link href={`/profesional/${p.id}`} className="block">
                  <div className="relative aspect-[4/3] overflow-hidden bg-white/5">
                    {heroImg ? (
                      <img src={heroImg} alt={p.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Avatar src={p.avatarUrl} alt={p.name} size={56} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    {/* Top badges */}
                    <div className="absolute top-2 left-2 right-2 flex justify-between">
                      {p.availableNow ? (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Online
                        </span>
                      ) : <span />}
                      {p.tier && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          p.tier === "PREMIUM" ? "border border-cyan-400/30 bg-cyan-500/20 text-cyan-200" :
                          p.tier === "GOLD" ? "border border-amber-400/30 bg-amber-500/20 text-amber-200" :
                          "border border-white/20 bg-white/10 text-white/70"
                        }`}>
                          {p.tier}
                        </span>
                      )}
                    </div>
                    {/* Bottom info */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <div className="font-semibold text-sm">{p.name}{p.age ? `, ${p.age}` : ""}</div>
                      <div className="flex items-center gap-2 text-[11px] text-white/50 mt-0.5">
                        <StarRating rating={p.rating} size={10} />
                        {p.distance != null && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" />
                            {p.distance < 1 ? `${Math.round(p.distance * 1000)}m` : `${p.distance.toFixed(1)}km`}
                          </span>
                        )}
                        {p.locality && <span>{p.locality}</span>}
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Service summary */}
                {p.serviceSummary && (
                  <div className="px-3 pt-2 text-[11px] text-white/45 line-clamp-1">{p.serviceSummary}</div>
                )}

                {/* CTA row - Conversion focused */}
                <div className="flex gap-1.5 p-2">
                  <Link
                    href={chatHref}
                    onClick={(e) => e.stopPropagation()}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600/90 to-violet-600/90 py-2.5 text-xs font-semibold transition hover:brightness-110 shadow-[0_4px_16px_rgba(168,85,247,0.15)]"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Enviar mensaje
                  </Link>
                  <Link
                    href={`/profesional/${p.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs text-white/60 hover:bg-white/10 transition"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
          {!items.length ? (
            <div className="card p-6 text-white/60 col-span-full">No encontramos experiencias con estos filtros.</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
