"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Plus, Trash2, Image as ImageIcon, Video, Lock, Globe, Loader2, X, Upload } from "lucide-react";
import { apiFetch, getApiBase } from "../../../../lib/api";

type Post = {
  id: string;
  caption: string | null;
  visibility: "FREE" | "PREMIUM";
  likeCount: number;
  viewCount: number;
  createdAt: string;
  media: { id: string; type: string; url: string; pos: number }[];
};

type PreviewFile = {
  file: File;
  preview: string;
  type: "image" | "video";
};

export default function ContentPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<"FREE" | "PREMIUM">("FREE");
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<{ posts: Post[] }>("/umate/creator/posts")
      .then((d) => setPosts(d?.posts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      previewFiles.forEach((pf) => URL.revokeObjectURL(pf.preview));
    };
  }, [previewFiles]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newPreviews: PreviewFile[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
      .slice(0, 10 - previewFiles.length) // max 10 files
      .map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        type: file.type.startsWith("video/") ? "video" as const : "image" as const,
      }));
    setPreviewFiles((prev) => [...prev, ...newPreviews]);
  }, [previewFiles.length]);

  const removeFile = (index: number) => {
    setPreviewFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Drag & Drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropRef.current) setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handlePublish = async () => {
    if (!previewFiles.length) return;
    setUploading(true);
    setUploadProgress(0);

    try {
      const form = new FormData();
      previewFiles.forEach((pf) => form.append("files", pf.file));
      form.append("caption", caption);
      form.append("visibility", visibility);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${getApiBase()}/umate/posts`);
      xhr.withCredentials = true;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      const result = await new Promise<any>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(form);
      });

      if (result?.post) {
        setPosts((prev) => [result.post, ...prev]);
        setCaption("");
        previewFiles.forEach((pf) => URL.revokeObjectURL(pf.preview));
        setPreviewFiles([]);
        setVisibility("FREE");
        setSuccess("¡Publicación creada exitosamente!");
        setError("");
        setTimeout(() => setSuccess(""), 4000);
      }
    } catch (err: any) {
      setError(err?.message || "Error al publicar. Intenta de nuevo.");
      setTimeout(() => setError(""), 5000);
    }
    setUploading(false);
    setUploadProgress(0);
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("¿Eliminar esta publicación? Esta acción no se puede deshacer.")) return;
    try {
      await apiFetch(`/umate/posts/${postId}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setSuccess("Publicación eliminada");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Error al eliminar la publicación");
      setTimeout(() => setError(""), 5000);
    }
  };

  return (
    <div className="mx-auto max-w-2xl py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Mi contenido</h1>
        <span className="text-xs text-white/30">{posts.length} publicaciones</span>
      </div>

      {/* Toast notifications */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300 flex items-center gap-2">
          <X className="h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
          {success}
        </div>
      )}

      {/* Create post — OnlyFans-style composer */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
          <h2 className="text-sm font-semibold">Nueva publicación</h2>
          <button
            onClick={() => setVisibility(visibility === "FREE" ? "PREMIUM" : "FREE")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
              visibility === "PREMIUM"
                ? "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
            }`}
          >
            {visibility === "PREMIUM" ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
            {visibility === "PREMIUM" ? "Premium" : "Gratis"}
          </button>
        </div>

        {/* Caption */}
        <div className="px-5 pt-4">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="¿Qué quieres compartir con tus suscriptores?"
            rows={3}
            className="w-full bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none resize-none"
          />
        </div>

        {/* File previews */}
        {previewFiles.length > 0 && (
          <div className="px-5 pb-2">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {previewFiles.map((pf, i) => (
                <div key={i} className="group relative aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/[0.06]">
                  {pf.type === "video" ? (
                    <video src={pf.preview} className="h-full w-full object-cover" muted />
                  ) : (
                    <img src={pf.preview} alt="" className="h-full w-full object-cover" />
                  )}
                  {/* Type badge */}
                  <div className="absolute top-1.5 left-1.5">
                    {pf.type === "video" ? (
                      <span className="flex items-center gap-0.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] text-white/80">
                        <Video className="h-2.5 w-2.5" /> Video
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] text-white/80">
                        <ImageIcon className="h-2.5 w-2.5" /> Foto
                      </span>
                    )}
                  </div>
                  {/* Remove button */}
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/80 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/80"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {/* Add more button */}
              {previewFiles.length < 10 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-white/[0.1] text-white/20 transition hover:border-rose-500/30 hover:text-rose-400/50"
                >
                  <Plus className="h-6 w-6" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Drag & Drop zone */}
        {previewFiles.length === 0 && (
          <div
            ref={dropRef}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`mx-5 mb-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-10 transition ${
              isDragging
                ? "border-rose-400/50 bg-rose-500/[0.06]"
                : "border-white/[0.08] hover:border-rose-500/25 hover:bg-white/[0.02]"
            }`}
          >
            <Upload className={`mb-3 h-8 w-8 ${isDragging ? "text-rose-400" : "text-white/15"}`} />
            <p className="text-sm font-medium text-white/40">
              {isDragging ? "Suelta los archivos aquí" : "Arrastra fotos o videos"}
            </p>
            <p className="mt-1 text-[11px] text-white/20">o haz click para seleccionar</p>
            <p className="mt-2 text-[10px] text-white/15">Máximo 10 archivos · Fotos y videos</p>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
        />

        {/* Upload progress */}
        {uploading && (
          <div className="mx-5 mb-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="mt-1 text-center text-[10px] text-white/30">Subiendo... {uploadProgress}%</p>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-white/40 transition hover:bg-white/[0.04] hover:text-white/60"
            >
              <ImageIcon className="h-4 w-4" /> Foto
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-white/40 transition hover:bg-white/[0.04] hover:text-white/60"
            >
              <Video className="h-4 w-4" /> Video
            </button>
          </div>
          <button
            onClick={handlePublish}
            disabled={uploading || !previewFiles.length}
            className="rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-6 py-2 text-sm font-semibold text-white transition hover:shadow-[0_0_20px_rgba(244,63,94,0.3)] disabled:opacity-40 disabled:hover:shadow-none"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar"}
          </button>
        </div>
      </div>

      {/* Posts list — grid like OnlyFans */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-rose-400" /></div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-16 text-center">
          <Upload className="mx-auto mb-3 h-10 w-10 text-white/10" />
          <p className="text-sm font-medium text-white/40">Aún no has publicado nada</p>
          <p className="mt-1 text-xs text-white/20">Tu contenido aparecerá aquí</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] transition hover:border-white/[0.12]">
              {/* Media carousel */}
              {post.media.length > 0 && (
                <div className="relative">
                  <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide">
                    {post.media.map((m, idx) => (
                      <div key={m.id} className="w-full flex-shrink-0 snap-center">
                        <div className="relative aspect-[4/3] bg-white/5">
                          {m.type === "VIDEO" ? (
                            <video src={m.url} className="h-full w-full object-cover" controls />
                          ) : (
                            <img src={m.url} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Visibility badge */}
                  <span className={`absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-[10px] font-bold backdrop-blur-sm ${
                    post.visibility === "PREMIUM" ? "bg-amber-500/25 text-amber-200" : "bg-emerald-500/25 text-emerald-200"
                  }`}>
                    {post.visibility === "PREMIUM" ? "PREMIUM" : "GRATIS"}
                  </span>
                  {post.media.length > 1 && (
                    <span className="absolute top-3 left-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                      1/{post.media.length}
                    </span>
                  )}
                </div>
              )}
              {/* Post info */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  {post.caption && <p className="text-sm text-white/70 line-clamp-2">{post.caption}</p>}
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-white/30">
                    <span>{post.likeCount} likes</span>
                    <span>{post.viewCount} vistas</span>
                    <span>{new Date(post.createdAt).toLocaleDateString("es-CL")}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(post.id)}
                  className="ml-3 shrink-0 rounded-lg p-2 text-white/15 transition hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
