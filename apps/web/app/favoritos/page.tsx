"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch, isAuthError } from "../../lib/api";
import Avatar from "../../components/Avatar";
import { Heart, Calendar, MapPin, Clock, Star } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"favorites" | "history">("favorites");
  const router = useRouter();
  const pathname = usePathname() || "/favoritos";

  useEffect(() => {
    apiFetch<FavoritesData>("/favorites")
      .then((res) => setData(res))
      .catch((err: any) => {
        if (isAuthError(err)) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        setError(err?.message || "No se pudo cargar favoritos");
      })
      .finally(() => setLoading(false));
  }, [pathname, router]);

  if (loading) return <div className="text-white/60">Cargando...</div>;
  if (error) return <div className="card p-6 text-red-200 border-red-500/30 bg-red-500/10">{error}</div>;
  if (!data) return <div className="card p-6 text-white/60">No se encontraron datos.</div>;

  const renderHearts = (count: number) => {
    return (
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
  };

  return (
    <div className="grid gap-6">
      <div className="card p-6">
        <h1 className="text-2xl font-semibold">Favoritos e Historial</h1>
        <p className="mt-2 text-sm text-white/70">
          Tus profesionales favoritos y servicios completados.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setActiveTab("favorites")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "favorites"
              ? "border-b-2 border-fuchsia-500 text-white"
              : "text-white/60 hover:text-white/80"
          }`}
        >
          Favoritos ({data.favorites.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "history"
              ? "border-b-2 border-fuchsia-500 text-white"
              : "text-white/60 hover:text-white/80"
          }`}
        >
          Historial ({data.serviceHistory.length})
        </button>
      </div>

      {/* Favorites Tab */}
      {activeTab === "favorites" && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.favorites.map((fav) => (
            <Link
              key={fav.id}
              href={`/profesional/${fav.professional.id}`}
              className={`rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-white/30 ${
                fav.professional.isActive ? "" : "opacity-60 grayscale"
              }`}
            >
              <div className="flex items-center gap-4">
                <Avatar src={fav.professional.avatarUrl} alt={fav.professional.name} size={48} />
                <div className="flex-1">
                  <div className="font-semibold">{fav.professional.name}</div>
                  <div className="text-xs text-white/60">{fav.professional.category || "Profesional"}</div>
                </div>
                <Heart className="h-5 w-5 fill-red-500 text-red-500" />
              </div>
              {fav.professional.rating && (
                <div className="mt-3 flex items-center gap-2 text-xs text-white/60">
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                  <span>{fav.professional.rating.toFixed(1)}</span>
                </div>
              )}
            </Link>
          ))}
          {!data.favorites.length && (
            <div className="col-span-full card p-6 text-center text-white/60">
              <Heart className="mx-auto h-12 w-12 text-white/20" />
              <p className="mt-3">No tienes favoritos aún.</p>
              <p className="mt-1 text-sm">Toca el corazón en el perfil de un profesional para agregarlo.</p>
            </div>
          )}
        </div>
      )}

      {/* Service History Tab */}
      {activeTab === "history" && (
        <div className="grid gap-4">
          {data.serviceHistory.map((service) => (
            <div
              key={service.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <div className="flex items-start gap-4">
                <Avatar 
                  src={service.professional.avatarUrl} 
                  alt={service.professional.name} 
                  size={48} 
                />
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <Link
                        href={`/profesional/${service.professional.id}`}
                        className="font-semibold hover:text-fuchsia-400 transition"
                      >
                        {service.professional.name}
                      </Link>
                      <div className="text-xs text-white/60 mt-0.5">
                        {service.professional.category}
                      </div>
                    </div>
                    {service.review && (
                      <div className="flex flex-col items-end gap-1">
                        {renderHearts(service.review.hearts)}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-white/70">
                    {service.requestedDate && service.requestedTime && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-white/40" />
                        <span>{service.requestedDate} a las {service.requestedTime}</span>
                      </div>
                    )}
                    {service.agreedLocation && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-white/40" />
                        <span>{service.agreedLocation}</span>
                      </div>
                    )}
                    {service.professionalDurationM && service.professionalPriceClp && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-white/40" />
                        <span>
                          {service.professionalDurationM} min · ${service.professionalPriceClp.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {service.review?.comment && (
                    <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/80">
                      "{service.review.comment}"
                    </div>
                  )}

                  <div className="mt-3 text-xs text-white/40">
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
            <div className="card p-6 text-center text-white/60">
              <Calendar className="mx-auto h-12 w-12 text-white/20" />
              <p className="mt-3">No tienes servicios completados aún.</p>
              <p className="mt-1 text-sm">Una vez que completes un servicio, aparecerá aquí.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
