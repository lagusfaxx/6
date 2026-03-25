"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  BadgeCheck,
  Calendar,
  CheckCircle,
  Eye,
  Grid3X3,
  Heart,
  ImageIcon,
  Loader2,
  Lock,
  MessageCircle,
  Shield,
  Share2,
  Star,
  Users,
} from "lucide-react";
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
    apiFetch<{ creator: any }>("/umate/creator/me")
      .then((d) => setIsCreatorUser(Boolean(d?.creator && d.creator.status !== "SUSPENDED")))
      .catch(() => {});
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
  const premiumCount = posts.filter((p) => p.visibility === "PREMIUM").length;
  const freeCount = posts.filter((p) => p.visibility === "FREE").length;

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" /></div>;
  if (!creator) return <div className="py-24 text-center text-slate-500">Perfil no encontrado.</div>;

  return (
    <div className="min-h-screen pb-10">
      {/* Cover */}
      <div className="relative h-52 overflow-hidden bg-gradient-to-br from-fuchsia-200 via-rose-100 to-orange-200 md:h-72 lg:h-80">
        {creator.coverUrl && <img src={creator.coverUrl} alt="" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>

      {/* Profile card */}
      <div className="mx-auto max-w-[1320px] px-4 lg:px-6">
        <div className="-mt-16 rounded-3xl border border-slate-100 bg-white p-5 shadow-xl shadow-slate-200/50 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
            {/* Avatar */}
            <div className="-mt-16 h-28 w-28 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-xl md:-mt-20 md:h-32 md:w-32">
              {creator.avatarUrl ? (
                <img src={creator.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center bg-fuchsia-50 text-3xl font-black text-fuchsia-600">{creator.displayName[0]}</div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 md:text-3xl">{creator.displayName}</h1>
                {creator.user.isVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-700">
                    <BadgeCheck className="h-3.5 w-3.5" /> Verificada
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-slate-500">@{creator.user.username}</p>
              {creator.bio && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">{creator.bio}</p>}

              {/* Stats */}
              <div className="mt-4 flex flex-wrap gap-3">
                <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <Eye className="h-4 w-4 text-fuchsia-500" />
                  <span className="font-black text-slate-900">{creator.totalPosts}</span>
                  <span className="text-slate-500">posts</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <Users className="h-4 w-4 text-fuchsia-500" />
                  <span className="font-black text-slate-900">{creator.subscriberCount}</span>
                  <span className="text-slate-500">suscriptores</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <Heart className="h-4 w-4 text-rose-400" />
                  <span className="font-black text-slate-900">{creator.totalLikes}</span>
                  <span className="text-slate-500">likes</span>
                </div>
              </div>
            </div>

            {/* Subscribe CTA */}
            <div className="flex shrink-0 flex-col gap-2">
              {isSubscribed ? (
                <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700 shadow-sm">
                  <CheckCircle className="h-4 w-4" /> Suscrito
                </span>
              ) : isCreatorUser ? (
                <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-600">
                  <Shield className="h-4 w-4" /> Modo creadora
                </span>
              ) : (
                <button
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-fuchsia-300/30 transition hover:brightness-105 disabled:opacity-50"
                >
                  {subscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Suscribirme</>}
                </button>
              )}
              <button className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300">
                <Share2 className="h-3.5 w-3.5" /> Compartir
              </button>
            </div>
          </div>
        </div>

        {/* Content tabs */}
        <div className="mt-6 flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-1 rounded-xl bg-slate-50 p-1">
            {(
              [
                { key: "all" as const, label: `Todos (${posts.length})` },
                { key: "free" as const, label: `Gratis (${freeCount})` },
                { key: "premium" as const, label: `Premium (${premiumCount})` },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  tab === t.key ? "bg-white text-fuchsia-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Posts grid */}
        <div className="mt-6 columns-1 gap-4 sm:columns-2 xl:columns-3">
          {filtered.map((post) => (
            <article key={post.id} className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:shadow-lg">
              {post.media[0] && (
                <div className="relative overflow-hidden bg-slate-50">
                  {post.media[0].url ? (
                    <img src={post.media[0].url} alt="" className={`w-full object-cover ${post.isBlurred ? "scale-110 blur-xl" : ""}`} />
                  ) : (
                    <div className="aspect-[4/5] w-full bg-gradient-to-br from-fuchsia-100 to-orange-100" />
                  )}
                  {post.isBlurred && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 backdrop-blur-md">
                      <div className="rounded-full bg-white p-3 shadow-xl">
                        <Lock className="h-6 w-6 text-fuchsia-600" />
                      </div>
                      <p className="mt-2 text-sm font-bold text-slate-900">Contenido premium</p>
                      <p className="text-xs text-slate-500">Suscríbete para desbloquear</p>
                    </div>
                  )}
                  {post.visibility === "PREMIUM" && !post.isBlurred && (
                    <span className="absolute right-2 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Premium</span>
                  )}
                </div>
              )}
              <div className="p-3.5">
                {post.caption && <p className="line-clamp-3 text-sm leading-relaxed text-slate-700">{post.caption}</p>}
                <div className="mt-2.5 flex items-center justify-between">
                  <button
                    onClick={() => toggleLike(post.id)}
                    className={`inline-flex items-center gap-1.5 text-sm font-semibold transition ${
                      post.isLiked ? "text-rose-500" : "text-slate-400 hover:text-rose-400"
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${post.isLiked ? "fill-current" : ""}`} /> {post.likeCount}
                  </button>
                  <span className="text-[11px] text-slate-400">{new Date(post.createdAt).toLocaleDateString("es-CL")}</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-16 text-center">
            <ImageIcon className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No hay contenido en esta categoría.</p>
            <p className="mt-1 text-xs text-slate-500">Prueba con otro filtro o vuelve más tarde.</p>
          </div>
        )}
      </div>
    </div>
  );
}
