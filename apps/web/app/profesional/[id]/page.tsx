"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiHttpError, apiFetch, resolveMediaUrl } from "../../../lib/api";
import useMe from "../../../hooks/useMe";

const placeholderGallery = ["/brand/isotipo.png", "/brand/isotipo.png", "/brand/isotipo.png"];

type Professional = {
  id: string;
  name: string;
  avatarUrl: string | null;
  category: string | null;
  isActive: boolean;
  rating: number | null;
  description: string | null;
  isOnline: boolean;
  lastSeen: string | null;
  gallery: { id: string; url: string; type: string }[];
};

export default function ProfessionalDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { me } = useMe();

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    apiFetch<{ professional: Professional }>(`/professionals/${id}`)
      .then((res) => setProfessional(res.professional))
      .catch((err) => {
        if (err instanceof ApiHttpError && err.status === 404) {
          setNotFound(true);
        }
        setProfessional(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleFavorite() {
    if (!professional) return;
    setFavorite((prev) => !prev);
    try {
      if (!favorite) {
        await apiFetch(`/favorites/${professional.id}`, { method: "POST" });
      } else {
        await apiFetch(`/favorites/${professional.id}`, { method: "DELETE" });
      }
    } catch {
      setFavorite((prev) => !prev);
    }
  }

  if (loading) return <div className="text-white/60">Cargando perfil...</div>;
  if (notFound || !professional) return <div className="text-white/60">No encontramos este profesional.</div>;

  const gallery = professional.gallery.length
    ? professional.gallery.map((g) => resolveMediaUrl(g.url) || "")
    : placeholderGallery;

  return (
    <div className="grid gap-6">
      <div className={`card p-6 ${professional.isActive ? "" : "opacity-70 grayscale"}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{professional.name}</h1>
            <div className="mt-1 text-sm text-white/60">
              {professional.category || "Experiencia"} • ⭐ {professional.rating ?? "N/A"}
            </div>
            <div className="mt-2 text-xs text-white/50">
              {professional.isOnline ? "Online" : professional.lastSeen ? `Última vez: ${new Date(professional.lastSeen).toLocaleString("es-CL")}` : "Offline"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleFavorite}
              className={`rounded-full border px-4 py-2 text-sm ${
                favorite ? "border-rose-400 bg-rose-500/20" : "border-white/20 bg-white/5"
              }`}
            >
              {favorite ? "♥ Favorito" : "♡ Favorito"}
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                if (!me?.user) {
                  window.location.href = `/login?next=${encodeURIComponent(`/profesional/${professional.id}`)}`;
                  return;
                }
                window.location.href = `/chat/${professional.id}`;
              }}
            >
              Enviar mensaje
            </button>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold">Galería</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {gallery.map((url, idx) => (
            <div key={`${url}-${idx}`} className="h-40 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <img src={url} alt={`Galería ${idx + 1}`} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold">Descripción</h2>
        <p className="mt-3 text-sm text-white/70">
          {professional.description || "Perfil profesional listo para ayudarte. Envía un mensaje para coordinar."}
        </p>
      </div>
    </div>
  );
}
