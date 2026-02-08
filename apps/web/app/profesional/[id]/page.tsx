"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiHttpError, apiFetch, resolveMediaUrl } from "../../../lib/api";
import useMe from "../../../hooks/useMe";
import Avatar from "../../../components/Avatar";

const placeholderGallery = ["/brand/isotipo.png", "/brand/isotipo.png", "/brand/isotipo.png"];

type Professional = {
  id: string;
  name: string;
  avatarUrl: string | null;
  coverUrl?: string | null;
  category: string | null;
  isActive: boolean;
  rating: number | null;
  description: string | null;
  age?: number | null;
  gender?: string | null;
  serviceSummary?: string | null;
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
  const [activeRequest, setActiveRequest] = useState<{ id: string; status: string } | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const { me } = useMe();

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    apiFetch<{ professional?: Professional } | Professional>(`/professionals/${id}`)
      .then((res) => {
        const payload = (res as { professional?: Professional }).professional ?? (res as Professional);
        setProfessional(payload ?? null);
      })
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
    if (!me?.user) {
      window.location.href = `/login?next=${encodeURIComponent(`/profesional/${professional.id}`)}`;
      return;
    }
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

  useEffect(() => {
    if (!me?.user || me.user.profileType !== "CLIENT" || !professional) return;
    apiFetch<{ services: { id: string; status: string; professional: { id: string } }[] }>("/services/active")
      .then((res) => {
        const match = res.services.find((s) => s.professional.id === professional.id);
        setActiveRequest(match ? { id: match.id, status: match.status } : null);
      })
      .catch(() => setActiveRequest(null));
  }, [me?.user, professional]);

  if (loading) return <div className="text-white/60">Cargando perfil...</div>;
  if (notFound || !professional) return <div className="text-white/60">No encontramos este profesional.</div>;

  const gallery = professional.gallery.length
    ? professional.gallery.map((g) => resolveMediaUrl(g.url)).filter(Boolean) as string[]
    : placeholderGallery;

  const genderLabel =
    professional.gender === "FEMALE"
      ? "Mujer"
      : professional.gender === "MALE"
        ? "Hombre"
        : professional.gender
          ? "Otro"
          : null;

  const canRequest = me?.user?.profileType === "CLIENT";

  return (
    <div className="grid gap-6">
      <div className={`card overflow-hidden p-0 ${professional.isActive ? "" : "opacity-70 grayscale"}`}>
        <div className="relative h-44 w-full bg-white/5 md:h-56">
          {professional.coverUrl ? (
            <img src={resolveMediaUrl(professional.coverUrl) ?? undefined} alt="Portada" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-white/5 via-white/10 to-transparent" />
          )}
          <div className="absolute -bottom-8 left-6">
            <div className="rounded-full border border-white/20 bg-[#120b2a] p-1 shadow-lg">
              <div className="rounded-full border border-white/10 bg-white/5 p-1">
                <div className="rounded-full">
                  <Avatar src={professional.avatarUrl} alt={professional.name} size={96} className="border-white/20" />
                </div>
              </div>
            </div>
          </div>
          <div className="absolute right-6 top-6">
            <span className={`rounded-full px-3 py-1 text-xs ${professional.isOnline ? "bg-emerald-500/20 text-emerald-100" : "bg-white/10 text-white/60"}`}>
              {professional.isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>
        <div className="px-6 pb-6 pt-12">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{professional.name}</h1>
              <div className="mt-1 text-sm text-white/60">
                {professional.category || "Experiencia"} • ⭐ {professional.rating ?? "N/A"}
              </div>
              <div className="mt-2 text-xs text-white/50">
                {professional.isOnline ? "Disponible ahora" : professional.lastSeen ? `Última vez: ${new Date(professional.lastSeen).toLocaleString("es-CL")}` : "Sin actividad reciente"}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/60">
                {professional.age ? <span>{professional.age} años</span> : null}
                {genderLabel ? <span>{genderLabel}</span> : null}
                {professional.serviceSummary ? <span>{professional.serviceSummary}</span> : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={toggleFavorite}
                className={`rounded-full border px-4 py-2 text-sm ${
                  favorite ? "border-rose-400 bg-rose-500/20" : "border-white/20 bg-white/5"
                }`}
              >
                {favorite ? "♥ Favorito" : "♡ Favorito"}
              </button>
              {canRequest && !activeRequest ? (
                <button
                  className="btn-primary"
                  onClick={() => {
                    apiFetch("/services/request", {
                      method: "POST",
                      body: JSON.stringify({ professionalId: professional.id })
                    })
                      .then((res: any) => setActiveRequest(res.request || { id: "pending", status: "PENDIENTE_APROBACION" }))
                      .catch(() => null);
                  }}
                >
                  Solicitar / reservar
                </button>
              ) : null}
              {canRequest && activeRequest ? (
                <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/70">
                  Solicitud {activeRequest.status === "ACTIVO" ? "activa" : "pendiente"}
                </span>
              ) : null}
              <button
                className="btn-secondary"
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
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold">Galería</h2>
        <div className="mt-4 grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {gallery.map((url, idx) => (
            <button
              type="button"
              key={`${url}-${idx}`}
              onClick={() => setLightbox(url)}
              className="group h-40 overflow-hidden rounded-2xl border border-white/10 bg-white/5"
            >
              <img src={url} alt={`Galería ${idx + 1}`} className="h-full w-full object-cover transition group-hover:scale-105" />
            </button>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold">Descripción</h2>
        <p className="mt-3 text-sm text-white/70">
          {professional.description || "Perfil profesional listo para ayudarte. Envía un mensaje para coordinar."}
        </p>
      </div>

      {lightbox ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setLightbox(null)}>
          <div className="max-w-3xl w-full">
            <img src={lightbox} alt="Vista ampliada" className="w-full rounded-2xl border border-white/10 object-cover" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
