"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import {
  ArrowLeft,
  Upload,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Image as ImageIcon,
  Video,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  X,
  Loader2,
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

export default function AdminBannersPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const isAdmin = useMemo(() => (user?.role ?? "").toUpperCase() === "ADMIN", [user?.role]);

  const [items, setItems] = useState<Banner[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Create form
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [position, setPosition] = useState("INLINE");
  const [sortOrder, setSortOrder] = useState("0");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setError(null);
    try {
      const res = await apiFetch<{ banners: Banner[] }>("/admin/banners");
      setItems(res?.banners ?? []);
    } catch {
      setError("No se pudieron cargar banners.");
    }
  }

  useEffect(() => {
    if (!loading && isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAdmin]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setIsVideo(file.type.startsWith("video/"));
    const url = URL.createObjectURL(file);
    setUploadPreview(url);
  }

  function clearFile() {
    setUploadFile(null);
    setUploadPreview(null);
    setIsVideo(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function create() {
    if (!uploadFile) {
      setError("Debes seleccionar una imagen o video.");
      return;
    }
    setBusy(true);
    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Upload file first
      const formData = new FormData();
      formData.append("file", uploadFile);
      const uploadRes = await apiFetch<{ url: string }>("/admin/banners/upload", {
        method: "POST",
        body: formData,
      });

      // Create banner with the uploaded URL
      await apiFetch("/admin/banners", {
        method: "POST",
        body: JSON.stringify({
          title: title || "Banner sin título",
          imageUrl: uploadRes.url,
          linkUrl: linkUrl || null,
          position,
          sortOrder: parseInt(sortOrder || "0", 10) || 0,
          isActive: true,
        }),
      });

      // Reset form
      setTitle("");
      setLinkUrl("");
      setPosition("INLINE");
      setSortOrder("0");
      clearFile();
      setShowCreate(false);
      setSuccess("Banner creado exitosamente.");
      await load();
    } catch {
      setError("No se pudo crear el banner.");
    } finally {
      setBusy(false);
      setUploading(false);
    }
  }

  async function toggle(b: Banner) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/banners/${b.id}`, { method: "PUT", body: JSON.stringify({ isActive: !b.isActive }) });
      setSuccess(`Banner ${b.isActive ? "desactivado" : "activado"}.`);
      await load();
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
      await load();
    } catch {
      setError("No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  }

  // Auto-clear messages
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  if (loading) return <div className="p-6 text-white/70">Cargando...</div>;
  if (!user) return <div className="p-6 text-white/70">Debes iniciar sesión.</div>;
  if (!isAdmin) return <div className="p-6 text-white/70">Acceso restringido.</div>;

  const activeBanners = items.filter((b) => b.isActive);
  const inactiveBanners = items.filter((b) => !b.isActive);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/10 transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Banners Publicitarios</h1>
            <p className="text-xs text-white/40">{items.length} banner{items.length !== 1 ? "s" : ""} · {activeBanners.length} activo{activeBanners.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2.5 text-sm font-semibold transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Nuevo banner
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-300 hover:text-red-100"><X className="h-4 w-4" /></button>
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 flex items-center justify-between">
          {success}
          <button onClick={() => setSuccess(null)} className="text-emerald-300 hover:text-emerald-100"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mt-4 rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/[0.05] to-violet-500/[0.03] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Crear banner</h2>
            <button onClick={() => { setShowCreate(false); clearFile(); }} className="text-white/40 hover:text-white/70">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* File upload area */}
          <div className="mb-4">
            {!uploadPreview ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03] px-6 py-10 text-center transition hover:border-fuchsia-500/30 hover:bg-fuchsia-500/[0.03]"
              >
                <Upload className="mx-auto h-8 w-8 text-white/30 mb-2" />
                <div className="text-sm text-white/60">Arrastra o haz clic para subir</div>
                <div className="text-xs text-white/30 mt-1">Imágenes (JPG, PNG, WebP) o Videos (MP4, MOV)</div>
              </button>
            ) : (
              <div className="relative rounded-2xl overflow-hidden border border-white/10">
                {isVideo ? (
                  <video
                    src={uploadPreview}
                    controls
                    className="w-full max-h-[200px] object-contain bg-black"
                  />
                ) : (
                  <img
                    src={uploadPreview}
                    alt="Preview"
                    className="w-full max-h-[200px] object-contain bg-black/50"
                  />
                )}
                <button
                  type="button"
                  onClick={clearFile}
                  className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[10px] text-white/70">
                  {isVideo ? <Video className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                  {isVideo ? "Video" : "Imagen"}
                </div>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Form fields */}
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-fuchsia-500/30 transition placeholder:text-white/30"
              placeholder="Título del banner"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-fuchsia-500/30 transition placeholder:text-white/30"
              placeholder="Link URL (opcional)"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
            <select
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-fuchsia-500/30 transition"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              <option value="INLINE">Inline (horizontal)</option>
              <option value="HORIZONTAL">Horizontal</option>
              <option value="LEFT">Lateral izquierdo</option>
              <option value="RIGHT">Lateral derecho</option>
              <option value="VERTICAL">Vertical</option>
            </select>
            <input
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-fuchsia-500/30 transition placeholder:text-white/30"
              placeholder="Orden (0, 1, 2...)"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>

          <button
            disabled={busy || !uploadFile}
            onClick={create}
            className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2.5 text-sm font-semibold transition hover:brightness-110 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Subiendo..." : "Crear banner"}
          </button>
        </div>
      )}

      {/* Active banners */}
      {activeBanners.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/70">
            <Eye className="h-4 w-4 text-emerald-400" />
            Activos ({activeBanners.length})
          </h3>
          <div className="space-y-3">
            {activeBanners.map((b) => (
              <BannerCard key={b.id} banner={b} busy={busy} onToggle={toggle} onRemove={remove} />
            ))}
          </div>
        </div>
      )}

      {/* Inactive banners */}
      {inactiveBanners.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/70">
            <EyeOff className="h-4 w-4 text-white/30" />
            Desactivados ({inactiveBanners.length})
          </h3>
          <div className="space-y-3">
            {inactiveBanners.map((b) => (
              <BannerCard key={b.id} banner={b} busy={busy} onToggle={toggle} onRemove={remove} />
            ))}
          </div>
        </div>
      )}

      {!items.length && (
        <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <ImageIcon className="mx-auto h-10 w-10 text-white/20 mb-3" />
          <div className="text-sm text-white/50">No hay banners publicitarios.</div>
          <div className="text-xs text-white/30 mt-1">Crea tu primer banner para mostrarlo en el home.</div>
        </div>
      )}
    </div>
  );
}

/* ── Banner card component ── */
function BannerCard({
  banner: b,
  busy,
  onToggle,
  onRemove,
}: {
  banner: Banner;
  busy: boolean;
  onToggle: (b: Banner) => void;
  onRemove: (id: string) => void;
}) {
  const mediaSrc = resolveMediaUrl(b.imageUrl);
  const isVideoMedia = mediaSrc && (mediaSrc.endsWith(".mp4") || mediaSrc.endsWith(".mov") || mediaSrc.endsWith(".webm"));

  return (
    <div className={`rounded-2xl border bg-white/[0.03] p-4 transition ${b.isActive ? "border-emerald-500/15" : "border-white/[0.06] opacity-60"}`}>
      <div className="flex gap-4">
        {/* Media preview */}
        <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-black/30">
          {mediaSrc ? (
            isVideoMedia ? (
              <video src={mediaSrc} muted className="h-full w-full object-cover" />
            ) : (
              <img src={mediaSrc} alt={b.title} className="h-full w-full object-cover" />
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/20">
              <ImageIcon className="h-6 w-6" />
            </div>
          )}
          <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white/60">
            {isVideoMedia ? <Video className="h-2.5 w-2.5" /> : <ImageIcon className="h-2.5 w-2.5" />}
            {isVideoMedia ? "Video" : "Imagen"}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{b.title}</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40">
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">{b.position}</span>
                <span>Orden: {b.sortOrder}</span>
              </div>
              {b.linkUrl && (
                <div className="mt-1 text-[11px] text-white/30 truncate max-w-[200px]">{b.linkUrl}</div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            disabled={busy}
            onClick={() => onToggle(b)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
              b.isActive
                ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                : "border border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
            }`}
          >
            {b.isActive ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
            {b.isActive ? "Activo" : "Inactivo"}
          </button>
          <button
            disabled={busy}
            onClick={() => onRemove(b.id)}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
