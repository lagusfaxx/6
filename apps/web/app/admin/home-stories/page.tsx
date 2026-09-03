"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  Crown,
  Heart,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";

type HomeStory = {
  id: string;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO";
  showInHome: boolean;
  isHidden: boolean;
  createdAt: string;
  renewedAt: string | null;
  expiresAt: string;
  expired: boolean;
  likeCount: number;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    tier?: string | null;
    profileType?: string | null;
  };
};

type FilterMode = "all" | "approved" | "pending";
type RangeMode = "all" | "active" | "expired";
type VisibilityMode = "all" | "visible" | "hidden";

type ProfileGroup = {
  user: HomeStory["user"];
  stories: HomeStory[];
  approved: number;
  hasActive: boolean;
};

/** Historias que tiene sentido renovar: las expiradas y las ocultas. */
function renewableIds(stories: HomeStory[]): string[] {
  return stories.filter((s) => s.expired || s.isHidden).map((s) => s.id);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mes`;
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "expirada";
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function groupByUser(stories: HomeStory[]): ProfileGroup[] {
  const map = new Map<string, ProfileGroup>();
  for (const s of stories) {
    const g = map.get(s.user.id);
    if (g) {
      g.stories.push(s);
      if (s.showInHome) g.approved++;
      if (!s.expired) g.hasActive = true;
    } else {
      map.set(s.user.id, {
        user: s.user,
        stories: [s],
        approved: s.showInHome ? 1 : 0,
        hasActive: !s.expired,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.approved !== b.approved) return b.approved - a.approved;
    if (a.hasActive !== b.hasActive) return a.hasActive ? -1 : 1;
    return a.user.displayName.localeCompare(b.user.displayName);
  });
}

export default function AdminHomeStoriesPage() {
  const { me, loading: meLoading } = useMe();
  const isAdmin = (me?.user?.role ?? "").toUpperCase() === "ADMIN";

  const [filter, setFilter] = useState<FilterMode>("all");
  const [range, setRange] = useState<RangeMode>("all");
  const [visibility, setVisibility] = useState<VisibilityMode>("all");
  const [search, setSearch] = useState("");
  const [stories, setStories] = useState<HomeStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [renewingId, setRenewingId] = useState<string | null>(null);

  const load = (
    filterMode: FilterMode,
    rangeMode: RangeMode,
    visibilityMode: VisibilityMode,
  ) => {
    setLoading(true);
    setError(null);
    apiFetch<{ stories: HomeStory[] }>(
      `/admin/home-stories?filter=${filterMode}&range=${rangeMode}&visibility=${visibilityMode}`,
    )
      .then((res) => setStories(res?.stories ?? []))
      .catch((e: any) => {
        setError(e?.message || "Error al cargar");
        setStories([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isAdmin) return;
    load(filter, range, visibility);
  }, [isAdmin, filter, range, visibility]);

  const groups = useMemo(() => groupByUser(stories), [stories]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.user.displayName.toLowerCase().includes(q) ||
        g.user.username.toLowerCase().includes(q),
    );
  }, [groups, search]);

  const totalApproved = useMemo(
    () => stories.filter((s) => s.showInHome).length,
    [stories],
  );

  async function toggle(story: HomeStory) {
    const next = !story.showInHome;
    setUpdatingId(story.id);
    setStories((prev) =>
      prev.map((s) => (s.id === story.id ? { ...s, showInHome: next } : s)),
    );
    try {
      await apiFetch(`/admin/home-stories/${story.id}`, {
        method: "PATCH",
        body: JSON.stringify({ showInHome: next }),
      });
    } catch (e: any) {
      setStories((prev) =>
        prev.map((s) =>
          s.id === story.id ? { ...s, showInHome: !next } : s,
        ),
      );
      setError(e?.message || "No se pudo actualizar");
    } finally {
      setUpdatingId(null);
    }
  }

  async function toggleHidden(story: HomeStory) {
    const next = !story.isHidden;
    setUpdatingId(story.id);
    setStories((prev) =>
      prev.map((s) => (s.id === story.id ? { ...s, isHidden: next } : s)),
    );
    try {
      await apiFetch(`/admin/home-stories/${story.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isHidden: next }),
      });
    } catch (e: any) {
      setStories((prev) =>
        prev.map((s) => (s.id === story.id ? { ...s, isHidden: !next } : s)),
      );
      setError(e?.message || "No se pudo ocultar la historia");
    } finally {
      setUpdatingId(null);
    }
  }

  /** Renueva historias antiguas: vuelven a circular como si fueran nuevas. */
  async function renew(ids: string[], key: string) {
    if (ids.length === 0) return;
    setRenewingId(key);
    setError(null);
    try {
      const res = await apiFetch<{ expiresAt: string; renewedAt: string }>(
        ids.length === 1
          ? `/admin/home-stories/${ids[0]}/renew`
          : `/admin/home-stories/renew`,
        ids.length === 1
          ? { method: "POST", body: JSON.stringify({}) }
          : { method: "POST", body: JSON.stringify({ ids }) },
      );
      const set = new Set(ids);
      setStories((prev) =>
        prev.map((s) =>
          set.has(s.id)
            ? {
                ...s,
                isHidden: false,
                expired: false,
                expiresAt: res?.expiresAt ?? s.expiresAt,
                renewedAt: res?.renewedAt ?? new Date().toISOString(),
              }
            : s,
        ),
      );
    } catch (e: any) {
      setError(e?.message || "No se pudo renovar");
    } finally {
      setRenewingId(null);
    }
  }

  function toggleCollapse(userId: string) {
    setCollapsed((prev) => ({ ...prev, [userId]: !prev[userId] }));
  }

  if (meLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">
        Cargando...
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">
        Acceso restringido.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al panel
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Crown className="h-5 w-5 text-amber-400" />
              Historias en Home
            </h1>
            <p className="mt-1 text-sm text-white/55">
              Aprueba historias para que roten sobre la foto de portada en
              Destacadas. Las aprobadas siguen rotando aunque la historia ya
              haya expirado. También puedes ocultar historias sin borrarlas y
              renovar historias viejas para que vuelvan a aparecer junto a las
              nuevas.
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-200">
            <span className="font-semibold text-amber-300">
              {totalApproved}
            </span>{" "}
            aprobadas · {filteredGroups.length} profesionales
          </div>
        </div>

        {/* Search */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar profesional..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm placeholder:text-white/30 focus:border-fuchsia-400/40 focus:outline-none"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-white/40">
              <Filter className="h-3 w-3" /> Estado:
            </span>
            {(["all", "pending", "approved"] as FilterMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilter(mode)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  filter === mode
                    ? "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
                }`}
              >
                {mode === "all"
                  ? "Todas"
                  : mode === "pending"
                    ? "Por revisar"
                    : "Aprobadas"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/40">Período:</span>
            {(["all", "active", "expired"] as RangeMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setRange(mode)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  range === mode
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
                }`}
              >
                {mode === "all"
                  ? "Todo el historial"
                  : mode === "active"
                    ? "Activas"
                    : "Expiradas"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/40">Visibilidad:</span>
            {(["all", "visible", "hidden"] as VisibilityMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setVisibility(mode)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  visibility === mode
                    ? "border-sky-400/40 bg-sky-500/15 text-sky-200"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
                }`}
              >
                {mode === "all"
                  ? "Todas"
                  : mode === "visible"
                    ? "Visibles"
                    : "Ocultas"}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-12 flex justify-center text-white/40">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/55">
            {search
              ? `Sin resultados para "${search}".`
              : "No hay historias para los filtros seleccionados."}
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {filteredGroups.map((g) => {
              const isCollapsed = collapsed[g.user.id];
              const avatar = resolveMediaUrl(g.user.avatarUrl);
              return (
                <section
                  key={g.user.id}
                  className={`overflow-hidden rounded-2xl border ${
                    g.approved > 0
                      ? "border-fuchsia-400/30 bg-fuchsia-500/[0.03]"
                      : "border-white/10 bg-white/[0.02]"
                  }`}
                >
                  <header
                    onClick={() => toggleCollapse(g.user.id)}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-white/[0.02]"
                  >
                    <button
                      type="button"
                      aria-label={isCollapsed ? "Expandir" : "Colapsar"}
                      className="text-white/40 hover:text-white/70"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/40">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={g.user.displayName}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs font-bold text-white/40">
                          {g.user.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/profesional/${g.user.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="truncate text-sm font-semibold hover:underline"
                        >
                          {g.user.displayName}
                        </Link>
                        {g.user.tier && (
                          <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-white/55">
                            {g.user.tier}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-white/40">
                        @{g.user.username} · {g.stories.length}{" "}
                        {g.stories.length === 1 ? "historia" : "historias"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-right text-[11px]">
                      {g.approved > 0 ? (
                        <span className="rounded-full bg-fuchsia-500/15 px-2 py-1 font-semibold text-fuchsia-200">
                          {g.approved} en home
                        </span>
                      ) : (
                        <span className="text-white/30">Sin aprobadas</span>
                      )}
                      {renewableIds(g.stories).length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            renew(renewableIds(g.stories), `user:${g.user.id}`);
                          }}
                          disabled={renewingId === `user:${g.user.id}`}
                          title="Renovar las historias viejas u ocultas de este perfil"
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          {renewingId === `user:${g.user.id}` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          Renovar {renewableIds(g.stories).length}
                        </button>
                      )}
                    </div>
                  </header>

                  {!isCollapsed && (
                    <div className="border-t border-white/[0.06] px-3 py-3 sm:px-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {g.stories.map((s) => {
                          const src = resolveMediaUrl(s.mediaUrl);
                          return (
                            <div
                              key={s.id}
                              className={`overflow-hidden rounded-xl border bg-[#0c0a14] transition ${
                                s.isHidden
                                  ? "border-white/10 opacity-50"
                                  : s.showInHome
                                    ? "border-fuchsia-400/40 shadow-[0_0_0_1px_rgba(232,121,249,0.15)]"
                                    : "border-white/10"
                              }`}
                            >
                              <div className="relative aspect-[3/4] bg-black/40">
                                {src ? (
                                  s.mediaType === "VIDEO" ? (
                                    <video
                                      src={src}
                                      className="h-full w-full object-cover"
                                      muted
                                      playsInline
                                      preload="metadata"
                                      controls
                                    />
                                  ) : (
                                    <img
                                      src={src}
                                      alt=""
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                    />
                                  )
                                ) : (
                                  <div className="flex h-full items-center justify-center text-xs text-white/30">
                                    sin medio
                                  </div>
                                )}
                                {s.mediaType === "VIDEO" && (
                                  <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/85">
                                    Video
                                  </span>
                                )}
                                {s.expired && (
                                  <span className="absolute left-2 top-2 rounded-full bg-amber-500/80 px-2 py-0.5 text-[9px] font-bold uppercase text-black">
                                    Expirada
                                  </span>
                                )}
                                {s.isHidden && (
                                  <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/75 px-2 py-0.5 text-[9px] font-bold uppercase text-white/85">
                                    <EyeOff className="h-2.5 w-2.5" /> Oculta
                                  </span>
                                )}
                                {s.renewedAt && !s.expired && (
                                  <span className="absolute bottom-2 right-2 rounded-full bg-emerald-500/80 px-2 py-0.5 text-[9px] font-bold uppercase text-black">
                                    Renovada
                                  </span>
                                )}
                              </div>
                              <div className="px-2.5 py-2">
                                <div className="flex items-center justify-between text-[10px] text-white/40">
                                  <span>
                                    {timeAgo(s.createdAt)}
                                    {!s.expired && (
                                      <>
                                        {" · "}
                                        <span className="text-white/30">
                                          {timeUntil(s.expiresAt)}
                                        </span>
                                      </>
                                    )}
                                  </span>
                                  <span className="inline-flex items-center gap-0.5">
                                    <Heart className="h-2.5 w-2.5" />
                                    {s.likeCount}
                                  </span>
                                </div>
                                <button
                                  onClick={() => toggle(s)}
                                  disabled={updatingId === s.id}
                                  className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${
                                    s.showInHome
                                      ? "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200 hover:bg-fuchsia-500/20"
                                      : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
                                  } disabled:opacity-50`}
                                >
                                  {updatingId === s.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : s.showInHome ? (
                                    <CheckCircle2 className="h-3 w-3" />
                                  ) : (
                                    <Circle className="h-3 w-3" />
                                  )}
                                  {s.showInHome ? "En el home" : "Aprobar"}
                                </button>
                                <div className="mt-1.5 flex gap-1.5">
                                  <button
                                    onClick={() => toggleHidden(s)}
                                    disabled={updatingId === s.id}
                                    title={
                                      s.isHidden
                                        ? "Volver a mostrar la historia"
                                        : "Ocultar la historia en toda la app"
                                    }
                                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition disabled:opacity-50 ${
                                      s.isHidden
                                        ? "border-sky-400/40 bg-sky-500/15 text-sky-200 hover:bg-sky-500/20"
                                        : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
                                    }`}
                                  >
                                    {s.isHidden ? (
                                      <Eye className="h-3 w-3" />
                                    ) : (
                                      <EyeOff className="h-3 w-3" />
                                    )}
                                    {s.isHidden ? "Mostrar" : "Ocultar"}
                                  </button>
                                  <button
                                    onClick={() => renew([s.id], s.id)}
                                    disabled={renewingId === s.id}
                                    title="Renovar: vuelve a circular como si fuera nueva"
                                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2 py-1.5 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
                                  >
                                    {renewingId === s.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-3 w-3" />
                                    )}
                                    Renovar
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
