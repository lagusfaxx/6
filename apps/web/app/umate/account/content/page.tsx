"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Check,
  Clock3,
  Globe,
  Image as ImageIcon,
  Loader2,
  Lock,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
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

type FilterKey = "ALL" | "FREE" | "PREMIUM" | "DRAFT";

export default function ContentPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<"FREE" | "PREMIUM">("FREE");
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [query, setQuery] = useState("");
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
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

  useEffect(
    () => () => {
      previewFiles.forEach((pf) => URL.revokeObjectURL(pf.preview));
    },
    [previewFiles],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const newPreviews: PreviewFile[] = Array.from(files)
        .filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
        .slice(0, 10 - previewFiles.length)
        .map((file) => ({
          file,
          preview: URL.createObjectURL(file),
          type: file.type.startsWith("video/") ? "video" : "image",
        }));
      setPreviewFiles((prev) => [...prev, ...newPreviews]);
    },
    [previewFiles.length],
  );

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (filter !== "ALL" && filter !== "DRAFT" && post.visibility !== filter) return false;
      if (filter === "DRAFT") return false;
      if (!query.trim()) return true;
      return post.caption?.toLowerCase().includes(query.toLowerCase()) || false;
    });
  }, [posts, filter, query]);

  const removeFile = (index: number) => {
    setPreviewFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
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
        setLastCreatedId(result.post.id);
        setCaption("");
        previewFiles.forEach((pf) => URL.revokeObjectURL(pf.preview));
        setPreviewFiles([]);
        setVisibility("FREE");
        setSuccess("Publicación creada exitosamente");
        setTimeout(() => setSuccess(""), 3500);
      }
    } catch (err: any) {
      setError(err?.message || "Error al publicar. Intenta de nuevo.");
      setTimeout(() => setError(""), 5000);
    }

    setUploading(false);
    setUploadProgress(0);
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("¿Eliminar esta publicación?")) return;
    try {
      await apiFetch(`/umate/posts/${postId}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {
      setError("No se pudo eliminar la publicación");
      setTimeout(() => setError(""), 4000);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-6">
      <header className="rounded-3xl border border-fuchsia-100 bg-gradient-to-r from-white via-fuchsia-50/70 to-rose-50 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-white px-3 py-1 text-[11px] font-semibold text-fuchsia-700">
              <Sparkles className="h-3.5 w-3.5" /> Studio de contenido
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Publicación y biblioteca</h1>
            <p className="mt-1 text-sm text-slate-600">Crea, ordena y revisa tu catálogo de piezas gratis y premium.</p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-right">
            <p className="text-xs text-slate-500">Piezas publicadas</p>
            <p className="text-2xl font-black text-slate-900">{posts.length}</p>
          </div>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <X className="h-4 w-4" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
          <Check className="h-4 w-4" /> {success}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1.6fr]">
        <article className="rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-black text-slate-900">Nueva publicación</h2>
              <p className="text-xs text-slate-500">Tu espacio para preparar una nueva pieza.</p>
            </div>
            <button
              onClick={() => setVisibility((v) => (v === "FREE" ? "PREMIUM" : "FREE"))}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${visibility === "PREMIUM" ? "border-amber-200 bg-amber-100 text-amber-700" : "border-emerald-200 bg-emerald-100 text-emerald-700"}`}
            >
              {visibility === "PREMIUM" ? <Lock className="mr-1 inline h-3 w-3" /> : <Globe className="mr-1 inline h-3 w-3" />}
              {visibility === "PREMIUM" ? "Premium" : "Gratis"}
            </button>
          </div>

          <div className="space-y-4 p-5">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Escribe un caption con CTA"
              rows={4}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:border-fuchsia-300 focus:outline-none"
            />

            {previewFiles.length === 0 ? (
              <div
                ref={dropRef}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  if (e.currentTarget === dropRef.current) setIsDragging(false);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
                }}
                onClick={() => fileRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-10 transition ${isDragging ? "border-fuchsia-400 bg-fuchsia-50" : "border-slate-300 bg-slate-50 hover:border-fuchsia-300 hover:bg-white"}`}
              >
                <Upload className="mb-2 h-7 w-7 text-slate-400" />
                <p className="text-sm font-medium text-slate-600">Arrastra o selecciona archivos</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {previewFiles.map((pf, i) => (
                  <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200">
                    {pf.type === "video" ? <video src={pf.preview} className="h-full w-full object-cover" /> : <img src={pf.preview} alt="preview" className="h-full w-full object-cover" />}
                    <button onClick={() => removeFile(i)} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />

            {uploading && (
              <div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">Subiendo {uploadProgress}%</p>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-2">
                <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600">
                  <ImageIcon className="mr-1 inline h-4 w-4" /> Foto
                </button>
                <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600">
                  <Video className="mr-1 inline h-4 w-4" /> Video
                </button>
              </div>
              <button onClick={handlePublish} disabled={uploading || !previewFiles.length} className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar"}
              </button>
            </div>
          </div>
        </article>

        <article className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: "ALL", label: "Todas" },
              { key: "FREE", label: "Gratis" },
              { key: "PREMIUM", label: "Premium" },
              { key: "DRAFT", label: "Borradores" },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setFilter(item.key as FilterKey)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === item.key ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
              >
                {item.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">
              <Search className="h-3.5 w-3.5" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por caption" className="w-36 bg-transparent text-slate-700 outline-none" />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center rounded-2xl border border-slate-100 bg-white py-14">
              <Loader2 className="h-6 w-6 animate-spin text-fuchsia-500" />
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-14 text-center">
              <Clock3 className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No hay resultados para este filtro.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredPosts.map((post) => (
                <div key={post.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${lastCreatedId === post.id ? "border-fuchsia-300" : "border-slate-200"}`}>
                  <div className="relative aspect-[4/3] bg-slate-100">
                    {post.media[0]?.type === "VIDEO" ? <video src={post.media[0].url} className="h-full w-full object-cover" controls /> : post.media[0] ? <img src={post.media[0].url} alt="post" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-slate-400">Sin media</div>}
                    <span className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold ${post.visibility === "PREMIUM" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {post.visibility === "PREMIUM" ? "Premium" : "Gratis"}
                    </span>
                  </div>
                  <div className="space-y-2 p-4">
                    <p className="line-clamp-2 text-sm text-slate-700">{post.caption || "Publicación sin caption"}</p>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{post.likeCount} likes</span>
                      <span>{post.viewCount} vistas</span>
                      <span>{new Date(post.createdAt).toLocaleDateString("es-CL")}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                      <button className="font-semibold text-fuchsia-700">Editar</button>
                      <button className="font-semibold text-slate-600">Revisar</button>
                      <button onClick={() => handleDelete(post.id)} className="inline-flex items-center gap-1 font-semibold text-red-600">
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
