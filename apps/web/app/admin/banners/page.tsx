"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
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
  Image as ImageIcon,
  Smartphone,
  Monitor,
  Move,
  ZoomIn,
} from "lucide-react";

type Banner = {
  id: string;
  title: string;
  imageUrl: string;
  promoImageUrl?: string | null;
  professionalId?: string | null;
  linkUrl?: string | null;
  position: string;
  isActive: boolean;
  sortOrder: number;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt: string;
  adTier?: "STANDARD" | "GOLD";
  imageFocusX?: number;
  imageFocusY?: number;
  imageZoom?: number;
};

type AdminProfile = {
  id: string;
  displayName?: string | null;
  username?: string | null;
  city?: string | null;
};

type UploadResponse = { url: string };

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
  const [sortOrder, setSortOrder] = useState("0");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [promoImageUrl, setPromoImageUrl] = useState("");
  const [adTier, setAdTier] = useState<"STANDARD" | "GOLD">("STANDARD");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFocusX, setImageFocusX] = useState(50);
  const [imageFocusY, setImageFocusY] = useState(20);
  const [imageZoom, setImageZoom] = useState(1);
  const [previewMode, setPreviewMode] = useState<"mobile" | "desktop">("mobile");

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

  useEffect(() => {
    if (!loading && isAdmin) {
      loadBanners();
      loadProfiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAdmin]);

  async function onUploadImage(file?: File | null) {
    if (!file) return;
    setUploadingImage(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch<UploadResponse>("/admin/banners/upload", {
        method: "POST",
        body: form,
      });
      if (!res?.url) throw new Error("UPLOAD_FAILED");
      setPromoImageUrl(res.url);
    } catch {
      setError("No se pudo subir la foto promocional.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function create() {
    if (!selectedProfileId || !promoImageUrl) {
      setError("Debes elegir perfil y subir foto promocional.");
      return;
    }
    const profile = profiles.find((p) => p.id === selectedProfileId);
    if (!profile) {
      setError("Perfil inválido.");
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
          imageUrl: promoImageUrl,
          promoImageUrl,
          professionalId: profile.id,
          linkUrl: `profile:${profile.id}`,
          position: "POPUP_PROMO",
          sortOrder: parseInt(sortOrder || "0", 10) || 0,
          isActive: true,
          startsAt: startsAt || null,
          endsAt: endsAt || null,
          adTier,
          imageFocusX,
          imageFocusY,
          imageZoom,
        }),
      });

      setSortOrder("0");
      setStartsAt("");
      setEndsAt("");
      setPromoImageUrl("");
      setAdTier("STANDARD");
      setImageFocusX(50);
      setImageFocusY(20);
      setImageZoom(1);
      setShowCreate(false);
      setSuccess("Banner promocional creado.");
      await loadBanners();
    } catch {
      setError("No se pudo crear el banner promocional.");
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
      await apiFetch(`/admin/banners/${banner.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: `Banner promocional · ${profile.displayName || profile.username || "Perfil"}`,
          professionalId: profile.id,
          linkUrl: `profile:${profile.id}`,
        }),
      });
      setSuccess("Perfil promocionado actualizado.");
      await loadBanners();
    } catch {
      setError("No se pudo actualizar la promoción.");
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


  async function updateTier(b: Banner, nextTier: "STANDARD" | "GOLD") {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/banners/${b.id}`, { method: "PUT", body: JSON.stringify({ adTier: nextTier }) });
      setSuccess("Nivel del banner actualizado.");
      await loadBanners();
    } catch {
      setError("No se pudo actualizar el nivel del banner.");
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/10 transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Banners promocionales home (profesionales)</h1>
            <p className="text-xs text-white/40">{items.length} banner{items.length !== 1 ? "s" : ""} · {activeBanners.length} activo{activeBanners.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button onClick={() => setShowCreate((v) => !v)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2.5 text-sm font-semibold transition hover:brightness-110">
          <Plus className="h-4 w-4" /> Nueva promoción
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
          <h2 className="text-lg font-semibold mb-4">Crear banner promocional</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <select className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm" value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.displayName || p.username || p.id}</option>
              ))}
            </select>
            <input className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="Orden" />
            <input className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} placeholder="Inicio (opcional)" />
            <input className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} placeholder="Fin (opcional)" />
            <input className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm" value={promoImageUrl} onChange={(e) => setPromoImageUrl(e.target.value)} placeholder="URL de foto promocional" />
            <select className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm" value={adTier} onChange={(e) => setAdTier((e.target.value === "GOLD" ? "GOLD" : "STANDARD"))}>
              <option value="STANDARD">Estándar</option>
              <option value="GOLD">Gold</option>
            </select>
            <input className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-fuchsia-500/20 file:px-3 file:py-1.5 file:text-fuchsia-200" type="file" accept="image/*" onChange={(e) => onUploadImage(e.target.files?.[0] ?? null)} />
          </div>

          <button type="button" onClick={loadProfiles} className="mt-3 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80 flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Actualizar perfiles
          </button>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-3 text-xs font-medium text-white/60">Encuadre de imagen promocional</div>

            {promoImageUrl ? (
              <div className="space-y-4">
                {/* Image cropper */}
                <BannerImageCropper
                  imageUrl={promoImageUrl}
                  focusX={imageFocusX}
                  focusY={imageFocusY}
                  zoom={imageZoom}
                  onFocusChange={(x, y) => { setImageFocusX(x); setImageFocusY(y); }}
                  onZoomChange={setImageZoom}
                />

                {/* Preview mode toggle */}
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("mobile")}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${previewMode === "mobile" ? "bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/30" : "bg-white/5 text-white/50 border border-white/10"}`}
                  >
                    <Smartphone className="h-3.5 w-3.5" /> Mobile
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("desktop")}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${previewMode === "desktop" ? "bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/30" : "bg-white/5 text-white/50 border border-white/10"}`}
                  >
                    <Monitor className="h-3.5 w-3.5" /> Desktop
                  </button>
                </div>

                {/* Preview banner */}
                <div className="flex justify-center">
                  <div className={`overflow-hidden rounded-xl border border-white/10 bg-black/40 ${previewMode === "mobile" ? "h-[240px] w-[150px]" : "h-[260px] w-[160px]"}`}>
                    {selectedProfile ? (
                      <ProfileVideoBannerPreview
                        profile={selectedProfile}
                        imageUrl={promoImageUrl}
                        adTier={adTier}
                        focusX={imageFocusX}
                        focusY={imageFocusY}
                        zoom={imageZoom}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-white/40">Selecciona un perfil</div>
                    )}
                  </div>
                </div>
                <p className="text-center text-[10px] text-white/30">
                  {previewMode === "mobile" ? "Vista mobile (150×240)" : "Vista desktop (160×260)"}
                </p>
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-xs text-white/40">Sube o pega URL de foto para ajustar encuadre</div>
            )}
          </div>

          <button disabled={busy || uploadingImage || !selectedProfileId || !promoImageUrl} onClick={create} className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
            {busy || uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear promoción
          </button>
        </div>
      )}

      {activeBanners.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/70"><Eye className="h-4 w-4 text-emerald-400" /> Activos ({activeBanners.length})</h3>
          <div className="space-y-3">
            {activeBanners.map((b) => <BannerCard key={b.id} banner={b} busy={busy} profiles={profiles} onToggle={toggle} onRemove={remove} onReplaceProfile={replaceProfile} onUpdateTier={updateTier} />)}
          </div>
        </div>
      )}

      {inactiveBanners.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/70"><EyeOff className="h-4 w-4 text-white/30" /> Desactivados ({inactiveBanners.length})</h3>
          <div className="space-y-3">
            {inactiveBanners.map((b) => <BannerCard key={b.id} banner={b} busy={busy} profiles={profiles} onToggle={toggle} onRemove={remove} onReplaceProfile={replaceProfile} onUpdateTier={updateTier} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileVideoBannerPreview({
  profile,
  imageUrl,
  adTier,
  focusX = 50,
  focusY = 20,
  zoom = 1,
}: {
  profile: AdminProfile;
  imageUrl: string;
  adTier: "STANDARD" | "GOLD";
  focusX?: number;
  focusY?: number;
  zoom?: number;
}) {
  const src = resolveMediaUrl(imageUrl) || imageUrl;
  return (
    <div className="relative h-full w-full overflow-hidden">
      <img
        src={src}
        className="h-full w-full object-cover transition-transform duration-300"
        style={{
          objectPosition: `${focusX}% ${focusY}%`,
          transform: zoom > 1 ? `scale(${zoom})` : undefined,
        }}
        alt={profile.displayName || profile.username || "Promoción"}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <div className={`absolute left-3 right-3 bottom-3 rounded-lg border bg-black/50 p-2 ${adTier === "GOLD" ? "border-amber-300/60 shadow-[0_0_20px_rgba(245,158,11,0.3)]" : "border-white/20"}`}>
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-fuchsia-300" />
          <p className="truncate text-[11px] font-semibold text-white">Banner promocional {adTier === "GOLD" ? "· GOLD" : "· ESTÁNDAR"}</p>
        </div>
        <p className="mt-1 truncate text-xs text-white">{profile.displayName || profile.username || "Perfil"}</p>
      </div>
    </div>
  );
}

function BannerImageCropper({
  imageUrl,
  focusX,
  focusY,
  zoom,
  onFocusChange,
  onZoomChange,
}: {
  imageUrl: string;
  focusX: number;
  focusY: number;
  zoom: number;
  onFocusChange: (x: number, y: number) => void;
  onZoomChange: (z: number) => void;
}) {
  const src = resolveMediaUrl(imageUrl) || imageUrl;
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      onFocusChange(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
    },
    [onFocusChange],
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] text-white/40">
        <Move className="h-3 w-3" /> Arrastra sobre la imagen para elegir el punto de enfoque
      </div>
      <div
        ref={containerRef}
        className="relative mx-auto h-[300px] w-full max-w-[280px] cursor-crosshair overflow-hidden rounded-xl border border-white/15 bg-black/40"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <img
          src={src}
          className="h-full w-full object-cover pointer-events-none select-none"
          style={{
            objectPosition: `${focusX}% ${focusY}%`,
            transform: zoom > 1 ? `scale(${zoom})` : undefined,
          }}
          alt="Encuadre"
          draggable={false}
        />
        {/* Crosshair indicator */}
        <div
          className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-fuchsia-400 shadow-[0_0_8px_rgba(217,70,239,0.5)]"
          style={{ left: `${focusX}%`, top: `${focusY}%` }}
        >
          <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-400" />
        </div>
        {/* Grid overlay */}
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border border-white/[0.06]" />
          ))}
        </div>
      </div>

      {/* Zoom slider */}
      <div className="flex items-center gap-3 px-4">
        <ZoomIn className="h-3.5 w-3.5 text-white/40 shrink-0" />
        <input
          type="range"
          min="1"
          max="3"
          step="0.05"
          value={zoom}
          onChange={(e) => onZoomChange(parseFloat(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-fuchsia-500 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fuchsia-400"
        />
        <span className="text-[10px] text-white/40 shrink-0 w-8 text-right">{zoom.toFixed(1)}×</span>
      </div>

      <div className="flex justify-center gap-4 text-[10px] text-white/30">
        <span>X: {focusX.toFixed(0)}%</span>
        <span>Y: {focusY.toFixed(0)}%</span>
        <span>Zoom: {zoom.toFixed(2)}×</span>
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
  onUpdateTier,
}: {
  banner: Banner;
  busy: boolean;
  profiles: AdminProfile[];
  onToggle: (b: Banner) => void;
  onRemove: (id: string) => void;
  onReplaceProfile: (banner: Banner, profileId: string) => void;
  onUpdateTier: (banner: Banner, nextTier: "STANDARD" | "GOLD") => void;
}) {
  const [nextProfileId, setNextProfileId] = useState(extractProfileId(banner.linkUrl) || "");
  const mediaSrc = resolveMediaUrl(banner.promoImageUrl || banner.imageUrl) ?? banner.promoImageUrl ?? banner.imageUrl;

  return (
    <div className={`rounded-2xl border bg-white/[0.03] p-4 transition ${banner.isActive ? "border-emerald-500/15" : "border-white/[0.06] opacity-60"}`}>
      <div className="flex gap-4">
          <div className="relative h-[120px] w-[60px] shrink-0 overflow-hidden rounded-xl bg-black/30">
          <img src={mediaSrc} className="h-full w-full object-cover" alt={banner.title} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{banner.title}</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40">
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${banner.adTier === "GOLD" ? "bg-amber-500/20 text-amber-200" : "bg-white/10 text-white/70"}`}>{banner.adTier === "GOLD" ? "GOLD" : "ESTÁNDAR"}</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">{banner.position}</span>
            <span>Orden: {banner.sortOrder}</span>
            {banner.startsAt ? <span>Desde: {new Date(banner.startsAt).toLocaleDateString()}</span> : null}
            {banner.endsAt ? <span>Hasta: {new Date(banner.endsAt).toLocaleDateString()}</span> : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select value={nextProfileId} onChange={(e) => setNextProfileId(e.target.value)} className="min-w-[180px] rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs">
              <option value="">Seleccionar perfil</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.displayName || p.username || p.id}</option>
              ))}
            </select>
            <button disabled={busy || !nextProfileId} onClick={() => onReplaceProfile(banner, nextProfileId)} className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-1.5 text-xs text-fuchsia-300 disabled:opacity-50">
              Cambiar perfil asociado
            </button>
            <button disabled={busy} onClick={() => onUpdateTier(banner, banner.adTier === "GOLD" ? "STANDARD" : "GOLD")} className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200 disabled:opacity-50">
              Nivel: {banner.adTier === "GOLD" ? "Cambiar a Estándar" : "Cambiar a Gold"}
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
