"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ApiHttpError, apiFetch, resolveMediaUrl } from "../../../lib/api";
import { buildChatHref, buildCurrentPathWithSearch, buildLoginHref } from "../../../lib/chat";
import useMe from "../../../hooks/useMe";
import Avatar from "../../../components/Avatar";
import StarRating from "../../../components/StarRating";
import GalleryCounter from "../../../components/GalleryCounter";
import SkeletonCard from "../../../components/SkeletonCard";
import { ImageIcon } from "lucide-react";

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

function splitCsv(value?: string | null) {
  return (value || "").split(",").map((v) => v.trim()).filter(Boolean);
}

function isRecentlySeen(lastSeen?: string | null) {
  if (!lastSeen) return false;
  const parsed = Date.parse(lastSeen);
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed <= 10 * 60 * 1000;
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
    ].filter(Boolean).slice(0, 3) as string[];
  }, [professional]);

  const styleChips = useMemo(() => splitCsv(professional?.serviceStyleTags), [professional?.serviceStyleTags]);
  const availabilityChips = useMemo(() => {
    if (!professional) return [] as string[];
    const chips: string[] = [];
    if (professional.acceptsIncalls) chips.push("Recibe");
    if (professional.acceptsOutcalls) chips.push("Se desplaza");
    return chips;
  }, [professional]);

  const availableNow = useMemo(() => isRecentlySeen(professional?.lastSeen), [professional?.lastSeen]);
  const coverSrc = resolveMediaUrl(professional?.coverUrl) ?? resolveMediaUrl(professional?.avatarUrl);
  const avatarSrc = resolveMediaUrl(professional?.avatarUrl);
  const gallery = useMemo(
    () => (professional?.gallery || []).map((g) => resolveMediaUrl(g.url)).filter((url): url is string => Boolean(url)),
    [professional?.gallery],
  );
  const hasInfoSection = infoChips.length > 0;
  const hasStyleSection = styleChips.length > 0;
  const hasAvailabilitySection = Boolean(professional?.availabilityNote || availabilityChips.length);
  const hasRatesSection = typeof professional?.baseRate === "number";
  const hasLocationSection = Boolean(professional?.city);

  function redirectToLoginIfNeeded() {
    if (me?.user) return false;
    window.location.href = buildLoginHref(buildCurrentPathWithSearch());
    return true;
  }

  function handleChatClick(mode: "message" | "request") {
    if (!professional) return;
    if (redirectToLoginIfNeeded()) return;
    window.location.href = buildChatHref(professional.id, { mode });
  }

  async function toggleFavorite() {
    if (!professional) return;
    if (!me?.user) {
      window.location.href = buildLoginHref(buildCurrentPathWithSearch());
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

  return (
    <div className="grid gap-6">
      <div className={`card overflow-hidden p-0 ${professional.isActive ? "" : "opacity-70 grayscale"}`}>
        <div className="relative w-full overflow-hidden bg-white/5 aspect-[4/5] md:aspect-[16/6]">
          {coverSrc ? (
            <img src={coverSrc} alt="Portada" className="h-full w-full object-cover object-center" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-fuchsia-700/30 via-violet-700/20 to-slate-900">
              <ImageIcon className="h-10 w-10 text-white/50" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
          {availableNow ? (
            <div className="absolute right-3 top-3 rounded-full border border-emerald-300/30 bg-emerald-500/20 px-2 py-1 text-xs text-emerald-100">
              Disponible ahora
            </div>
          ) : null}
        </div>

        <div className="px-4 pb-5 pt-4 md:px-6 md:pb-6 md:pt-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <Avatar
                src={avatarSrc}
                alt={professional.name}
                size={96}
                className="size-[80px] shrink-0 rounded-full border-2 border-white/30 ring-4 ring-black/30 md:size-[108px]"
              />
              <div>
                <h1 className="text-xl font-semibold md:text-2xl">{professional.name}{professional.age ? `, ${professional.age}` : ""}</h1>
                <div className="mt-1 flex items-center gap-2 text-sm text-white/60"><span>{professional.category || "Perfil"}</span><span>•</span><StarRating rating={professional.rating} size={14} /></div>
                <div className="mt-1 text-xs text-white/60">{availableNow ? "Disponible ahora" : professional.lastSeen ? `Última vez: ${new Date(professional.lastSeen).toLocaleString("es-CL")}` : "Sin actividad reciente"}{professional.city ? ` • ${professional.city}` : ""}</div>
              </div>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2 md:min-w-[340px]">
              <button onClick={() => handleChatClick("message")} className="btn-secondary w-full">Enviar mensaje</button>
              <button onClick={() => handleChatClick("request")} className="btn-primary w-full">Solicitar / Reservar</button>
              <button onClick={toggleFavorite} className={`rounded-full border px-4 py-2 text-sm ${favorite ? "border-rose-400 bg-rose-500/20" : "border-white/20 bg-white/5"}`}>{favorite ? "♥ Favorito" : "♡ Favorito"}</button>
            </div>
          </div>
        </div>
      </div>

      {hasInfoSection ? <div className="card p-6"><h2 className="text-lg font-semibold">Información</h2><div className="mt-3 flex flex-wrap gap-2">{infoChips.map((chip) => <span key={chip} className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80">{chip}</span>)}</div></div> : null}
      {hasStyleSection ? <div className="card p-6"><h2 className="text-lg font-semibold">Estilo</h2><div className="mt-3 flex flex-wrap gap-2">{styleChips.map((chip) => <span key={chip} className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80">{chip}</span>)}</div></div> : null}
      {hasAvailabilitySection ? <div className="card p-6"><h2 className="text-lg font-semibold">Disponibilidad</h2>{professional.availabilityNote ? <p className="mt-2 text-sm text-white/70">{professional.availabilityNote}</p> : null}<div className="mt-3 flex gap-2">{availabilityChips.map((chip) => <span key={chip} className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs">{chip}</span>)}</div></div> : null}
      {hasRatesSection ? <div className="card p-6"><h2 className="text-lg font-semibold">Tarifas</h2><p className="mt-2 text-sm text-white/70">{professional.minDurationMinutes ? `$${professional.baseRate?.toLocaleString("es-CL")} / ${professional.minDurationMinutes} min` : `Desde $${professional.baseRate?.toLocaleString("es-CL")}`}</p></div> : null}

      {gallery.length ? <div className="card p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Galería</h2><GalleryCounter count={gallery.length} /></div>
        <div className="-mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-3 xl:grid-cols-4">{gallery.map((url, idx) => <motion.button type="button" key={`${url}-${idx}`} onClick={() => setLightbox(url)} className="aspect-[4/5] w-[78%] shrink-0 snap-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 md:w-auto md:hover:opacity-90"><img src={url} alt={`Galería ${idx + 1}`} className="h-full w-full object-cover" /></motion.button>)}</div>
      </div> : <div className="card p-6 text-sm text-white/60">Sin fotos aún.</div>}

      {hasLocationSection ? <div className="card p-6"><h2 className="text-lg font-semibold">Ubicación</h2><p className="mt-2 text-sm text-white/70">{professional.city ? `Zona aproximada: ${professional.city}` : "Zona referencial"}</p></div> : null}

      {lightbox ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setLightbox(null)}><div className="max-w-3xl w-full"><img src={lightbox} alt="Vista ampliada" className="w-full rounded-2xl border border-white/10 object-cover" /></div></div> : null}
    </div>
  );
}
