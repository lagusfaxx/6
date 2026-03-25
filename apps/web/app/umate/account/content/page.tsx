"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Globe, Loader2, Lock, Plus, Search, Upload, X } from "lucide-react";
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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<{ posts: Post[] }>("/umate/creator/posts").then((d) => setPosts(d?.posts || [])).catch(() => {}).finally(() => setLoading(false));
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
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5 py-2 pb-10">
      <section className="rounded-3xl border border-fuchsia-100 bg-gradient-to-r from-white via-rose-50/70 to-orange-50 p-6 shadow-sm">
        <h1 className="text-3xl font-black text-slate-900">Publicaciones · Studio</h1>
        <p className="text-sm text-slate-600">Separa creación de contenido y administración de biblioteca en un solo flujo profesional.</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Plus className="h-3.5 w-3.5" /> Crear publicación</p>
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Escribe una descripción atractiva para tu publicación" className="mt-3 h-24 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-fuchsia-300" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => setVisibility("FREE")} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${visibility === "FREE" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}><Globe className="mr-1 inline h-3.5 w-3.5" /> Gratis</button>
            <button onClick={() => setVisibility("PREMIUM")} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${visibility === "PREMIUM" ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-600"}`}><Lock className="mr-1 inline h-3.5 w-3.5" /> Premium</button>
          </div>

          <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
          <button onClick={() => fileRef.current?.click()} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><Upload className="mr-1 inline h-4 w-4" /> Subir archivos</button>

          {!!files.length && (
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              {files.length} archivo(s) listo(s)
              <button onClick={() => setFiles([])} className="ml-2 inline-flex items-center gap-1 text-rose-600"><X className="h-3 w-3" /> Limpiar</button>
            </div>
          )}

          <button onClick={handlePublish} disabled={uploading || !files.length} className="mt-4 w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {uploading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Publicar"}
          </button>
        </article>

        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Biblioteca de publicaciones</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{filteredPosts.length} items</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {["ALL", "FREE", "PREMIUM", "DRAFT"].map((key) => (
              <button key={key} onClick={() => setFilter(key as FilterKey)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === key ? "bg-fuchsia-100 text-fuchsia-700" : "bg-slate-100 text-slate-600"}`}>{key === "ALL" ? "Todas" : key === "FREE" ? "Gratis" : key === "PREMIUM" ? "Premium" : "Borradores"}</button>
            ))}
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar caption" className="rounded-xl border border-slate-200 py-1.5 pl-7 pr-2 text-xs outline-none" />
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {filteredPosts.map((post) => (
              <article key={post.id} className="overflow-hidden rounded-xl border border-slate-100">
                <div className="aspect-[4/3] bg-slate-100">{post.media[0]?.url && <img src={post.media[0].url} alt="" className="h-full w-full object-cover" />}</div>
                <div className="p-3">
                  <p className="line-clamp-2 text-xs text-slate-700">{post.caption || "Sin caption"}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{post.visibility}</span>
                    <span>{post.likeCount} ❤ · {post.viewCount} views</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {!loading && filteredPosts.length === 0 && <div className="mt-6 rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">No hay publicaciones para este filtro.</div>}
          {loading && <div className="py-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-fuchsia-500" /></div>}
        </article>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {["Serie semanal premium", "Post gratuito de entrada", "Campaña de renovación"].map((idea) => (
          <div key={idea} className="rounded-2xl border border-slate-100 bg-white p-4 text-sm shadow-sm">
            <p className="font-semibold text-slate-800">{idea}</p>
            <p className="mt-1 text-xs text-slate-500">Sugerencia operativa para mantener constancia y conversión.</p>
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> Lista para ejecutar</p>
          </div>
        ))}
      </section>
    </div>
  );
}
