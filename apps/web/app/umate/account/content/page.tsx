"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Eye,
  FileStack,
  Globe,
  Grid3X3,
  Heart,
  Image,
  Loader2,
  Lock,
  Plus,
  Search,
  Upload,
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

type FilterKey = "ALL" | "FREE" | "PREMIUM" | "DRAFT";

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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<{ posts: Post[] }>("/umate/creator/posts")
      .then((d) => setPosts(d?.posts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      form.append("caption", caption);
      form.append("visibility", visibility);

      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(`${getApiBase()}/umate/creator/posts`, {
        method: "POST",
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (res.ok) {
        const json = await res.json();
        if (json?.post) setPosts((prev) => [json.post, ...prev]);
        setFiles([]);
        setCaption("");
        setShowEditor(false);
      }
    } finally {
      setUploading(false);
    }
  };

  const freeCount = posts.filter((p) => p.visibility === "FREE").length;
  const premiumCount = posts.filter((p) => p.visibility === "PREMIUM").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-fuchsia-500 to-rose-500 shadow-lg shadow-fuchsia-200/30">
              <FileStack className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Publicaciones</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">Biblioteca de contenido y editor de publicaciones.</p>
        </div>
        <button
          onClick={() => setShowEditor(!showEditor)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-fuchsia-300/30 transition hover:brightness-105"
        >
          <Plus className="h-4 w-4" /> {showEditor ? "Cerrar editor" : "Nueva publicación"}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-100 bg-white p-3 text-center shadow-sm">
          <p className="text-xl font-black text-slate-900">{posts.length}</p>
          <p className="text-[11px] text-slate-500">Total</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center">
          <p className="text-xl font-black text-emerald-800">{freeCount}</p>
          <p className="text-[11px] text-emerald-700">Gratis</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-center">
          <p className="text-xl font-black text-amber-800">{premiumCount}</p>
          <p className="text-[11px] text-amber-700">Premium</p>
        </div>
      </div>

      {/* Editor panel */}
      {showEditor && (
        <div className="rounded-2xl border border-fuchsia-100 bg-gradient-to-br from-white to-fuchsia-50/30 p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
            <Plus className="h-4 w-4 text-fuchsia-600" /> Crear publicación
          </h2>

          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Escribe una descripción atractiva para tu publicación..."
            className="mt-3 h-28 w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm outline-none transition focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100"
          />

          <div className="mt-3 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-1">
              <button
                onClick={() => setVisibility("FREE")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  visibility === "FREE" ? "bg-emerald-50 text-emerald-700" : "text-slate-500"
                }`}
              >
                <Globe className="h-3.5 w-3.5" /> Gratis
              </button>
              <button
                onClick={() => setVisibility("PREMIUM")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  visibility === "PREMIUM" ? "bg-amber-50 text-amber-700" : "text-slate-500"
                }`}
              >
                <Lock className="h-3.5 w-3.5" /> Premium
              </button>
            </div>

            <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-fuchsia-200 hover:text-fuchsia-700">
              <Upload className="h-4 w-4" /> Subir archivos
            </button>
          </div>

          {files.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-lg bg-fuchsia-50 px-3 py-1.5 text-xs font-semibold text-fuchsia-700">
                <Image className="h-3.5 w-3.5" /> {files.length} archivo(s)
              </div>
              <button onClick={() => setFiles([])} className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700">
                <X className="h-3 w-3" /> Limpiar
              </button>
            </div>
          )}

          <button
            onClick={handlePublish}
            disabled={uploading || !files.length}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Publicar <Check className="h-4 w-4" /></>}
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-1 rounded-lg bg-slate-50 p-0.5">
          {(["ALL", "FREE", "PREMIUM", "DRAFT"] as FilterKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                filter === key ? "bg-white text-fuchsia-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {key === "ALL" ? "Todas" : key === "FREE" ? "Gratis" : key === "PREMIUM" ? "Premium" : "Borradores"}
            </button>
          ))}
        </div>
        <div className="relative ml-auto min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por caption..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-xs outline-none transition focus:border-fuchsia-300"
          />
        </div>
      </div>

      {/* Posts library */}
      {loading && <div className="py-16 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-fuchsia-500" /></div>}

      {!loading && filteredPosts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-14 text-center">
          <Grid3X3 className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No hay publicaciones para este filtro.</p>
          <p className="mt-1 text-xs text-slate-500">Cambia de categoría o crea tu primera publicación.</p>
        </div>
      )}

      {!loading && filteredPosts.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredPosts.map((post) => (
            <article key={post.id} className="group overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md">
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-50">
                {post.media[0]?.url && <img src={post.media[0].url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />}
                <span className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-bold ${post.visibility === "FREE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {post.visibility === "FREE" ? "Gratis" : "Premium"}
                </span>
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-xs text-slate-700">{post.caption || "Sin descripción"}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3 text-rose-400" /> {post.likeCount}</span>
                    <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3 text-sky-400" /> {post.viewCount}</span>
                  </div>
                  <span>{new Date(post.createdAt).toLocaleDateString("es-CL")}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
