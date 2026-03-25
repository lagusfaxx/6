"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Heart, Lock, Users, Image as ImageIcon, Video, Loader2, CheckCircle } from "lucide-react";
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
  viewCount: number;
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
  const [tab, setTab] = useState<"all" | "photos" | "videos" | "free" | "premium">("all");

  useEffect(() => {
    apiFetch<{ creator: Creator; isSubscribed: boolean; posts: Post[] }>(`/umate/profile/${username}`)
      .then((d) => {
        if (d) {
          setCreator(d.creator);
          setIsSubscribed(d.isSubscribed);
          setPosts(d.posts);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [username]);

  const handleSubscribe = async () => {
    if (!creator) return;
    setSubscribing(true);
    try {
      const res = await apiFetch<{ subscribed?: boolean; error?: string }>(`/umate/creators/${creator.id}/subscribe`, { method: "POST" });
      if (res?.subscribed) {
        setIsSubscribed(true);
        // Reload profile to get unblurred content
        const d = await apiFetch<{ creator: Creator; isSubscribed: boolean; posts: Post[] }>(`/umate/profile/${username}`);
        if (d) {
          setCreator(d.creator);
          setPosts(d.posts);
        }
      }
    } catch (err: any) {
      if (err?.body?.error === "NO_PLAN") {
        window.location.href = "/umate/plans";
      }
    } finally {
      setSubscribing(false);
    }
  };

  const toggleLike = useCallback(async (postId: string) => {
    const res = await apiFetch<{ liked: boolean }>(`/umate/posts/${postId}/like`, { method: "POST" });
    if (res) {
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, isLiked: res.liked, likeCount: p.likeCount + (res.liked ? 1 : -1) } : p)),
      );
    }
  }, []);

  const filteredPosts = posts.filter((p) => {
    if (tab === "photos") return p.media.some((m) => m.type === "IMAGE");
    if (tab === "videos") return p.media.some((m) => m.type === "VIDEO");
    if (tab === "free") return p.visibility === "FREE";
    if (tab === "premium") return p.visibility === "PREMIUM";
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-rose-400" />
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="py-20 text-center">
        <p className="text-white/40">Perfil no encontrado</p>
      </div>
    );
  }

  return (
    <div className="py-6">
      {/* Hero / Cover */}
      <div className="relative mb-16 h-48 overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500/20 to-amber-500/10 md:h-64">
        {creator.coverUrl && (
          <img src={creator.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#06060c] via-transparent" />
      </div>

      {/* Profile header */}
      <div className="-mt-20 relative z-10 px-4 flex flex-col items-center md:flex-row md:items-end md:gap-6">
        <div className="h-28 w-28 shrink-0 overflow-hidden rounded-full border-4 border-[#06060c] bg-white/10 shadow-xl">
          {creator.avatarUrl ? (
            <img src={creator.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white/30">
              {creator.displayName[0]}
            </div>
          )}
        </div>
        <div className="mt-3 text-center md:text-left md:flex-1">
          <div className="flex items-center justify-center gap-2 md:justify-start">
            <h1 className="text-xl font-bold">{creator.displayName}</h1>
            {creator.user.isVerified && <CheckCircle className="h-4 w-4 text-rose-400" />}
          </div>
          <p className="text-sm text-white/40">@{creator.user.username}</p>
          {creator.bio && <p className="mt-2 max-w-md text-sm text-white/60">{creator.bio}</p>}
          <div className="mt-3 flex items-center justify-center gap-5 text-xs text-white/40 md:justify-start">
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {creator.subscriberCount} suscriptores</span>
            <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {creator.totalLikes} likes</span>
            <span>{creator.totalPosts} posts</span>
          </div>
        </div>
        <div className="mt-4 md:mt-0">
          {isSubscribed ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-5 py-2.5 text-sm font-medium text-emerald-300">
              <CheckCircle className="h-4 w-4" /> Suscrito
            </span>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={subscribing}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:shadow-[0_0_20px_rgba(244,63,94,0.3)] disabled:opacity-50"
            >
              {subscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Suscribirse
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8 flex items-center gap-1 overflow-x-auto border-b border-white/[0.06] pb-px">
        {(["all", "photos", "videos", "free", "premium"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 border-b-2 px-4 py-2.5 text-xs font-medium transition ${
              tab === t ? "border-rose-400 text-white" : "border-transparent text-white/40 hover:text-white/60"
            }`}
          >
            {t === "all" && "Todo"}
            {t === "photos" && <span className="flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Fotos</span>}
            {t === "videos" && <span className="flex items-center gap-1"><Video className="h-3 w-3" /> Videos</span>}
            {t === "free" && "Gratis"}
            {t === "premium" && "Premium"}
          </button>
        ))}
      </div>

      {/* Content grid */}
      <div className="mt-6 columns-2 gap-4 sm:columns-3">
        {filteredPosts.map((post) => (
          <div key={post.id} className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
            {post.media[0] && (
              <div className={`relative aspect-[3/4] bg-white/5 ${post.isBlurred ? "overflow-hidden" : ""}`}>
                {post.media[0].url ? (
                  <img src={post.media[0].url} alt="" className={`h-full w-full object-cover ${post.isBlurred ? "blur-xl scale-110" : ""}`} />
                ) : (
                  <div className={`h-full w-full bg-gradient-to-br from-rose-500/20 to-amber-500/10 ${post.isBlurred ? "blur-xl" : ""}`} />
                )}
                {post.isBlurred && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 p-4 text-center">
                    <Lock className="mb-2 h-6 w-6 text-rose-400" />
                    <p className="text-xs font-semibold">Contenido premium</p>
                    <button
                      onClick={handleSubscribe}
                      className="mt-2 rounded-lg bg-rose-500/20 px-3 py-1 text-[10px] font-medium text-rose-300 transition hover:bg-rose-500/30"
                    >
                      Usa uno de tus cupos
                    </button>
                  </div>
                )}
                {post.visibility === "PREMIUM" && !post.isBlurred && (
                  <span className="absolute top-2 right-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-300">PREMIUM</span>
                )}
              </div>
            )}
            <div className="p-3">
              {post.caption && <p className="text-[11px] text-white/50 line-clamp-2">{post.caption}</p>}
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={() => toggleLike(post.id)}
                  className={`flex items-center gap-1 text-[10px] transition ${post.isLiked ? "text-rose-400" : "text-white/30 hover:text-rose-400"}`}
                >
                  <Heart className={`h-3.5 w-3.5 ${post.isLiked ? "fill-current" : ""}`} />
                  {post.likeCount}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredPosts.length === 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <p className="text-sm text-white/40">No hay contenido en esta categoría aún.</p>
        </div>
      )}
    </div>
  );
}
