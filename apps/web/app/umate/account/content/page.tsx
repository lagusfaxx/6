"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, Trash2, Image as ImageIcon, Lock, Globe, Loader2 } from "lucide-react";
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

export default function ContentPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<"FREE" | "PREMIUM">("FREE");
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    apiFetch<{ posts: Post[] }>("/umate/creator/posts")
      .then((d) => setPosts(d?.posts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handlePublish = async () => {
    if (!selectedFiles.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      selectedFiles.forEach((f) => form.append("files", f));
      form.append("caption", caption);
      form.append("visibility", visibility);

      const res = await fetch(`${getApiBase()}/umate/posts`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json();
      if (data?.post) {
        setPosts((prev) => [data.post, ...prev]);
        setCaption("");
        setSelectedFiles([]);
        setVisibility("FREE");
      }
    } catch {}
    setUploading(false);
  };

  const handleDelete = async (postId: string) => {
    await apiFetch(`/umate/posts/${postId}`, { method: "DELETE" });
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  return (
    <div className="mx-auto max-w-2xl py-8 space-y-8">
      <h1 className="text-xl font-bold tracking-tight">Mi contenido</h1>

      {/* Create post */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-4">
        <h2 className="text-sm font-semibold">Nueva publicación</h2>

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Escribe un caption..."
          rows={2}
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-rose-500/30 focus:outline-none resize-none"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={() => setVisibility(visibility === "FREE" ? "PREMIUM" : "FREE")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              visibility === "PREMIUM"
                ? "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
            }`}
          >
            {visibility === "PREMIUM" ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
            {visibility === "PREMIUM" ? "Premium" : "Gratis"}
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/50 hover:text-white/70 transition"
          >
            <ImageIcon className="h-3 w-3" />
            {selectedFiles.length > 0 ? `${selectedFiles.length} archivo(s)` : "Agregar archivos"}
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
          />
        </div>

        {/* Preview thumbnails */}
        {selectedFiles.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {selectedFiles.map((f, i) => (
              <div key={i} className="relative h-16 w-16 rounded-lg bg-white/5 overflow-hidden">
                <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handlePublish}
          disabled={uploading || !selectedFiles.length}
          className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          {uploading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Publicar"}
        </button>
      </div>

      {/* Posts list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-rose-400" /></div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <p className="text-sm text-white/40">Aún no has publicado nada.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
              {post.media[0] && (
                <div className="relative h-48 bg-white/5">
                  <img src={post.media[0].url} alt="" className="h-full w-full object-cover" />
                  <span className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                    post.visibility === "PREMIUM" ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"
                  }`}>
                    {post.visibility}
                  </span>
                  {post.media.length > 1 && (
                    <span className="absolute top-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[9px] text-white">
                      +{post.media.length - 1}
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between p-3">
                <div>
                  {post.caption && <p className="text-xs text-white/60 line-clamp-1">{post.caption}</p>}
                  <p className="text-[10px] text-white/30">
                    {post.likeCount} likes · {new Date(post.createdAt).toLocaleDateString("es-CL")}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(post.id)}
                  className="rounded-lg p-2 text-white/20 hover:bg-red-500/10 hover:text-red-400 transition"
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
