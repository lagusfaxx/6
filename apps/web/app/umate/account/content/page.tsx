"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Edit3,
  Eye,
  Globe,
  Grid3X3,
  Heart,
  Image,
  Loader2,
  Lock,
  Play,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { apiFetch, getApiBase, resolveMediaUrl } from "../../../../lib/api";

type Post = {
  id: string;
  caption: string | null;
  visibility: "FREE" | "PREMIUM";
  likeCount: number;
  viewCount: number;
  createdAt: string;
  media: { id: string; type: string; url: string; pos: number }[];
};

type FilterKey = "ALL" | "FREE" | "PREMIUM" | "DRAFT";

type CreatorStatus = {
  bankConfigured: boolean;
  termsAccepted: boolean;
  rulesAccepted: boolean;
  contractAccepted: boolean;
};

export default function ContentPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<"FREE" | "PREMIUM">("FREE");
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editVisibility, setEditVisibility] = useState<"FREE" | "PREMIUM">("FREE");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [publishError, setPublishError] = useState("");
  const [creatorStatus, setCreatorStatus] = useState<CreatorStatus | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<{ posts: Post[] }>("/umate/creator/posts").catch(() => null),
      apiFetch<CreatorStatus>("/umate/creator/stats").catch(() => null),
    ]).then(([postsData, statusData]) => {
      setPosts(postsData?.posts || []);
      if (statusData) setCreatorStatus(statusData);
      setLoading(false);
    });
  }, []);

  const onboardingComplete = creatorStatus
    ? creatorStatus.bankConfigured && creatorStatus.termsAccepted && creatorStatus.rulesAccepted && creatorStatus.contractAccepted
    : true;

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (filter !== "ALL" && filter !== "DRAFT" && post.visibility !== filter) return false;
      if (filter === "DRAFT") return false;
      if (!query.trim()) return true;
      return (post.caption || "").toLowerCase().includes(query.toLowerCase());
    });
  }, [posts, filter, query]);

  const handlePublish = async () => {
    if (!files.length) return;
    setUploading(true);
    setPublishError("");
    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      form.append("caption", caption);
      form.append("visibility", visibility);

      const res = await fetch(`${getApiBase()}/umate/posts`, {
        method: "POST",
        credentials: "include",
        body: form,
      });

      if (res.ok) {
        const json = await res.json();
        if (json?.post) setPosts((prev) => [json.post, ...prev]);
        setFiles([]);
        setCaption("");
        setShowEditor(false);
      } else {
        const json = await res.json().catch(() => null);
        setPublishError(json?.message || "Error al publicar. Verifica los archivos e intenta de nuevo.");
      }
    } catch {
      setPublishError("Error de conexion. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  };

  const handleEditPost = async () => {
    if (!editingPost) return;
    setSaving(true);
    const res = await apiFetch<{ post: Post }>(`/umate/posts/${editingPost.id}`, {
      method: "PUT",
      body: JSON.stringify({ caption: editCaption, visibility: editVisibility }),
    }).catch(() => null);
    if (res?.post) {
      setPosts((prev) => prev.map((p) => (p.id === editingPost.id ? { ...p, caption: editCaption, visibility: editVisibility } : p)));
      setEditingPost(null);
    }
    setSaving(false);
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("¿Eliminar esta publicación?")) return;
    setDeleting(postId);
    await apiFetch(`/umate/posts/${postId}`, { method: "DELETE" }).catch(() => null);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setDeleting(null);
  };

  const freeCount = posts.filter((p) => p.visibility === "FREE").length;
  const premiumCount = posts.filter((p) => p.visibility === "PREMIUM").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Publicaciones</h1>
          <p className="mt-1 text-sm text-white/30">Biblioteca de contenido y editor.</p>
        </div>
        <button
          onClick={() => onboardingComplete && setShowEditor(!showEditor)}
          disabled={!onboardingComplete}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-5 py-2 text-sm font-semibold text-white shadow-[0_2px_12px_rgba(0,175,240,0.25)] transition-all duration-200 hover:bg-[#00aff0]/90 hover:shadow-[0_4px_20px_rgba(0,175,240,0.35)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" /> {showEditor ? "Cerrar editor" : "Nueva publicación"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: posts.length, border: "border-white/[0.06]" },
          { label: "Gratis", value: freeCount, border: "border-emerald-500/20" },
          { label: "Premium", value: premiumCount, border: "border-amber-500/20" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border ${s.border} bg-white/[0.015] p-3 text-center`}>
            <p className="text-xl font-extrabold text-white">{s.value}</p>
            <p className="text-[11px] text-white/40">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Onboarding incomplete warning */}
      {!onboardingComplete && creatorStatus && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
          <p className="text-sm font-semibold text-amber-300">Completa tu perfil para publicar</p>
          <p className="mt-1 text-xs text-white/45">Debes completar todos los pasos antes de poder crear publicaciones:</p>
          <ul className="mt-2 space-y-1 text-xs">
            {!creatorStatus.termsAccepted && <li className="flex items-center gap-2 text-red-400"><X className="h-3 w-3" /> Aceptar términos y condiciones</li>}
            {!creatorStatus.rulesAccepted && <li className="flex items-center gap-2 text-red-400"><X className="h-3 w-3" /> Aceptar reglas de la comunidad</li>}
            {!creatorStatus.contractAccepted && <li className="flex items-center gap-2 text-red-400"><X className="h-3 w-3" /> Firmar contrato</li>}
            {!creatorStatus.bankConfigured && <li className="flex items-center gap-2 text-red-400"><X className="h-3 w-3" /> Configurar datos bancarios</li>}
            {creatorStatus.termsAccepted && <li className="flex items-center gap-2 text-emerald-400"><Check className="h-3 w-3" /> Términos y condiciones</li>}
            {creatorStatus.rulesAccepted && <li className="flex items-center gap-2 text-emerald-400"><Check className="h-3 w-3" /> Reglas de la comunidad</li>}
            {creatorStatus.contractAccepted && <li className="flex items-center gap-2 text-emerald-400"><Check className="h-3 w-3" /> Contrato firmado</li>}
            {creatorStatus.bankConfigured && <li className="flex items-center gap-2 text-emerald-400"><Check className="h-3 w-3" /> Datos bancarios</li>}
          </ul>
          <a href="/umate/account/creator" className="mt-3 inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/25">
            Ir a mi cuenta
          </a>
        </div>
      )}

      {/* Editor */}
      {showEditor && onboardingComplete && (
        <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
          <h2 className="text-sm font-bold text-white/50">Crear publicación</h2>

          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Escribe una descripción..."
            className="mt-3 h-28 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] p-3.5 text-sm text-white placeholder-white/20 outline-none transition focus:border-[#00aff0]/40"
          />

          <div className="mt-3 flex flex-wrap gap-3">
            <div className="flex items-center gap-1 rounded-full bg-white/[0.04] p-1">
              <button
                onClick={() => setVisibility("FREE")}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  visibility === "FREE" ? "bg-emerald-500/10 text-emerald-400" : "text-white/40"
                }`}
              >
                <Globe className="h-3 w-3" /> Gratis
              </button>
              <button
                onClick={() => setVisibility("PREMIUM")}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  visibility === "PREMIUM" ? "bg-amber-500/10 text-amber-400" : "text-white/40"
                }`}
              >
                <Lock className="h-3 w-3" /> Premium
              </button>
            </div>

            <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => {
              const newFiles = Array.from(e.target.files || []);
              setFiles((prev) => [...prev, ...newFiles].slice(0, 10));
              if (fileRef.current) fileRef.current.value = "";
            }} />
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] px-4 py-1.5 text-sm font-medium text-white/40 transition hover:text-white/60">
              <Upload className="h-4 w-4" /> {files.length > 0 ? "Agregar más" : "Subir archivos"}
            </button>
            {files.length > 0 && (
              <span className="text-[11px] text-white/30">{files.length}/10</span>
            )}
          </div>

          {/* File previews */}
          {files.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {files.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="group relative aspect-square overflow-hidden rounded-xl border border-white/[0.06] bg-black">
                  {file.type.startsWith("video/") ? (
                    <video
                      src={URL.createObjectURL(file)}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-contain"
                      onLoadedData={(e) => { const v = e.currentTarget; if (v.readyState >= 2) v.currentTime = 0.1; }}
                    />
                  ) : (
                    <img
                      src={URL.createObjectURL(file)}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  )}
                  {file.type.startsWith("video/") && (
                    <div className="absolute left-1.5 bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
                      <Play className="h-2.5 w-2.5 text-white fill-current ml-px" />
                    </div>
                  )}
                  <button
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white/70 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/80 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <span className="absolute left-1.5 top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-black/60 px-1 text-[9px] font-bold text-white/70 backdrop-blur-sm">
                    {idx + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          {publishError && (
            <p className="mt-2 text-xs text-red-400">{publishError}</p>
          )}
          <button
            onClick={handlePublish}
            disabled={uploading || !files.length}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-6 py-2 text-sm font-bold text-white transition hover:bg-[#00aff0]/90 disabled:opacity-40"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Publicar <Check className="h-4 w-4" /></>}
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-full bg-white/[0.04] p-1">
          {(["ALL", "FREE", "PREMIUM"] as FilterKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filter === key ? "bg-white text-black" : "text-white/40 hover:text-white/50"
              }`}
            >
              {key === "ALL" ? "Todas" : key === "FREE" ? "Gratis" : "Premium"}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/45" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="w-48 rounded-full border border-white/[0.06] bg-white/[0.03] py-1.5 pl-9 pr-3 text-xs text-white placeholder-white/20 outline-none transition focus:border-[#00aff0]/40"
          />
        </div>
      </div>

      {/* Posts grid */}
      {loading && <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#00aff0]/60" /></div>}

      {!loading && filteredPosts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/[0.06] p-20 text-center">
          <Grid3X3 className="mx-auto mb-4 h-8 w-8 text-white/[0.07]" />
          <p className="text-sm font-medium text-white/45">No hay publicaciones.</p>
        </div>
      )}

      {!loading && filteredPosts.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredPosts.map((post) => (
            <article key={post.id} className="group overflow-hidden rounded-2xl border border-white/[0.04] bg-white/[0.015] transition hover:border-white/[0.12]">
              <div className="relative aspect-[4/3] overflow-hidden bg-white/[0.03]">
                {post.media[0]?.url && (
                  post.media[0].type === "VIDEO" ? (
                    <div className="relative h-full w-full">
                      <video
                        src={resolveMediaUrl(post.media[0].url) || ""}
                        muted
                        playsInline
                        preload="metadata"
                        crossOrigin="anonymous"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                        onLoadedData={(e) => { const v = e.currentTarget; if (v.readyState >= 2) v.currentTime = 0.1; }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
                          <Play className="h-4 w-4 text-white fill-current" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <img src={resolveMediaUrl(post.media[0].url) || ""} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                  )
                )}
                <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  post.visibility === "FREE" ? "bg-emerald-500/90 text-white" : "bg-amber-500/90 text-white"
                }`}>
                  {post.visibility === "FREE" ? "Gratis" : "Premium"}
                </span>
                {/* Edit/Delete overlay */}
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => { setEditingPost(post); setEditCaption(post.caption || ""); setEditVisibility(post.visibility); }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white/80 backdrop-blur-sm hover:text-white"
                  >
                    <Edit3 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    disabled={deleting === post.id}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-red-400/80 backdrop-blur-sm hover:text-red-400 disabled:opacity-50"
                  >
                    {deleting === post.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </button>
                </div>
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-xs text-white/50">{post.caption || "Sin descripción"}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-white/45">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3 text-rose-400" /> {post.likeCount}</span>
                    <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3 text-[#00aff0]" /> {post.viewCount}</span>
                  </div>
                  <span>{new Date(post.createdAt).toLocaleDateString("es-CL")}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-lg p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.06] bg-[#0c0c14] p-6 space-y-4 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Editar publicación</h3>
              <button onClick={() => setEditingPost(null)} className="text-white/40 hover:text-white/60"><X className="h-4 w-4" /></button>
            </div>

            <textarea
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              placeholder="Descripción..."
              className="h-28 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] p-3.5 text-sm text-white placeholder-white/20 outline-none transition focus:border-[#00aff0]/40"
            />

            <div className="flex items-center gap-1 rounded-full bg-white/[0.04] p-1 w-fit">
              <button
                onClick={() => setEditVisibility("FREE")}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  editVisibility === "FREE" ? "bg-emerald-500/10 text-emerald-400" : "text-white/40"
                }`}
              >
                <Globe className="h-3 w-3" /> Gratis
              </button>
              <button
                onClick={() => setEditVisibility("PREMIUM")}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  editVisibility === "PREMIUM" ? "bg-amber-500/10 text-amber-400" : "text-white/40"
                }`}
              >
                <Lock className="h-3 w-3" /> Premium
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleEditPost}
                disabled={saving}
                className="rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#00aff0]/90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
              </button>
              <button
                onClick={() => setEditingPost(null)}
                className="rounded-xl border border-white/[0.06] px-4 py-2 text-sm text-white/30 transition hover:text-white/50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
