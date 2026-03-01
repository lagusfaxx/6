"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import Avatar from "../../components/Avatar";
import UserLevelBadge from "../../components/UserLevelBadge";
import { Heart, Calendar, MapPin, Clock, Star, LogIn, Sparkles } from "lucide-react";

type Favorite = {
  id: string;
  createdAt: string;
  professional: {
    id: string;
    name: string;
    avatarUrl: string | null;
    rating: number | null;
    category: string | null;
    isActive: boolean;
    userLevel: "SILVER" | "GOLD" | "DIAMOND";
  };
};

type ServiceHistory = {
  id: string;
  createdAt: string;
  updatedAt: string;
  requestedDate: string | null;
  requestedTime: string | null;
  agreedLocation: string | null;
  professionalPriceClp: number | null;
  professionalDurationM: number | null;
  professional: {
    id: string;
    name: string;
    avatarUrl: string | null;
    category: string | null;
    userLevel: "SILVER" | "GOLD" | "DIAMOND";
  };
  review: {
    hearts: number;
    comment: string | null;
    createdAt: string;
  } | null;
};

type FavoritesData = {
  favorites: Favorite[];
  serviceHistory: ServiceHistory[];
};

export default function FavoritesPage() {
  const [data, setData] = useState<FavoritesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [activeTab, setActiveTab] = useState<"favorites" | "history">("favorites");

  useEffect(() => {
    apiFetch<FavoritesData>("/favorites")
      .then((res) => setData(res))
      .catch((err: any) => {
        if (err?.status === 401) {
          setNeedsAuth(true);
          return;
        }
        setError(err?.body?.message || err?.message || "No se pudo cargar favoritos");
      })
      .finally(() => setLoading(false));
  }, []);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="h-24 rounded-3xl bg-white/5 animate-pulse" />
        <div className="h-12 rounded-2xl bg-white/5 animate-pulse" />
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  /* ── Not logged in ── */
  if (needsAuth) {
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] p-8 text-center overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 border border-white/10">
            <Heart className="h-8 w-8 text-fuchsia-300" />
          </div>
          <h1 className="text-xl font-semibold bg-gradient-to-r from-white via-fuchsia-200 to-violet-200 bg-clip-text text-transparent">
            Favoritos e Historial
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Inicia sesión para ver tus favoritos y el historial de servicios.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/login?next=/favoritos"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            >
              <LogIn className="h-4 w-4" />
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-center text-sm text-red-200">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const renderHearts = (count: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Heart
          key={i}
          className={`h-4 w-4 ${
            i <= count ? "fill-red-500 text-red-500" : "text-white/20"
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      {/* Header */}
      <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.25)] p-5 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 border border-white/10">
            <Heart className="h-5 w-5 text-fuchsia-300" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Favoritos e Historial</h1>
            <p className="text-xs text-white/50">
              Tus profesionales favoritos y servicios completados.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        <button
          onClick={() => setActiveTab("favorites")}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            activeTab === "favorites"
              ? "bg-gradient-to-r from-fuchsia-600/20 to-violet-600/20 border border-fuchsia-500/30 text-white"
              : "text-white/50 hover:text-white/70"
          }`}
        >
          <Heart className="mr-1.5 inline h-3.5 w-3.5" />
          Favoritos ({data.favorites.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            activeTab === "history"
              ? "bg-gradient-to-r from-fuchsia-600/20 to-violet-600/20 border border-fuchsia-500/30 text-white"
              : "text-white/50 hover:text-white/70"
          }`}
        >
          <Calendar className="mr-1.5 inline h-3.5 w-3.5" />
          Historial ({data.serviceHistory.length})
        </button>
      </div>

      {/* Favorites Tab */}
      {activeTab === "favorites" && (
        <div className="grid gap-3 md:grid-cols-2">
          {data.favorites.map((fav) => (
            <Link
              key={fav.id}
              href={`/profesional/${fav.professional.id}`}
              className="group relative rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-fuchsia-500/20 hover:bg-white/[0.06] hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3">
                <Avatar src={fav.professional.avatarUrl} alt={fav.professional.name} size={48} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold truncate text-sm">{fav.professional.name}</div>
                    <UserLevelBadge level={fav.professional.userLevel} className="shrink-0" />
                  </div>
                  <div className="text-xs text-white/50 truncate">{fav.professional.category || "Profesional"}</div>
                </div>
                <Heart className="h-5 w-5 shrink-0 fill-fuchsia-500 text-fuchsia-500" />
              </div>
              {fav.professional.rating && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-white/50">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span>{fav.professional.rating.toFixed(1)}</span>
                </div>
              )}
            </Link>
          ))}
          {!data.favorites.length && (
            <div className="col-span-full flex flex-col items-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 to-violet-500/10">
                <Heart className="h-7 w-7 text-white/30" />
              </div>
              <p className="text-sm font-medium text-white/60">No tienes favoritos aún</p>
              <p className="mt-1 text-xs text-white/40">Toca el corazón en el perfil de un profesional para agregarlo.</p>
              <Link
                href="/servicios"
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600/20 to-violet-600/20 border border-fuchsia-500/30 px-4 py-2 text-xs text-fuchsia-200 transition hover:brightness-110"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Explorar servicios
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Service History Tab */}
      {activeTab === "history" && (
        <div className="space-y-3">
          {data.serviceHistory.map((service) => (
            <div
              key={service.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
            >
              <div className="flex items-start gap-3">
                <Avatar
                  src={service.professional.avatarUrl}
                  alt={service.professional.name}
                  size={48}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/profesional/${service.professional.id}`}
                        className="text-sm font-semibold hover:text-fuchsia-400 transition block truncate"
                      >
                        {service.professional.name}
                      </Link>
                      <div className="text-xs text-white/50 mt-0.5 truncate">
                        {service.professional.category}
                      </div>
                      <div className="mt-1">
                        <UserLevelBadge level={service.professional.userLevel} />
                      </div>
                    </div>
                    {service.review && (
                      <div className="shrink-0">{renderHearts(service.review.hearts)}</div>
                    )}
                  </div>

                  <div className="mt-3 grid gap-1.5 text-xs text-white/60">
                    {service.requestedDate && service.requestedTime && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-white/30 shrink-0" />
                        <span>{service.requestedDate} a las {service.requestedTime}</span>
                      </div>
                    )}
                    {service.agreedLocation && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-white/30 shrink-0" />
                        <span className="truncate">{service.agreedLocation}</span>
                      </div>
                    )}
                    {service.professionalDurationM && service.professionalPriceClp && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-white/30 shrink-0" />
                        <span>
                          {service.professionalDurationM} min · ${service.professionalPriceClp.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {service.review?.comment && (
                    <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-white/70 italic">
                      &ldquo;{service.review.comment}&rdquo;
                    </div>
                  )}

                  <div className="mt-3 text-[11px] text-white/35">
                    {(() => {
                      try {
                        return `Completado el ${new Date(service.updatedAt).toLocaleDateString('es-CL')}`;
                      } catch {
                        return `Completado recientemente`;
                      }
                    })()}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {!data.serviceHistory.length && (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 to-violet-500/10">
                <Calendar className="h-7 w-7 text-white/30" />
              </div>
              <p className="text-sm font-medium text-white/60">No tienes servicios completados</p>
              <p className="mt-1 text-xs text-white/40">Una vez que completes un servicio, aparecerá aquí.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
