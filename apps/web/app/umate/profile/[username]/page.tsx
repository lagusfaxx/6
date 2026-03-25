"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Heart, Lock, Users, Loader2, CheckCircle, Shield, Grid3X3 } from "lucide-react";
import { apiFetch } from "../../../../lib/api";
import useMe from "../../../../hooks/useMe";

type Creator = {
  id: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  subscriberCount: number;
  totalPosts: number;
  totalLikes: number;
  status: string;
  user: { username: string; isVerified: boolean };
};

type Post = {
  id: string;
  caption: string | null;
  visibility: "FREE" | "PREMIUM";
  likeCount: number;
  createdAt: string;
  media: { id: string; type: string; url: string | null; pos: number }[];
  isBlurred: boolean;
  isLiked: boolean;
};

export default function CreatorProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { me } = useMe();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [tab, setTab] = useState<"all" | "free" | "premium">("all");
  const [isCreatorUser, setIsCreatorUser] = useState(false);

  useEffect(() => {
    apiFetch<{ creator: Creator; isSubscribed: boolean; posts: Post[] }>(`/umate/profile/${username}`)
      .then((d) => {
        if (!d) return;
        setCreator(d.creator);
        setPosts(d.posts);
        setIsSubscribed(d.isSubscribed);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    if (!me?.user) return;
    apiFetch<{ creator: any }>("/umate/creator/me").then((d) => setIsCreatorUser(Boolean(d?.creator && d.creator.status !== "SUSPENDED"))).catch(() => {});
  }, [me]);

  const handleSubscribe = async () => {
    if (!creator || isCreatorUser) return;
    setSubscribing(true);
    try {
      const res = await apiFetch<{ subscribed?: boolean }>(`/umate/creators/${creator.id}/subscribe`, { method: "POST" });
      if (res?.subscribed) setIsSubscribed(true);
    } catch {
      window.location.href = "/umate/plans";
    } finally {
      setSubscribing(false);
    }
  };

  const toggleLike = async (postId: string) => {
    const res = await apiFetch<{ liked: boolean }>(`/umate/posts/${postId}/like`, { method: "POST" }).catch(() => null);
    if (!res) return;
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, isLiked: res.liked, likeCount: p.likeCount + (res.liked ? 1 : -1) } : p)));
  };

  const filtered = posts.filter((p) => (tab === "all" ? true : p.visibility.toLowerCase() === tab));

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" /></div>;
  if (!creator) return <div className="py-20 text-center text-slate-500">Perfil no encontrado.</div>;

  return (
    <div className="pb-8">
      <div className="relative h-56 overflow-hidden rounded-[2rem] border border-fuchsia-100 bg-gradient-to-br from-fuchsia-100 to-orange-100 md:h-72">
        {creator.coverUrl && <img src={creator.coverUrl} alt="" className="h-full w-full object-cover" />}
      </div>

      <div className="-mt-14 px-3 md:px-6">
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex items-end gap-4">
              <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-white bg-slate-100 shadow">
                {creator.avatarUrl ? <img src={creator.avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-bold text-slate-400">{creator.displayName[0]}</div>}
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900">{creator.displayName}</h1>
                <p className="text-sm text-slate-500">@{creator.user.username}</p>
                {creator.user.isVerified && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"><CheckCircle className="h-3.5 w-3.5" /> Verificada</span>}
              </div>
            </div>
            {isSubscribed ? (
              <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700"><CheckCircle className="h-4 w-4" />Suscrito</span>
            ) : isCreatorUser ? (
              <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600"><Shield className="h-4 w-4" />Modo creadora</span>
            ) : (
              <button onClick={handleSubscribe} className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 px-5 py-2.5 text-sm font-bold text-white">{subscribing ? "..." : "Suscribirme"}</button>
            )}
          </div>

          {creator.bio && <p className="mt-4 max-w-2xl text-sm text-slate-600">{creator.bio}</p>}

          <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl bg-slate-50 p-3 text-center">
            <div><p className="text-xl font-black text-slate-900">{creator.totalPosts}</p><p className="text-xs text-slate-500">Publicaciones</p></div>
            <div><p className="text-xl font-black text-slate-900">{creator.subscriberCount}</p><p className="text-xs text-slate-500">Suscriptores</p></div>
            <div><p className="text-xl font-black text-slate-900">{creator.totalLikes}</p><p className="text-xs text-slate-500">Likes</p></div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        {(["all", "free", "premium"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tab === t ? "bg-fuchsia-100 text-fuchsia-700" : "bg-slate-100 text-slate-600"}`}>
            {t === "all" ? "Todo" : t === "free" ? "Gratis" : "Premium"}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {filtered.map((post) => (
          <article key={post.id} className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            {post.media[0] && (
              <div className="relative aspect-[4/5] bg-slate-100">
                {post.media[0].url ? <img src={post.media[0].url} alt="" className={`h-full w-full object-cover ${post.isBlurred ? "blur-xl scale-110" : ""}`} /> : <div className="h-full w-full bg-gradient-to-br from-fuchsia-100 to-orange-100" />}
                {post.isBlurred && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-md">
                    <Lock className="h-5 w-5 text-fuchsia-600" />
                    <p className="mt-2 text-sm font-bold text-slate-900">Contenido premium</p>
                  </div>
                )}
              </div>
            )}
            <div className="p-4">
              {post.caption && <p className="text-sm text-slate-700">{post.caption}</p>}
              <button onClick={() => toggleLike(post.id)} className={`mt-2 inline-flex items-center gap-1 text-sm ${post.isLiked ? "text-rose-500" : "text-slate-500"}`}><Heart className={`h-4 w-4 ${post.isLiked ? "fill-current" : ""}`} />{post.likeCount}</button>
            </div>
          </article>
        ))}
      </div>

      {filtered.length === 0 && <div className="mt-5 rounded-3xl border border-slate-100 bg-white p-12 text-center text-slate-500"><Grid3X3 className="mx-auto mb-2 h-6 w-6 text-slate-300" />No hay contenido en esta categoría.</div>}
    </div>
  );
}
