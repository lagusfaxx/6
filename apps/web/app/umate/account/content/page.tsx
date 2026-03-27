"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Eye,
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Publicaciones</h1>
          <p className="mt-1 text-sm text-white/30">Biblioteca de contenido y editor.</p>
        </div>
        <button
          onClick={() => setShowEditor(!showEditor)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#00aff0] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#00aff0]/90"
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
          <div key={s.label} className={`rounded-xl border ${s.border} bg-white/[0.02] p-3 text-center`}>
            <p className="text-xl font-extrabold text-white">{s.value}</p>
            <p className="text-[11px] text-white/25">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Editor */}
      {showEditor && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
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
                  visibility === "FREE" ? "bg-emerald-500/10 text-emerald-400" : "text-white/30"
                }`}
              >
                <Globe className="h-3 w-3" /> Gratis
              </button>
              <button
                onClick={() => setVisibility("PREMIUM")}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  visibility === "PREMIUM" ? "bg-amber-500/10 text-amber-400" : "text-white/30"
                }`}
              >
                <Lock className="h-3 w-3" /> Premium
              </button>
            </div>

            <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] px-4 py-1.5 text-sm font-medium text-white/40 transition hover:text-white/60">
              <Upload className="h-4 w-4" /> Subir archivos
            </button>
          </div>

          {files.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-lg bg-[#00aff0]/10 px-3 py-1 text-xs font-semibold text-[#00aff0]">
                <Image className="h-3 w-3" /> {files.length} archivo(s)
              </span>
              <button onClick={() => setFiles([])} className="text-xs text-rose-400 hover:text-rose-300">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          <button
            onClick={handlePublish}
            disabled={uploading || !files.length}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#00aff0] px-6 py-2 text-sm font-bold text-white transition hover:bg-[#00aff0]/90 disabled:opacity-40"
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
                filter === key ? "bg-white text-black" : "text-white/30 hover:text-white/50"
              }`}
            >
              {key === "ALL" ? "Todas" : key === "FREE" ? "Gratis" : "Premium"}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="w-48 rounded-full border border-white/[0.06] bg-white/[0.03] py-1.5 pl-9 pr-3 text-xs text-white placeholder-white/20 outline-none transition focus:border-[#00aff0]/40"
          />
        </div>
      </div>

      {/* Posts grid */}
      {loading && <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-white/20" /></div>}

      {!loading && filteredPosts.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/[0.08] p-14 text-center">
          <Grid3X3 className="mx-auto mb-3 h-8 w-8 text-white/10" />
          <p className="text-sm font-medium text-white/40">No hay publicaciones.</p>
        </div>
      )}

      {!loading && filteredPosts.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredPosts.map((post) => (
            <article key={post.id} className="group overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] transition hover:border-white/[0.12]">
              <div className="relative aspect-[4/3] overflow-hidden bg-white/[0.03]">
                {post.media[0]?.url && <img src={post.media[0].url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />}
                <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  post.visibility === "FREE" ? "bg-emerald-500/90 text-white" : "bg-amber-500/90 text-white"
                }`}>
                  {post.visibility === "FREE" ? "Gratis" : "Premium"}
                </span>
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-xs text-white/50">{post.caption || "Sin descripción"}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-white/20">
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
    </div>
  );
}
