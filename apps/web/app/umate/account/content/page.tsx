"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  Edit3,
  Eye,
  Globe,
  Grid3X3,
  Heart,
  ImagePlus,
  Loader2,
  Lock,
  Play,
  Search,
  Trash2,
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

type FilterKey = "ALL" | "FREE" | "PREMIUM";
type Visibility = "FREE" | "PREMIUM";

type CreatorStatus = {
  bankConfigured: boolean;
  termsAccepted: boolean;
  rulesAccepted: boolean;
  contractAccepted: boolean;
};

const MAX_FILES = 10;

export default function ContentPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileVisibilities, setFileVisibilities] = useState<Visibility[]>([]);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editVisibility, setEditVisibility] = useState<Visibility>("FREE");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [publishError, setPublishError] = useState("");
  const [creatorStatus, setCreatorStatus] = useState<CreatorStatus | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

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

  // Revoke object URLs when files change (avoid memory leaks)
  const previewUrls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => {
    return () => previewUrls.forEach((u) => URL.revokeObjectURL(u));
  }, [previewUrls]);

  const onboardingComplete = creatorStatus
    ? creatorStatus.bankConfigured &&
      creatorStatus.termsAccepted &&
      creatorStatus.rulesAccepted &&
      creatorStatus.contractAccepted
    : true;

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (filter !== "ALL" && post.visibility !== filter) return false;
      if (!query.trim()) return true;
      return (post.caption || "").toLowerCase().includes(query.toLowerCase());
    });
  }, [posts, filter, query]);

  const openPicker = () => {
    if (!onboardingComplete) return;
    fileRef.current?.click();
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (!newFiles.length) return;
    const merged = [...files, ...newFiles].slice(0, MAX_FILES);
    const newCount = merged.length - files.length;
    setFiles(merged);
    setFileVisibilities((prev) => [...prev, ...Array(newCount).fill("FREE" as Visibility)]);
    if (fileRef.current) fileRef.current.value = "";
    // Scroll to editor after adding
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  const setAllVisibility = (v: Visibility) => {
    setFileVisibilities((prev) => prev.map(() => v));
  };

  const toggleFileVisibility = (idx: number) => {
    setFileVisibilities((prev) =>
      prev.map((v, i) => (i === idx ? (v === "FREE" ? "PREMIUM" : "FREE") : v)),
    );
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setFileVisibilities((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearEditor = () => {
    setFiles([]);
    setFileVisibilities([]);
    setCaption("");
    setPublishError("");
  };

  const handlePublish = async () => {
    if (!files.length) return;
    setUploading(true);
    setPublishError("");
    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      form.append("caption", caption);
      const anyPremium = fileVisibilities.some((v) => v === "PREMIUM");
      form.append("visibility", anyPremium ? "PREMIUM" : "FREE");
      form.append("mediaVisibility", JSON.stringify(fileVisibilities));

      const res = await fetch(`${getApiBase()}/umate/posts`, {
        method: "POST",
        credentials: "include",
        body: form,
      });

      if (res.ok) {
        const json = await res.json();
        if (json?.post) setPosts((prev) => [json.post, ...prev]);
        clearEditor();
      } else {
        const json = await res.json().catch(() => null);
        setPublishError(json?.message || "Error al publicar. Verifica los archivos e intenta de nuevo.");
      }
    } catch {
      setPublishError("Error de conexión. Intenta de nuevo.");
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
      setPosts((prev) =>
        prev.map((p) =>
          p.id === editingPost.id ? { ...p, caption: editCaption, visibility: editVisibility } : p,
        ),
      );
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
  const hasFiles = files.length > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Publicaciones</h1>
          <p className="mt-1 text-sm text-white/30">
            {posts.length > 0
              ? `${posts.length} publicación${posts.length === 1 ? "" : "es"} · ${freeCount} gratis · ${premiumCount} premium`
              : "Sube tus primeras fotos o videos."}
          </p>
        </div>
        {posts.length > 0 && !hasFiles && (
          <button
            onClick={openPicker}
            disabled={!onboardingComplete}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(0,175,240,0.3)] transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ImagePlus className="h-4 w-4" /> Subir fotos
          </button>
        )}
      </div>

      {/* Hidden file input — always rendered */}
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFilesSelected}
      />

      {/* Onboarding incomplete warning */}
      {!onboardingComplete && creatorStatus && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
          <p className="text-sm font-semibold text-amber-300">
            Completa tu perfil para publicar
          </p>
          <p className="mt-1 text-xs text-white/45">
            Debes completar todos los pasos antes de poder crear publicaciones:
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {!creatorStatus.termsAccepted && (
              <li className="flex items-center gap-2 text-red-400">
                <X className="h-3 w-3" /> Aceptar términos y condiciones
              </li>
            )}
            {!creatorStatus.rulesAccepted && (
              <li className="flex items-center gap-2 text-red-400">
                <X className="h-3 w-3" /> Aceptar reglas de la comunidad
              </li>
            )}
            {!creatorStatus.contractAccepted && (
              <li className="flex items-center gap-2 text-red-400">
                <X className="h-3 w-3" /> Firmar contrato
              </li>
            )}
            {!creatorStatus.bankConfigured && (
              <li className="flex items-center gap-2 text-red-400">
                <X className="h-3 w-3" /> Configurar datos bancarios
              </li>
            )}
          </ul>
          <Link
            href="/umate/account/legal"
            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/25"
          >
            Ir a legal y cumplimiento
          </Link>
        </div>
      )}

      {/* Editor — visible when files are selected */}
      {hasFiles && (
        <section
          ref={editorRef}
          className="rounded-2xl border border-[#00aff0]/15 bg-[#00aff0]/[0.03] p-4 sm:p-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">
              Nueva publicación
              <span className="ml-2 text-xs font-normal text-white/40">
                {files.length}/{MAX_FILES}
              </span>
            </h2>
            <button
              onClick={clearEditor}
              className="text-xs text-white/40 transition hover:text-white/70"
            >
              Cancelar
            </button>
          </div>

          {/* Thumbnails grid */}
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {files.map((file, idx) => {
              const vis = fileVisibilities[idx] || "FREE";
              const isFree = vis === "FREE";
              const isVideo = file.type.startsWith("video/");
              return (
                <div
                  key={`${file.name}-${idx}`}
                  className={`relative aspect-square overflow-hidden rounded-xl border transition ${
                    isFree ? "border-emerald-500/30" : "border-amber-500/40"
                  }`}
                >
                  {isVideo ? (
                    <video
                      src={previewUrls[idx]}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <img
                      src={previewUrls[idx]}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}

                  {/* Visibility badge (tap to toggle) */}
                  <button
                    onClick={() => toggleFileVisibility(idx)}
                    aria-label={`Cambiar a ${isFree ? "premium" : "gratis"}`}
                    className={`absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm transition ${
                      isFree
                        ? "bg-emerald-500/85 text-white"
                        : "bg-amber-500/90 text-white"
                    }`}
                  >
                    {isFree ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                    {isFree ? "Gratis" : "Premium"}
                  </button>

                  {/* Video play indicator */}
                  {isVideo && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
                        <Play className="h-3.5 w-3.5 text-white fill-current" />
                      </div>
                    </div>
                  )}

                  {/* Remove */}
                  <button
                    onClick={() => removeFile(idx)}
                    aria-label="Quitar"
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-red-500/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}

            {/* Add more tile */}
            {files.length < MAX_FILES && (
              <button
                onClick={openPicker}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/15 text-white/40 transition hover:border-[#00aff0]/40 hover:bg-[#00aff0]/[0.03] hover:text-[#00aff0]"
              >
                <ImagePlus className="h-5 w-5" />
                <span className="text-[10px] font-medium">Agregar</span>
              </button>
            )}
          </div>

          {/* Bulk visibility shortcut */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-white/40">Marcar todas como:</span>
            <button
              onClick={() => setAllVisibility("FREE")}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/15"
            >
              <Globe className="h-3 w-3" /> Gratis
            </button>
            <button
              onClick={() => setAllVisibility("PREMIUM")}
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500/15"
            >
              <Lock className="h-3 w-3" /> Premium
            </button>
          </div>

          {/* Caption */}
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Descripción (opcional)..."
            rows={3}
            className="mt-4 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-[#00aff0]/40"
          />

          {publishError && (
            <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-300">
              {publishError}
            </p>
          )}

          <button
            onClick={handlePublish}
            disabled={uploading || !files.length}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-6 py-3 text-sm font-bold text-white shadow-[0_4px_20px_rgba(0,175,240,0.3)] transition disabled:opacity-40 sm:w-auto"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Publicando...
              </>
            ) : (
              <>
                Publicar {files.length > 1 ? `${files.length} archivos` : "publicación"}{" "}
                <Check className="h-4 w-4" />
              </>
            )}
          </button>
        </section>
      )}

      {/* Filter + search — only when posts exist */}
      {posts.length > 0 && (
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
              className="w-full rounded-full border border-white/[0.06] bg-white/[0.03] py-1.5 pl-9 pr-3 text-xs text-white placeholder-white/20 outline-none transition focus:border-[#00aff0]/40 sm:w-48"
            />
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-16 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#00aff0]/60" />
        </div>
      )}

      {/* Empty state — big CTA to start uploading */}
      {!loading && posts.length === 0 && !hasFiles && (
        <button
          onClick={openPicker}
          disabled={!onboardingComplete}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#00aff0]/30 bg-[#00aff0]/[0.03] p-10 text-center transition hover:border-[#00aff0]/60 hover:bg-[#00aff0]/[0.06] disabled:cursor-not-allowed disabled:opacity-40 sm:p-16"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00aff0]/15">
            <ImagePlus className="h-7 w-7 text-[#00aff0]" />
          </div>
          <div>
            <p className="text-base font-bold text-white">Publicar tus primeras fotos</p>
            <p className="mt-1 text-xs text-white/40">
              Toca aquí para elegir fotos o videos desde tu dispositivo.
            </p>
          </div>
        </button>
      )}

      {/* Empty after filter */}
      {!loading && posts.length > 0 && filteredPosts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/[0.06] p-10 text-center sm:p-20">
          <Grid3X3 className="mx-auto mb-4 h-8 w-8 text-white/[0.07]" />
          <p className="text-sm font-medium text-white/45">
            No hay publicaciones que coincidan.
          </p>
        </div>
      )}

      {/* Posts grid */}
      {!loading && filteredPosts.length > 0 && (
        <div className="grid gap-3 grid-cols-2 xl:grid-cols-3">
          {filteredPosts.map((post) => (
            <article
              key={post.id}
              className="group overflow-hidden rounded-2xl border border-white/[0.04] bg-white/[0.015] transition hover:border-white/[0.12]"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-white/[0.03]">
                {post.media[0]?.url &&
                  (post.media[0].type === "VIDEO" ? (
                    <div className="relative h-full w-full">
                      <video
                        src={resolveMediaUrl(post.media[0].url) || ""}
                        muted
                        playsInline
                        preload="metadata"
                        crossOrigin="anonymous"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                        onLoadedData={(e) => {
                          const v = e.currentTarget;
                          if (v.readyState >= 2) v.currentTime = 0.1;
                        }}
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
                          <Play className="h-4 w-4 fill-current text-white" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={resolveMediaUrl(post.media[0].url) || ""}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ))}
                <span
                  className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    post.visibility === "FREE"
                      ? "bg-emerald-500/90 text-white"
                      : "bg-amber-500/90 text-white"
                  }`}
                >
                  {post.visibility === "FREE" ? "Gratis" : "Premium"}
                </span>
                <div className="absolute right-2 top-2 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                  <button
                    onClick={() => {
                      setEditingPost(post);
                      setEditCaption(post.caption || "");
                      setEditVisibility(post.visibility);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white/80 backdrop-blur-sm hover:text-white"
                  >
                    <Edit3 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    disabled={deleting === post.id}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-red-400/80 backdrop-blur-sm hover:text-red-400 disabled:opacity-50"
                  >
                    {deleting === post.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-xs text-white/50">
                  {post.caption || "Sin descripción"}
                </p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-white/45">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="h-3 w-3 text-rose-400" /> {post.likeCount}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3 text-[#00aff0]" /> {post.viewCount}
                    </span>
                  </div>
                  <span>{new Date(post.createdAt).toLocaleDateString("es-CL")}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-lg sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-2xl border border-white/[0.06] bg-[#0c0c14] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Editar publicación</h3>
              <button
                onClick={() => setEditingPost(null)}
                className="text-white/40 hover:text-white/60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <textarea
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              placeholder="Descripción..."
              className="h-28 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] p-3.5 text-sm text-white placeholder-white/20 outline-none transition focus:border-[#00aff0]/40"
            />

            <div className="flex w-fit items-center gap-1 rounded-full bg-white/[0.04] p-1">
              <button
                onClick={() => setEditVisibility("FREE")}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  editVisibility === "FREE"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-white/40"
                }`}
              >
                <Globe className="h-3 w-3" /> Gratis
              </button>
              <button
                onClick={() => setEditVisibility("PREMIUM")}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  editVisibility === "PREMIUM"
                    ? "bg-amber-500/10 text-amber-400"
                    : "text-white/40"
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
