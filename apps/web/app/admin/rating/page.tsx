"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import useMe from "../../../hooks/useMe";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import Avatar from "../../../components/Avatar";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Crown,
  Eye,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
  Filter,
  BarChart3,
  Image as ImageIcon,
} from "lucide-react";

/* ─── Types ─── */

type ProfileMedia = { id: string; url: string; type: string };

type ExistingRating = {
  ratingPhotoQuality: number;
  ratingCompleteness: number;
  ratingPresentation: number;
  ratingAuthenticity: number;
  ratingValue: number;
  overallScore: number;
  notes: string | null;
  updatedAt: string;
};

type QueueProfile = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  profileType: string;
  city: string | null;
  tier: string | null;
  bio: string | null;
  isVerified: boolean;
  profileTags: string[];
  serviceTags: string[];
  profileViews: number;
  completedServices: number;
  adminQualityScore: number | null;
  createdAt: string;
  profileMedia: ProfileMedia[];
  existingRating: ExistingRating | null;
};

type RatingStats = {
  totalRated: number;
  totalProfiles: number;
  unratedByType: Record<string, number>;
  avgScore: number;
  recentlyRated: any[];
};

const PROFILE_TYPES = [
  { value: "", label: "Todos" },
  { value: "PROFESSIONAL", label: "Profesional" },
  { value: "ESTABLISHMENT", label: "Establecimiento" },
  { value: "SHOP", label: "Tienda" },
];

const RATING_DIMENSIONS = [
  { key: "ratingPhotoQuality", label: "Calidad de fotos", icon: ImageIcon },
  { key: "ratingCompleteness", label: "Completitud del perfil", icon: Users },
  { key: "ratingPresentation", label: "Presentacion del anuncio", icon: Sparkles },
  { key: "ratingAuthenticity", label: "Autenticidad", icon: ShieldCheck },
  { key: "ratingValue", label: "Propuesta de valor", icon: Star },
] as const;

type RatingKey = (typeof RATING_DIMENSIONS)[number]["key"];

const BATCH_SIZE = 20;

export default function AdminRatingPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const isAdmin = useMemo(() => (user?.role ?? "").toUpperCase() === "ADMIN", [user?.role]);

  // Queue state
  const [profiles, setProfiles] = useState<QueueProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [profileTypeFilter, setProfileTypeFilter] = useState("");
  const [unratedOnly, setUnratedOnly] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Rating form
  const [ratings, setRatings] = useState<Record<RatingKey, number>>({
    ratingPhotoQuality: 5,
    ratingCompleteness: 5,
    ratingPresentation: 5,
    ratingAuthenticity: 5,
    ratingValue: 5,
  });
  const [notes, setNotes] = useState("");

  // Stats
  const [stats, setStats] = useState<RatingStats | null>(null);

  // Photo gallery
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Swipe direction for animation
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);

  const currentProfile = profiles[currentIndex] ?? null;
  const overallScore = useMemo(() => {
    const values = Object.values(ratings);
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  }, [ratings]);

  const loadStats = useCallback(async () => {
    try {
      const res = await apiFetch<RatingStats>("/admin/rating/stats");
      if (res) setStats(res);
    } catch { /* ignore */ }
  }, []);

  const loadQueue = useCallback(async () => {
    setError(null);
    setLoadingQueue(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(BATCH_SIZE));
      params.set("offset", "0");
      if (profileTypeFilter) params.set("profileType", profileTypeFilter);
      if (unratedOnly) params.set("unratedOnly", "true");

      const res = await apiFetch<{ profiles: QueueProfile[]; total: number }>(`/admin/rating/queue?${params}`);
      setProfiles(res?.profiles ?? []);
      setTotal(res?.total ?? 0);
      setCurrentIndex(0);
      setActivePhotoIndex(0);
    } catch {
      setError("No se pudo cargar la cola de perfiles.");
    } finally {
      setLoadingQueue(false);
    }
  }, [profileTypeFilter, unratedOnly]);

  useEffect(() => {
    if (!loading && isAdmin) {
      loadQueue();
      loadStats();
    }
  }, [loading, isAdmin, loadQueue, loadStats]);

  // Pre-fill ratings if profile already has a rating
  useEffect(() => {
    if (currentProfile?.existingRating) {
      const r = currentProfile.existingRating;
      setRatings({
        ratingPhotoQuality: r.ratingPhotoQuality,
        ratingCompleteness: r.ratingCompleteness,
        ratingPresentation: r.ratingPresentation,
        ratingAuthenticity: r.ratingAuthenticity,
        ratingValue: r.ratingValue,
      });
      setNotes(r.notes || "");
    } else {
      setRatings({ ratingPhotoQuality: 5, ratingCompleteness: 5, ratingPresentation: 5, ratingAuthenticity: 5, ratingValue: 5 });
      setNotes("");
    }
    setActivePhotoIndex(0);
  }, [currentProfile?.id]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  async function submitRating() {
    if (!currentProfile || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/admin/rating/${currentProfile.id}`, {
        method: "POST",
        body: JSON.stringify({ ...ratings, notes: notes || null }),
      });
      setSuccess(`${currentProfile.displayName || currentProfile.username} calificado: ${overallScore}/10`);
      setSwipeDirection("right");
      setTimeout(() => {
        goToNext();
        setSwipeDirection(null);
        loadStats();
      }, 300);
    } catch {
      setError("No se pudo enviar la calificacion.");
    } finally {
      setSubmitting(false);
    }
  }

  function skip() {
    setSwipeDirection("left");
    setTimeout(() => {
      goToNext();
      setSwipeDirection(null);
    }, 300);
  }

  function goToNext() {
    if (currentIndex < profiles.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      // Reload queue
      loadQueue();
    }
  }

  function goToPrev() {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }

  function setRating(key: RatingKey, value: number) {
    setRatings((prev) => ({ ...prev, [key]: value }));
  }

  function scoreColor(score: number): string {
    if (score >= 7) return "text-emerald-400";
    if (score >= 5) return "text-amber-400";
    return "text-red-400";
  }

  function scoreBg(score: number): string {
    if (score >= 7) return "bg-emerald-500";
    if (score >= 5) return "bg-amber-500";
    return "bg-red-500";
  }

  if (loading) return <div className="p-6 text-white/70">Cargando...</div>;
  if (!user) return <div className="p-6 text-white/70">Debes iniciar sesion.</div>;
  if (!isAdmin) return <div className="p-6 text-white/70">Acceso restringido.</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/10 transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-400" />
              Catador de Perfiles
            </h1>
            <p className="text-xs text-white/40">{total} perfil{total !== 1 ? "es" : ""} en cola</p>
          </div>
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white/70 hover:bg-white/10 transition">
          <Filter className="h-3.5 w-3.5" />
          Filtros
        </button>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-center">
            <p className="text-lg font-bold text-fuchsia-400">{stats.totalRated}</p>
            <p className="text-[11px] text-white/40">Calificados</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-center">
            <p className="text-lg font-bold text-amber-400">{stats.totalProfiles - stats.totalRated}</p>
            <p className="text-[11px] text-white/40">Pendientes</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-center">
            <p className={`text-lg font-bold ${scoreColor(stats.avgScore)}`}>{stats.avgScore ? stats.avgScore.toFixed(1) : "—"}</p>
            <p className="text-[11px] text-white/40">Score promedio</p>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
          <select
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm outline-none"
            value={profileTypeFilter}
            onChange={(e) => { setProfileTypeFilter(e.target.value); }}
          >
            {PROFILE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
            <input
              type="checkbox"
              checked={unratedOnly}
              onChange={(e) => setUnratedOnly(e.target.checked)}
              className="accent-fuchsia-500"
            />
            Solo sin calificar
          </label>
          <button onClick={() => loadQueue()} className="ml-auto rounded-lg bg-fuchsia-600/20 border border-fuchsia-500/30 px-3 py-1.5 text-xs text-fuchsia-300 hover:bg-fuchsia-600/30 transition">
            Aplicar
          </button>
        </div>
      )}

      {/* Feedback messages */}
      {error && (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-200 flex items-center gap-2">
          <X className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0" /> {success}
        </div>
      )}

      {/* Main card area */}
      {loadingQueue ? (
        <div className="mt-12 flex flex-col items-center gap-3 text-white/40">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Cargando perfiles...</p>
        </div>
      ) : profiles.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-3 text-white/40">
          <Star className="h-12 w-12" />
          <p className="text-sm">No hay perfiles en la cola</p>
          <button onClick={() => { setUnratedOnly(false); loadQueue(); }} className="rounded-lg bg-fuchsia-600/20 border border-fuchsia-500/30 px-4 py-2 text-xs text-fuchsia-300 hover:bg-fuchsia-600/30 transition">
            Mostrar todos los perfiles
          </button>
        </div>
      ) : currentProfile ? (
        <div className="mt-6">
          {/* Progress */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-white/40">{currentIndex + 1} de {profiles.length}</p>
            <div className="flex-1 mx-4 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500 rounded-full transition-all duration-300" style={{ width: `${((currentIndex + 1) / profiles.length) * 100}%` }} />
            </div>
            {currentProfile.existingRating && <span className="text-[11px] text-amber-400">Ya calificado</span>}
          </div>

          {/* Swipeable card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentProfile.id}
              initial={{ opacity: 0, x: swipeDirection === "left" ? 100 : swipeDirection === "right" ? -100 : 0, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: swipeDirection === "left" ? -300 : swipeDirection === "right" ? 300 : 0, scale: 0.9, rotate: swipeDirection === "right" ? 8 : swipeDirection === "left" ? -8 : 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={(_e, info) => {
                if (info.offset.x > 120) submitRating();
                else if (info.offset.x < -120) skip();
              }}
              className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] overflow-hidden"
            >
              {/* Cover / Photo gallery */}
              <div className="relative">
                {currentProfile.profileMedia.length > 0 ? (
                  <div className="relative h-72 sm:h-80 overflow-hidden bg-black/30">
                    <img
                      src={resolveMediaUrl(currentProfile.profileMedia[activePhotoIndex]?.url || currentProfile.coverUrl || "")}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    {/* Photo nav dots */}
                    {currentProfile.profileMedia.length > 1 && (
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {currentProfile.profileMedia.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setActivePhotoIndex(i)}
                            className={`h-1.5 rounded-full transition-all ${i === activePhotoIndex ? "w-6 bg-white" : "w-1.5 bg-white/40"}`}
                          />
                        ))}
                      </div>
                    )}
                    {/* Photo nav arrows */}
                    {currentProfile.profileMedia.length > 1 && (
                      <>
                        <button onClick={() => setActivePhotoIndex((i) => Math.max(0, i - 1))} className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full bg-black/40 text-white/80 hover:bg-black/60 transition">
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button onClick={() => setActivePhotoIndex((i) => Math.min(currentProfile.profileMedia.length - 1, i + 1))} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full bg-black/40 text-white/80 hover:bg-black/60 transition">
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {/* Swipe hint overlays */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-between px-6">
                      <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1 text-red-400 font-bold text-lg">
                        <ThumbsDown className="h-6 w-6" /> SALTAR
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1 text-emerald-400 font-bold text-lg">
                        CALIFICAR <ThumbsUp className="h-6 w-6" />
                      </div>
                    </div>
                  </div>
                ) : currentProfile.coverUrl ? (
                  <div className="h-48 overflow-hidden bg-black/30">
                    <img src={resolveMediaUrl(currentProfile.coverUrl)} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-36 bg-gradient-to-br from-fuchsia-900/30 to-purple-900/30 flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-white/20" />
                  </div>
                )}

                {/* Tier badge */}
                {currentProfile.tier && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-xs font-bold backdrop-blur-sm">
                    <Crown className="h-3 w-3 text-amber-400" />
                    <span className="text-amber-300">{currentProfile.tier}</span>
                  </div>
                )}
              </div>

              {/* Profile info */}
              <div className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <Avatar url={currentProfile.avatarUrl} name={currentProfile.displayName || currentProfile.username} size="lg" />
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-lg truncate">{currentProfile.displayName || currentProfile.username}</h2>
                    <p className="text-xs text-white/40">@{currentProfile.username}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/50">
                      {currentProfile.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{currentProfile.city}</span>}
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{currentProfile.profileViews} visitas</span>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px]">{currentProfile.profileType}</span>
                    </div>
                  </div>
                  {currentProfile.adminQualityScore !== null && (
                    <div className={`flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-sm font-bold ${scoreColor(currentProfile.adminQualityScore)}`}>
                      <Star className="h-3.5 w-3.5" />
                      {currentProfile.adminQualityScore.toFixed(1)}
                    </div>
                  )}
                </div>

                {/* Bio */}
                {currentProfile.bio && (
                  <p className="mt-3 text-sm text-white/50 line-clamp-3">{currentProfile.bio}</p>
                )}

                {/* Tags */}
                {(currentProfile.profileTags.length > 0 || currentProfile.serviceTags.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {currentProfile.profileTags.map((t) => (
                      <span key={t} className="rounded-md bg-fuchsia-500/10 border border-fuchsia-500/20 px-2 py-0.5 text-[10px] text-fuchsia-300">{t}</span>
                    ))}
                    {currentProfile.serviceTags.map((t) => (
                      <span key={t} className="rounded-md bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[10px] text-violet-300">{t}</span>
                    ))}
                  </div>
                )}

                {/* Badges */}
                <div className="mt-3 flex items-center gap-2">
                  {currentProfile.isVerified && (
                    <span className="flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
                      <ShieldCheck className="h-3 w-3" /> Verificada
                    </span>
                  )}
                  <a
                    href={`/profesional/${currentProfile.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] text-blue-300 hover:bg-blue-500/20 transition"
                  >
                    <Eye className="h-3 w-3" /> Ver perfil
                  </a>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-white/[0.06]" />

              {/* Rating sliders */}
              <div className="px-5 py-4 space-y-4">
                <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-fuchsia-400" />
                  Calificacion
                  <span className={`ml-auto text-lg font-bold ${scoreColor(overallScore)}`}>{overallScore}/10</span>
                </h3>

                {RATING_DIMENSIONS.map(({ key, label, icon: Icon }) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="flex items-center gap-1.5 text-xs text-white/50">
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </label>
                      <span className={`text-xs font-bold ${scoreColor(ratings[key])}`}>{ratings[key]}</span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={ratings[key]}
                        onChange={(e) => setRating(key, Number(e.target.value))}
                        className="w-full h-1.5 appearance-none rounded-full bg-white/[0.08] outline-none cursor-pointer
                          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fuchsia-500 [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(217,70,239,0.5)] [&::-webkit-slider-thumb]:transition
                          [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-fuchsia-500 [&::-moz-range-thumb]:border-0"
                      />
                      {/* Score bar fill */}
                      <div
                        className={`absolute top-0 left-0 h-1.5 rounded-full pointer-events-none ${scoreBg(ratings[key])}`}
                        style={{ width: `${((ratings[key] - 1) / 9) * 100}%`, opacity: 0.4 }}
                      />
                    </div>
                  </div>
                ))}

                {/* Notes */}
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Notas internas (opcional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Comentarios internos sobre el perfil..."
                    rows={2}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-fuchsia-500/30 transition placeholder:text-white/20 resize-none"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="px-5 pb-5 flex items-center gap-3">
                <button
                  onClick={skip}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-3 text-sm font-medium text-white/60 hover:bg-white/[0.08] hover:text-red-300 transition disabled:opacity-50"
                >
                  <ThumbsDown className="h-4 w-4" />
                  Saltar
                </button>
                <button
                  onClick={submitRating}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 py-3 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/20 hover:shadow-fuchsia-500/40 transition disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                  Calificar
                </button>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={goToPrev}
              disabled={currentIndex === 0}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/50 hover:bg-white/[0.08] transition disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Anterior
            </button>
            <p className="text-xs text-white/30">
              Desliza <span className="text-emerald-400">derecha</span> para calificar, <span className="text-red-400">izquierda</span> para saltar
            </p>
            <button
              onClick={goToNext}
              disabled={currentIndex >= profiles.length - 1}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/50 hover:bg-white/[0.08] transition disabled:opacity-30"
            >
              Siguiente <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
