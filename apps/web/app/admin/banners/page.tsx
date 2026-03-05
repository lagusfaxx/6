"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import {
  ArrowLeft,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
  Plus,
  X,
  Loader2,
  RefreshCw,
  Video,
} from "lucide-react";

type Banner = {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string | null;
  position: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
};

type AdminProfile = {
  id: string;
  displayName?: string | null;
  username?: string | null;
  city?: string | null;
};

type ProfileVideo = { id: string; url: string; type: "VIDEO"; createdAt: string };

function extractProfileId(linkUrl?: string | null) {
  if (!linkUrl) return null;
  if (linkUrl.startsWith("profile:")) return linkUrl.slice("profile:".length);
  return null;
}

export default function AdminBannersPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const isAdmin = useMemo(() => (user?.role ?? "").toUpperCase() === "ADMIN", [user?.role]);

  const [items, setItems] = useState<Banner[]>([]);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [position, setPosition] = useState("INLINE");
  const [sortOrder, setSortOrder] = useState("0");
  const [videos, setVideos] = useState<ProfileVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  async function loadBanners() {
    setError(null);
    try {
      const res = await apiFetch<{ banners: Banner[] }>("/admin/banners");
      setItems(res?.banners ?? []);
    } catch {
      setError("No se pudieron cargar banners.");
    }
  }

  async function loadProfiles() {
    try {
      const res = await apiFetch<{ profiles: AdminProfile[] }>("/admin/profiles?isActive=true&profileType=PROFESSIONAL&limit=200");
      const rows = res?.profiles ?? [];
      setProfiles(rows);
      if (rows.length > 0 && !selectedProfileId) setSelectedProfileId(rows[0].id);
    } catch {
      setError("No se pudieron cargar perfiles.");
    }
  }

  async function loadVideos(profileId: string) {
    if (!profileId) {
      setVideos([]);
      setSelectedVideoId("");
      return;
    }
    try {
      const res = await apiFetch<{ media: ProfileVideo[] }>(`/admin/profiles/${profileId}/media-videos`);
      const list = res?.media ?? [];
      setVideos(list);
      setSelectedVideoId(list[0]?.id || "");
    } catch {
      setVideos([]);
      setSelectedVideoId("");
      setError("No se pudieron cargar videos del perfil.");
    }
  }

  useEffect(() => {
    if (!loading && isAdmin) {
      loadBanners();
      loadProfiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAdmin]);

  useEffect(() => {
    loadVideos(selectedProfileId);
  }, [selectedProfileId]);

  async function create() {
    if (!selectedProfileId || !selectedVideoId) {
      setError("Debes elegir perfil y video.");
      return;
    }
    const profile = profiles.find((p) => p.id === selectedProfileId);
    const video = videos.find((v) => v.id === selectedVideoId);
    if (!profile || !video) {
      setError("Perfil o video inválido.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch("/admin/banners", {
        method: "POST",
        body: JSON.stringify({
          title: `Anuncio video · ${profile.displayName || profile.username || "Perfil"}`,
          imageUrl: video.url,
          linkUrl: `profile:${profile.id}`,
          position,
          sortOrder: parseInt(sortOrder || "0", 10) || 0,
          isActive: true,
        }),
      });

      setPosition("INLINE");
      setSortOrder("0");
      setShowCreate(false);
      setSuccess("Banner de video creado.");
      await loadBanners();
    } catch {
      setError("No se pudo crear el banner.");
    } finally {
      setBusy(false);
    }
  }

  async function replaceProfile(banner: Banner, profileId: string) {
    setBusy(true);
    setError(null);
    try {
      const profile = profiles.find((p) => p.id === profileId);
      if (!profile) throw new Error("BAD_PROFILE");
      const res = await apiFetch<{ media: ProfileVideo[] }>(`/admin/profiles/${profileId}/media-videos`);
      const latest = res?.media?.[0];
      if (!latest) {
        setError("Ese perfil no tiene videos para anuncios.");
        return;
      }

      await apiFetch(`/admin/banners/${banner.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: `Anuncio video · ${profile.displayName || profile.username || "Perfil"}`,
          imageUrl: latest.url,
          linkUrl: `profile:${profile.id}`,
        }),
      });
      setSuccess("Perfil/video del banner actualizado.");
      await loadBanners();
    } catch {
      setError("No se pudo actualizar el banner con video del perfil.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(b: Banner) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/banners/${b.id}`, { method: "PUT", body: JSON.stringify({ isActive: !b.isActive }) });
      setSuccess(`Banner ${b.isActive ? "desactivado" : "activado"}.`);
      await loadBanners();
    } catch {
      setError("No se pudo actualizar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este banner permanentemente?")) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/banners/${id}`, { method: "DELETE" });
      setSuccess("Banner eliminado.");
      await loadBanners();
    } catch {
      setError("No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(t);
  }, [success]);

  if (loading) return <div className="p-6 text-white/70">Cargando...</div>;
  if (!user) return <div className="p-6 text-white/70">Debes iniciar sesión.</div>;
  if (!isAdmin) return <div className="p-6 text-white/70">Acceso restringido.</div>;

  const activeBanners = items.filter((b) => b.isActive);
  const inactiveBanners = items.filter((b) => !b.isActive);
  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) || null;
  const selectedVideo = videos.find((v) => v.id === selectedVideoId) || null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/10 transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Banners de video (profesionales)</h1>
            <p className="text-xs text-white/40">{items.length} banner{items.length !== 1 ? "s" : ""} · {activeBanners.length} activo{activeBanners.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button onClick={() => setShowCreate((v) => !v)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2.5 text-sm font-semibold transition hover:brightness-110">
          <Plus className="h-4 w-4" /> Nuevo banner
        </button>
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      {success && (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 flex items-center justify-between">
          {success}
          <button onClick={() => setSuccess(null)} className="text-emerald-300 hover:text-emerald-100"><X className="h-4 w-4" /></button>
        </div>
      )}

      {showCreate && (
        <div className="mt-4 rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/[0.05] to-violet-500/[0.03] p-5">
          <h2 className="text-lg font-semibold mb-4">Crear anuncio de video</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <select className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm" value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.displayName || p.username || p.id}</option>
              ))}
            </select>
            <select className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm" value={selectedVideoId} onChange={(e) => setSelectedVideoId(e.target.value)}>
              <option value="">Selecciona video del perfil</option>
              {videos.map((v, idx) => (
                <option key={v.id} value={v.id}>Video #{videos.length - idx}</option>
              ))}
            </select>
            <select className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm" value={position} onChange={(e) => setPosition(e.target.value)}>
              <option value="INLINE">Inline (home)</option>
              <option value="HORIZONTAL">Horizontal</option>
              <option value="LEFT">Lateral izquierdo</option>
              <option value="RIGHT">Lateral derecho</option>
              <option value="VERTICAL">Vertical</option>
            </select>
            <input className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="Orden" />
          </div>

          <button type="button" onClick={loadProfiles} className="mt-3 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80 flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Actualizar perfiles
          </button>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-2 text-xs font-medium text-white/60">Previsualización anuncio video 200 × 400</div>
            <div className="mx-auto h-[400px] w-[200px] overflow-hidden rounded-xl border border-white/10 bg-black/40">
              {selectedProfile && selectedVideo ? (
                <ProfileVideoBannerPreview profile={selectedProfile} videoUrl={selectedVideo.url} />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-white/40">Selecciona perfil y video</div>
              )}
            </div>
          </div>

          <button disabled={busy || !selectedProfileId || !selectedVideoId} onClick={create} className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear anuncio
          </button>
        </div>
      )}

      {activeBanners.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/70"><Eye className="h-4 w-4 text-emerald-400" /> Activos ({activeBanners.length})</h3>
          <div className="space-y-3">
            {activeBanners.map((b) => <BannerCard key={b.id} banner={b} busy={busy} profiles={profiles} onToggle={toggle} onRemove={remove} onReplaceProfile={replaceProfile} />)}
          </div>
        </div>
      )}

      {inactiveBanners.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/70"><EyeOff className="h-4 w-4 text-white/30" /> Desactivados ({inactiveBanners.length})</h3>
          <div className="space-y-3">
            {inactiveBanners.map((b) => <BannerCard key={b.id} banner={b} busy={busy} profiles={profiles} onToggle={toggle} onRemove={remove} onReplaceProfile={replaceProfile} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileVideoBannerPreview({ profile, videoUrl }: { profile: AdminProfile; videoUrl: string }) {
  const src = resolveMediaUrl(videoUrl) || videoUrl;
  return (
    <div className="relative h-full w-full">
      <video src={src} className="h-full w-full object-cover" autoPlay muted loop playsInline />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <div className="absolute left-3 right-3 bottom-3 rounded-lg border border-white/20 bg-black/50 p-2">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-fuchsia-300" />
          <p className="truncate text-[11px] font-semibold text-white">Anuncio de video</p>
        </div>
        <p className="mt-1 truncate text-xs text-white">{profile.displayName || profile.username || "Perfil"}</p>
      </div>
    </div>
  );
}

function BannerCard({
  banner,
  busy,
  profiles,
  onToggle,
  onRemove,
  onReplaceProfile,
}: {
  banner: Banner;
  busy: boolean;
  profiles: AdminProfile[];
  onToggle: (b: Banner) => void;
  onRemove: (id: string) => void;
  onReplaceProfile: (banner: Banner, profileId: string) => void;
}) {
  const [nextProfileId, setNextProfileId] = useState(extractProfileId(banner.linkUrl) || "");
  const mediaSrc = resolveMediaUrl(banner.imageUrl) ?? banner.imageUrl;

  return (
    <div className={`rounded-2xl border bg-white/[0.03] p-4 transition ${banner.isActive ? "border-emerald-500/15" : "border-white/[0.06] opacity-60"}`}>
      <div className="flex gap-4">
        <div className="relative h-[120px] w-[60px] shrink-0 overflow-hidden rounded-xl bg-black/30">
          <video src={mediaSrc} className="h-full w-full object-cover" muted loop playsInline />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{banner.title}</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40">
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">{banner.position}</span>
            <span>Orden: {banner.sortOrder}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select value={nextProfileId} onChange={(e) => setNextProfileId(e.target.value)} className="min-w-[180px] rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs">
              <option value="">Seleccionar perfil</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.displayName || p.username || p.id}</option>
              ))}
            </select>
            <button disabled={busy || !nextProfileId} onClick={() => onReplaceProfile(banner, nextProfileId)} className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-1.5 text-xs text-fuchsia-300 disabled:opacity-50">
              Cambiar perfil (video más reciente)
            </button>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1.5">
          <button disabled={busy} onClick={() => onToggle(banner)} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${banner.isActive ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border border-white/10 bg-white/5 text-white/50"}`}>
            {banner.isActive ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />} {banner.isActive ? "Activo" : "Inactivo"}
          </button>
          <button disabled={busy} onClick={() => onRemove(banner.id)} className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-50">
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
