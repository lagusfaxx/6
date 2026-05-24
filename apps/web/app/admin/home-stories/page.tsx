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
  Clock,
  Heart,
  Filter,
} from "lucide-react";

type HomeStory = {
  id: string;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO";
  showInHome: boolean;
  createdAt: string;
  expiresAt: string;
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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "expirada";
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function AdminHomeStoriesPage() {
  const { me, loading: meLoading } = useMe();
  const isAdmin = (me?.user?.role ?? "").toUpperCase() === "ADMIN";

  const [filter, setFilter] = useState<FilterMode>("all");
  const [stories, setStories] = useState<HomeStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = (mode: FilterMode) => {
    setLoading(true);
    setError(null);
    apiFetch<{ stories: HomeStory[] }>(
      `/admin/home-stories?filter=${mode}`,
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
    load(filter);
  }, [isAdmin, filter]);

  const approvedCount = useMemo(
    () => stories.filter((s) => s.showInHome).length,
    [stories],
  );

  async function toggle(story: HomeStory) {
    const next = !story.showInHome;
    setUpdatingId(story.id);
    // Optimistic update
    setStories((prev) =>
      prev.map((s) => (s.id === story.id ? { ...s, showInHome: next } : s)),
    );
    try {
      await apiFetch(`/admin/home-stories/${story.id}`, {
        method: "PATCH",
        body: JSON.stringify({ showInHome: next }),
      });
    } catch (e: any) {
      // Revert on failure
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
              Marca qué historias rotan en las tarjetas de Destacadas. Solo
              las aprobadas se reproducen sobre la foto de portada.
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-200">
            <span className="font-semibold text-amber-300">
              {approvedCount}
            </span>{" "}
            aprobadas de {stories.length} visibles
          </div>
        </div>

        {/* Filter */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-white/40">
            <Filter className="h-3 w-3" /> Filtro:
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

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-12 flex justify-center text-white/40">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : stories.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/55">
            No hay historias{" "}
            {filter === "approved"
              ? "aprobadas"
              : filter === "pending"
                ? "por revisar"
                : "activas"}{" "}
            por ahora.
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {stories.map((s) => {
              const src = resolveMediaUrl(s.mediaUrl);
              return (
                <div
                  key={s.id}
                  className={`overflow-hidden rounded-2xl border bg-[#0c0a14] transition ${
                    s.showInHome
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
                          alt={s.user.displayName}
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
                      <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/85">
                        Video
                      </span>
                    )}
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="truncate text-sm font-semibold">
                      {s.user.displayName}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                      <span>@{s.user.username}</span>
                      {s.user.tier && (
                        <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-white/55">
                          {s.user.tier}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-white/35">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {timeAgo(s.createdAt)} · expira en {timeUntil(s.expiresAt)}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Heart className="h-3 w-3" /> {s.likeCount}
                      </span>
                    </div>
                    <button
                      onClick={() => toggle(s)}
                      disabled={updatingId === s.id}
                      className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                        s.showInHome
                          ? "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200 hover:bg-fuchsia-500/20"
                          : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
                      } disabled:opacity-50`}
                    >
                      {updatingId === s.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : s.showInHome ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Circle className="h-3.5 w-3.5" />
                      )}
                      {s.showInHome ? "En el home" : "Aprobar para home"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
