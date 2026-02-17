"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ApiHttpError, apiFetch, resolveMediaUrl } from "../../../lib/api";
import useMe from "../../../hooks/useMe";
import Avatar from "../../../components/Avatar";
import StarRating from "../../../components/StarRating";
import GalleryCounter from "../../../components/GalleryCounter";
import SkeletonCard from "../../../components/SkeletonCard";

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
  city?: string | null;
  serviceSummary?: string | null;
  isOnline: boolean;
  lastSeen: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  measurements?: string | null;
  hairColor?: string | null;
  skinTone?: string | null;
  languages?: string | null;
  serviceStyleTags?: string | null;
  availabilityNote?: string | null;
  baseRate?: number | null;
  minDurationMinutes?: number | null;
  acceptsIncalls?: boolean | null;
  acceptsOutcalls?: boolean | null;
  gallery: { id: string; url: string; type: string }[];
};

const placeholderGallery = ["/brand/isotipo.png", "/brand/isotipo.png", "/brand/isotipo.png"];

function splitCsv(value?: string | null) {
  return (value || "").split(",").map((v) => v.trim()).filter(Boolean);
}

export default function ProfileDetailView({ id, username }: { id?: string; username?: string }) {
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const { me } = useMe();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    const load = async () => {
      try {
        let professionalId = id;
        if (!professionalId && username) {
          const profileRes = await apiFetch<{ profile: { id: string } }>(`/profiles/${encodeURIComponent(username)}`);
          professionalId = profileRes.profile?.id;
        }
        if (!professionalId) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const res = await apiFetch<{ professional?: Professional } | Professional>(`/professionals/${professionalId}`);
        const payload = (res as { professional?: Professional }).professional ?? (res as Professional);
        if (!payload) throw new Error("NO_PROFILE");
        if (!cancelled) setProfessional(payload);
      } catch (err) {
        if (!cancelled && err instanceof ApiHttpError && [403, 404].includes(err.status)) {
          setNotFound(true);
        }
        if (!cancelled) setProfessional(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id, username]);

  useEffect(() => {
    if (!professional || me?.user?.profileType !== "VIEWER") {
      setFavorite(false);
      return;
    }
    apiFetch<{ isFavorite: boolean }>(`/favorites/check/${professional.id}`)
      .then((res) => setFavorite(res.isFavorite))
      .catch(() => setFavorite(false));
  }, [me?.user?.profileType, professional]);

  const infoChips = useMemo(() => {
    if (!professional) return [] as string[];
    return [
      professional.heightCm ? `${professional.heightCm} cm` : null,
      professional.weightKg ? `${professional.weightKg} kg` : null,
      professional.measurements || null,
      professional.hairColor ? `Cabello: ${professional.hairColor}` : null,
      professional.skinTone ? `Piel: ${professional.skinTone}` : null,
      ...splitCsv(professional.languages).map((l) => `Idioma: ${l}`),
    ].filter(Boolean) as string[];
  }, [professional]);

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

  if (loading) {
    return <div className="grid gap-6"><SkeletonCard className="h-80" /><SkeletonCard className="h-64" /></div>;
  }
  if (notFound || !professional) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-xl font-semibold">Perfil no disponible</h1>
        <p className="mt-2 text-sm text-white/60">Este perfil no está público o no existe.</p>
      </div>
    );
  }

  const gallery = professional.gallery.length
    ? professional.gallery.map((g) => resolveMediaUrl(g.url)).filter(Boolean) as string[]
    : placeholderGallery;

  return (
    <div className="grid gap-6">
      <div className={`card overflow-hidden p-0 ${professional.isActive ? "" : "opacity-70 grayscale"}`}>
        <div className="relative h-44 w-full bg-white/5 md:h-56">
          {professional.coverUrl ? <img src={resolveMediaUrl(professional.coverUrl) ?? undefined} alt="Portada" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-r from-white/5 via-white/10 to-transparent" />}
          <div className="absolute -bottom-8 left-6"><Avatar src={professional.avatarUrl} alt={professional.name} size={96} className="border-white/20" /></div>
        </div>
        <div className="px-6 pb-6 pt-12">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{professional.name}{professional.age ? `, ${professional.age}` : ""}</h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-white/60"><span>{professional.category || "Perfil"}</span><span>•</span><StarRating rating={professional.rating} size={14} /></div>
              <div className="mt-1 text-xs text-white/60">{professional.isOnline ? "Disponible ahora" : professional.lastSeen ? `Última vez: ${new Date(professional.lastSeen).toLocaleString("es-CL")}` : "Sin actividad reciente"}{professional.city ? ` • ${professional.city}` : ""}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => (window.location.href = `/chat/${professional.id}`)} className="btn-secondary">Enviar mensaje</button>
              <button onClick={() => (window.location.href = `/chats?user=${professional.id}`)} className="btn-primary">Solicitar / Reservar</button>
              <button onClick={toggleFavorite} className={`rounded-full border px-4 py-2 text-sm ${favorite ? "border-rose-400 bg-rose-500/20" : "border-white/20 bg-white/5"}`}>{favorite ? "♥ Favorito" : "♡ Favorito"}</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6"><h2 className="text-lg font-semibold">Información</h2><div className="mt-3 flex flex-wrap gap-2">{infoChips.length ? infoChips.map((chip) => <span key={chip} className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80">{chip}</span>) : <p className="text-sm text-white/60">Información en actualización.</p>}</div></div>
      <div className="card p-6"><h2 className="text-lg font-semibold">Estilo</h2><div className="mt-3 flex flex-wrap gap-2">{splitCsv(professional.serviceStyleTags).length ? splitCsv(professional.serviceStyleTags).map((chip) => <span key={chip} className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80">{chip}</span>) : <p className="text-sm text-white/60">Se informa por chat.</p>}</div></div>
      <div className="card p-6"><h2 className="text-lg font-semibold">Disponibilidad</h2><p className="mt-2 text-sm text-white/70">{professional.availabilityNote || "Coordinar por chat."}</p><div className="mt-3 flex gap-2">{professional.acceptsIncalls ? <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs">Recibe</span> : null}{professional.acceptsOutcalls ? <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs">Se desplaza</span> : null}</div></div>
      <div className="card p-6"><h2 className="text-lg font-semibold">Tarifas</h2><p className="mt-2 text-sm text-white/70">{professional.baseRate ? `$${professional.baseRate.toLocaleString("es-CL")}${professional.minDurationMinutes ? ` / ${professional.minDurationMinutes} min` : ""}` : "Consulta por chat"}</p></div>

      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Galería</h2><GalleryCounter count={gallery.length} /></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">{gallery.map((url, idx) => <motion.button type="button" key={`${url}-${idx}`} onClick={() => setLightbox(url)} className="h-40 overflow-hidden rounded-2xl border border-white/10 bg-white/5"><img src={url} alt={`Galería ${idx + 1}`} className="h-full w-full object-cover" /></motion.button>)}</div>
      </div>

      <div className="card p-6"><h2 className="text-lg font-semibold">Ubicación</h2><p className="mt-2 text-sm text-white/70">{professional.city || "Zona referencial entregada por chat."}</p></div>

      {lightbox ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setLightbox(null)}><div className="max-w-3xl w-full"><img src={lightbox} alt="Vista ampliada" className="w-full rounded-2xl border border-white/10 object-cover" /></div></div> : null}
    </div>
  );
}
