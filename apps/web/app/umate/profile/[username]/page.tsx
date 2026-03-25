"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Heart, Lock, Users, Image as ImageIcon, Video, Loader2, CheckCircle, Shield, MessageCircle, Share2, Grid3X3 } from "lucide-react";
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
  const [isCreatorUser, setIsCreatorUser] = useState(false);
  const [subError, setSubError] = useState("");

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

  // Check if current user is a creator (can't subscribe)
  useEffect(() => {
    if (me?.user) {
      apiFetch<{ creator: any }>("/umate/creator/me")
        .then((d) => setIsCreatorUser(Boolean(d?.creator && d.creator.status !== "SUSPENDED")))
        .catch(() => {});
    }
  }, [me]);

  const handleSubscribe = async () => {
    if (!creator) return;
    if (isCreatorUser) {
      setSubError("Las creadoras no pueden suscribirse a perfiles.");
      return;
    }
    setSubscribing(true);
    setSubError("");
    try {
      const res = await apiFetch<{ subscribed?: boolean; error?: string }>(`/umate/creators/${creator.id}/subscribe`, { method: "POST" });
      if (res?.subscribed) {
        setIsSubscribed(true);
        const d = await apiFetch<{ creator: Creator; isSubscribed: boolean; posts: Post[] }>(`/umate/profile/${username}`);
        if (d) {
          setCreator(d.creator);
          setPosts(d.posts);
        }
      }
    } catch (err: any) {
      const errCode = err?.body?.error;
      if (errCode === "NO_PLAN") {
        window.location.href = "/umate/plans";
      } else if (errCode === "NO_SLOTS") {
        setSubError("No tienes cupos disponibles este ciclo.");
      } else if (errCode === "CREATOR_CANNOT_SUBSCRIBE") {
        setSubError("Las creadoras no pueden suscribirse a perfiles.");
      } else if (errCode === "ALREADY_SUBSCRIBED") {
        setIsSubscribed(true);
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
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-rose-400/60" /></div>;
  }

  if (!creator) {
    return <div className="py-20 text-center"><p className="text-white/40">Perfil no encontrado</p></div>;
  }

  const premiumCount = posts.filter((p) => p.visibility === "PREMIUM").length;
  const freeCount = posts.filter((p) => p.visibility === "FREE").length;

  return (
    <div className="pb-8">
      {/* Cover — full width, immersive like OnlyFans */}
      <div className="relative -mx-4 -mt-6 h-56 overflow-hidden bg-gradient-to-br from-rose-500/25 to-amber-500/15 md:h-72">
        {creator.coverUrl && (
          <img src={creator.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#08080f] via-[#08080f]/30 to-transparent" />
      </div>

      {/* Profile header — overlapping cover like OnlyFans */}
      <div className="-mt-16 relative z-10 px-4">
        <div className="flex flex-col items-center md:flex-row md:items-end md:gap-5">
          {/* Avatar */}
          <div className="relative">
            <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-[#08080f] bg-white/10 shadow-2xl md:h-32 md:w-32">
              {creator.avatarUrl ? (
                <img src={creator.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white/30">
                  {creator.displayName[0]}
                </div>
              )}
            </div>
            {creator.user.isVerified && (
              <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#08080f] ring-2 ring-[#08080f]">
                <CheckCircle className="h-5 w-5 text-rose-400" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="mt-3 flex-1 text-center md:text-left">
            <div className="flex items-center justify-center gap-2 md:justify-start">
              <h1 className="text-2xl font-extrabold">{creator.displayName}</h1>
            </div>
            <p className="text-sm text-white/35">@{creator.user.username}</p>
          </div>

          {/* Subscribe button */}
          <div className="mt-4 flex flex-col items-center gap-2 md:mt-0">
            {isSubscribed ? (
              <span className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-6 py-3 text-sm font-bold text-emerald-300">
                <CheckCircle className="h-4 w-4" /> Suscrito
              </span>
            ) : isCreatorUser ? (
              <span className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] px-6 py-3 text-sm text-white/30">
                <Shield className="h-4 w-4" /> Modo creadora
              </span>
            ) : (
              <button
                onClick={handleSubscribe}
                disabled={subscribing}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 px-8 py-3 text-sm font-bold text-white shadow-[0_0_25px_rgba(244,63,94,0.2)] transition hover:shadow-[0_0_40px_rgba(244,63,94,0.35)] disabled:opacity-50"
              >
                {subscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Suscribirse"}
              </button>
            )}
            {subError && <p className="text-xs text-red-400">{subError}</p>}
          </div>
        </div>

        {/* Bio */}
        {creator.bio && (
          <p className="mt-4 max-w-lg text-sm text-white/50 leading-relaxed md:ml-[148px]">{creator.bio}</p>
        )}

        {/* Stats bar */}
        <div className="mt-5 flex items-center justify-center gap-8 border-y border-white/[0.06] py-3 text-center md:justify-start md:ml-[148px]">
          <div>
            <p className="text-lg font-extrabold">{creator.totalPosts}</p>
            <p className="text-[10px] text-white/30">Publicaciones</p>
          </div>
          <div className="h-6 w-px bg-white/[0.06]" />
          <div>
            <p className="text-lg font-extrabold">{creator.subscriberCount}</p>
            <p className="text-[10px] text-white/30">Suscriptores</p>
          </div>
          <div className="h-6 w-px bg-white/[0.06]" />
          <div>
            <p className="text-lg font-extrabold">{creator.totalLikes}</p>
            <p className="text-[10px] text-white/30">Likes</p>
          </div>
        </div>
      </div>

      {/* Content tabs */}
      <div className="mt-6 flex items-center justify-between border-b border-white/[0.06]">
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {([
            { key: "all", label: "Todo", count: posts.length },
            { key: "photos", label: "Fotos" },
            { key: "videos", label: "Videos" },
            { key: "free", label: "Gratis", count: freeCount },
            { key: "premium", label: "Premium", count: premiumCount },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 border-b-2 px-4 py-3 text-xs font-semibold transition ${
                tab === t.key ? "border-rose-400 text-white" : "border-transparent text-white/30 hover:text-white/50"
              }`}
            >
              {t.label}
              {"count" in t && t.count !== undefined && (
                <span className="ml-1 text-[10px] text-white/20">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content — feed view like OnlyFans */}
      <div className="mt-6 mx-auto max-w-xl space-y-4">
        {filteredPosts.map((post) => (
          <div key={post.id} className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            {/* Post media */}
            {post.media[0] && (
              <div className={`relative ${post.isBlurred ? "overflow-hidden" : ""}`}>
                <div className="aspect-[4/5] bg-white/5">
                  {post.media[0].url ? (
                    post.media[0].type === "VIDEO" ? (
                      <video src={post.media[0].url} className={`h-full w-full object-cover ${post.isBlurred ? "blur-2xl scale-110" : ""}`} controls={!post.isBlurred} />
                    ) : (
                      <img src={post.media[0].url} alt="" className={`h-full w-full object-cover ${post.isBlurred ? "blur-2xl scale-110" : ""}`} />
                    )
                  ) : (
                    <div className={`h-full w-full bg-gradient-to-br from-rose-500/20 to-amber-500/10 ${post.isBlurred ? "blur-2xl" : ""}`} />
                  )}
                  {post.isBlurred && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm mb-3">
                        <Lock className="h-6 w-6 text-white/80" />
                      </div>
                      <p className="text-sm font-bold text-white">Contenido exclusivo</p>
                      <p className="mt-1 text-xs text-white/50">Usa uno de tus cupos para desbloquear</p>
                      {!isCreatorUser && (
                        <button
                          onClick={handleSubscribe}
                          disabled={subscribing}
                          className="mt-4 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg"
                        >
                          {subscribing ? <Loader2 className="h-3 w-3 animate-spin" /> : isSubscribed ? "Ya suscrito" : "Suscribirse"}
                        </button>
                      )}
                    </div>
                  )}
                  {post.visibility === "PREMIUM" && !post.isBlurred && (
                    <span className="absolute top-3 right-3 rounded-full bg-amber-500/25 px-2.5 py-0.5 text-[10px] font-bold text-amber-200 backdrop-blur-sm">PREMIUM</span>
                  )}
                  {post.media.length > 1 && (
                    <span className="absolute top-3 left-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
                      1/{post.media.length}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Post footer */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-4 mb-2">
                <button
                  onClick={() => toggleLike(post.id)}
                  className={`flex items-center gap-1.5 transition ${post.isLiked ? "text-rose-400" : "text-white/30 hover:text-rose-400"}`}
                >
                  <Heart className={`h-5 w-5 ${post.isLiked ? "fill-current" : ""}`} />
                  <span className="text-xs font-medium">{post.likeCount}</span>
                </button>
              </div>
              {post.caption && <p className="text-sm text-white/55 leading-relaxed">{post.caption}</p>}
              <p className="mt-1 text-[10px] text-white/20">
                {new Date(post.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
        ))}
      </div>

      {filteredPosts.length === 0 && (
        <div className="mx-auto max-w-xl mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-16 text-center">
          <Grid3X3 className="mx-auto mb-3 h-8 w-8 text-white/10" />
          <p className="text-sm text-white/35">No hay contenido en esta categoría</p>
        </div>
      )}
    </div>
  );
}
