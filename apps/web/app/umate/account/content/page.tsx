"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Plus, Trash2, Image as ImageIcon, Video, Lock, Globe, Loader2, X, Upload, Sparkles } from "lucide-react";
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

  useEffect(() => {
    return () => {
      previewFiles.forEach((pf) => URL.revokeObjectURL(pf.preview));
    };
  }, [previewFiles]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newPreviews: PreviewFile[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
      .slice(0, 10 - previewFiles.length)
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
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
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
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };

      const result = await new Promise<any>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
          else reject(new Error(`HTTP ${xhr.status}`));
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
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Mi contenido</h1>
          <p className="text-sm text-slate-500">Publica, organiza y revisa el rendimiento de tus posts.</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{posts.length} publicaciones</span>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 flex items-center gap-2"><X className="h-3.5 w-3.5 shrink-0" /> {error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">{success}</div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
        <section className="rounded-3xl border border-fuchsia-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-white via-rose-50/70 to-orange-50 px-5 py-4">
            <div>
              <h2 className="text-sm font-black text-slate-900">Nueva publicación</h2>
              <p className="text-xs text-slate-500">Sube piezas aspiracionales para tu comunidad.</p>
            </div>
            <button
              onClick={() => setVisibility(visibility === "FREE" ? "PREMIUM" : "FREE")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition border ${visibility === "PREMIUM" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}`}
            >
              {visibility === "PREMIUM" ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />} {visibility === "PREMIUM" ? "Premium" : "Gratis"}
            </button>
          </div>

          <div className="p-5">
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Escribe un caption que invite a comentar o suscribirse" rows={4} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-fuchsia-300 focus:outline-none" />

            {previewFiles.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {previewFiles.map((pf, i) => (
                  <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {pf.type === "video" ? <video src={pf.preview} className="h-full w-full object-cover" muted /> : <img src={pf.preview} alt="" className="h-full w-full object-cover" />}
                    <button onClick={() => removeFile(i)} className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white opacity-0 transition group-hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                {previewFiles.length < 10 && (
                  <button onClick={() => fileRef.current?.click()} className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-fuchsia-300 hover:text-fuchsia-500"><Plus className="h-6 w-6" /></button>
                )}
              </div>
            )}

            {previewFiles.length === 0 && (
              <div
                ref={dropRef}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-10 transition ${isDragging ? "border-fuchsia-400 bg-fuchsia-50" : "border-slate-300 bg-slate-50 hover:border-fuchsia-300 hover:bg-white"}`}
              >
                <Upload className={`mb-3 h-8 w-8 ${isDragging ? "text-fuchsia-500" : "text-slate-400"}`} />
                <p className="text-sm font-medium text-slate-600">Arrastra fotos o videos</p>
                <p className="mt-1 text-[11px] text-slate-400">o haz click para seleccionar</p>
              </div>
            )}

            <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />

            {uploading && (
              <div className="mt-4">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500" style={{ width: `${uploadProgress}%` }} /></div>
                <p className="mt-1 text-center text-[10px] text-slate-500">Subiendo... {uploadProgress}%</p>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between">
              <div className="flex gap-2">
                <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"><ImageIcon className="h-4 w-4" />Foto</button>
                <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"><Video className="h-4 w-4" />Video</button>
              </div>
              <button onClick={handlePublish} disabled={uploading || !previewFiles.length} className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 disabled:opacity-40">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar"}
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">Publicaciones creadas</h2>
            <p className="text-xs text-slate-500">Historial visual</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-rose-400" /></div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center">
              <Sparkles className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Aún no has publicado nada</p>
              <p className="mt-1 text-xs text-slate-400">Empieza con tu primer post para activar tu feed.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {posts.map((post) => (
                <div key={post.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                  {post.media[0] && (
                    <div className="relative aspect-[4/3] bg-slate-100">
                      {post.media[0].type === "VIDEO" ? <video src={post.media[0].url} className="h-full w-full object-cover" controls /> : <img src={post.media[0].url} alt="" className="h-full w-full object-cover" />}
                      <span className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${post.visibility === "PREMIUM" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{post.visibility === "PREMIUM" ? "PREMIUM" : "GRATIS"}</span>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      {post.caption && <p className="line-clamp-2 text-sm text-slate-700">{post.caption}</p>}
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                        <span>{post.likeCount} likes</span>
                        <span>{post.viewCount} vistas</span>
                        <span>{new Date(post.createdAt).toLocaleDateString("es-CL")}</span>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(post.id)} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
