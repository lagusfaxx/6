"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch, isAuthError } from "../../lib/api";
import Avatar from "../../components/Avatar";

type Favorite = {
  id: string;
  professional: {
    id: string;
    name: string;
    avatarUrl: string | null;
    rating: number | null;
    category: string | null;
    isActive: boolean;
  };
};

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname() || "/favoritos";

  useEffect(() => {
    apiFetch<{ favorites: Favorite[] }>("/favorites")
      .then((res) => setFavorites(res.favorites))
      .catch((err: any) => {
        if (isAuthError(err)) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        setError(err?.message || "No se pudo cargar favoritos");
      })
      .finally(() => setLoading(false));
  }, [pathname, router]);

  if (loading) return <div className="text-white/60">Cargando favoritos...</div>;
  if (error) return <div className="card p-6 text-red-200 border-red-500/30 bg-red-500/10">{error}</div>;

  return (
    <div className="grid gap-6">
      <div className="card p-6">
        <h1 className="text-2xl font-semibold">Favoritos</h1>
        <p className="mt-2 text-sm text-white/70">Guarda profesionales para contactarlos rápido.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {favorites.map((fav) => (
          <Link
            key={fav.id}
            href={`/profesional/${fav.professional.id}`}
            className={`rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-white/30 ${
              fav.professional.isActive ? "" : "opacity-60 grayscale"
            }`}
          >
            <div className="flex items-center gap-4">
              <Avatar src={fav.professional.avatarUrl} alt={fav.professional.name} size={48} />
              <div>
                <div className="font-semibold">{fav.professional.name}</div>
                <div className="text-xs text-white/60">{fav.professional.category || "Experiencia"}</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-white/60">⭐ {fav.professional.rating ?? "N/A"}</div>
          </Link>
        ))}
        {!favorites.length ? <div className="card p-6 text-white/60">No tienes favoritos aún.</div> : null}
      </div>
    </div>
  );
}
