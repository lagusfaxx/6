"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  BadgeCheck,
  Calendar,
  CheckCircle,
  Grid3X3,
  Heart,
  ImageIcon,
  Loader2,
  Lock,
  MessageCircle,
  Share2,
  Shield,
  Users,
  Video,
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
  const [tab, setTab] = useState<"all" | "free" | "premium" | "photos" | "videos">("all");
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

  const filtered = posts.filter((p) => {
    if (tab === "all") return true;
    if (tab === "free") return p.visibility === "FREE";
    if (tab === "premium") return p.visibility === "PREMIUM";
    if (tab === "photos") return p.media.some((m) => m.type === "IMAGE");
    if (tab === "videos") return p.media.some((m) => m.type === "VIDEO");
    return true;
  });

  const premiumCount = posts.filter((p) => p.visibility === "PREMIUM").length;
  const freeCount = posts.filter((p) => p.visibility === "FREE").length;

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-white/20" /></div>;
  if (!creator) return <div className="py-24 text-center text-white/30">Perfil no encontrado.</div>;

  return (
    <div className="min-h-screen">
      {/* Cover */}
      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-[#00aff0]/20 via-purple-500/10 to-transparent md:h-64 lg:h-72">
        {creator.coverUrl && <img src={creator.coverUrl} alt="" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/50 to-transparent" />
      </div>

      {/* Profile info */}
      <div className="mx-auto max-w-[700px] px-4">
        <div className="-mt-12 flex items-end gap-4">
          {/* Avatar */}
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-[#0a0a0f] bg-[#0a0a0f] md:h-28 md:w-28">
            {creator.avatarUrl ? (
              <img src={creator.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-white/[0.08] text-2xl font-bold text-white/50">{creator.displayName[0]}</div>
            )}
          </div>

          {/* Subscribe / Actions - desktop */}
          <div className="ml-auto flex items-center gap-2 pb-1">
            {isSubscribed ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-5 py-2 text-sm font-semibold text-emerald-400">
                <CheckCircle className="h-4 w-4" /> Suscrito
              </span>
            ) : isCreatorUser ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-5 py-2 text-sm font-medium text-white/40">
                <Shield className="h-4 w-4" /> Modo creadora
              </span>
            ) : (
              <button
                onClick={handleSubscribe}
                disabled={subscribing}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#00aff0] px-6 py-2 text-sm font-bold text-white shadow-lg shadow-[#00aff0]/20 transition hover:bg-[#00aff0]/90 disabled:opacity-50"
              >
                {subscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Suscribirme"}
              </button>
            )}
            <button className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] text-white/30 transition hover:border-white/20 hover:text-white/50">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Name & info */}
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-white md:text-2xl">{creator.displayName}</h1>
            {creator.user.isVerified && <BadgeCheck className="h-5 w-5 text-[#00aff0]" />}
          </div>
          <p className="text-sm text-white/30">@{creator.user.username}</p>
          {creator.bio && <p className="mt-3 text-sm leading-relaxed text-white/50">{creator.bio}</p>}

          {/* Stats row */}
          <div className="mt-4 flex gap-5 border-b border-white/[0.06] pb-4">
            <div className="text-center">
              <p className="text-base font-extrabold text-white">{creator.totalPosts}</p>
              <p className="text-[11px] text-white/25">Posts</p>
            </div>
            <div className="text-center">
              <p className="text-base font-extrabold text-white">{creator.subscriberCount}</p>
              <p className="text-[11px] text-white/25">Suscriptores</p>
            </div>
            <div className="text-center">
              <p className="text-base font-extrabold text-white">{creator.totalLikes}</p>
              <p className="text-[11px] text-white/25">Likes</p>
            </div>
          </div>
        </div>

        {/* Content tabs */}
        <div className="mt-4 flex gap-1 overflow-x-auto border-b border-white/[0.06] pb-px">
          {([
            { key: "all" as const, label: `Todos`, count: posts.length },
            { key: "photos" as const, label: "Fotos", icon: ImageIcon },
            { key: "videos" as const, label: "Videos", icon: Video },
            { key: "free" as const, label: "Gratis", count: freeCount },
            { key: "premium" as const, label: "Premium", count: premiumCount },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
                tab === t.key
                  ? "border-[#00aff0] text-[#00aff0]"
                  : "border-transparent text-white/30 hover:text-white/50"
              }`}
            >
              {t.label}
              {"count" in t && t.count !== undefined && <span className="ml-1 text-white/20">{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Posts feed - OnlyFans style (single column) */}
        <div className="mt-4 space-y-4 pb-8">
          {filtered.map((post) => (
            <article key={post.id} className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
              {/* Caption */}
              {post.caption && (
                <div className="px-4 pt-4 pb-3">
                  <p className="text-sm leading-relaxed text-white/70">{post.caption}</p>
                  <p className="mt-1.5 text-[11px] text-white/20">{new Date(post.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
              )}

              {/* Media */}
              {post.media[0] && (
                <div className="relative">
                  {post.media[0].url ? (
                    <img
                      src={post.media[0].url}
                      alt=""
                      className={`w-full object-cover ${post.isBlurred ? "scale-105 blur-2xl" : ""}`}
                      style={{ maxHeight: 600 }}
                    />
                  ) : (
                    <div className="aspect-[4/5] w-full bg-gradient-to-br from-white/[0.04] to-white/[0.02]" />
                  )}
                  {post.isBlurred && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                      <div className="rounded-full bg-white/10 p-4">
                        <Lock className="h-8 w-8 text-white/70" />
                      </div>
                      <p className="mt-3 text-sm font-bold text-white">Contenido premium</p>
                      <p className="mt-1 text-xs text-white/40">Suscríbete para desbloquear</p>
                      <Link
                        href="/umate/plans"
                        className="mt-3 rounded-full bg-[#00aff0] px-6 py-2 text-sm font-bold text-white transition hover:bg-[#00aff0]/90"
                      >
                        Incluido con tu plan U-Mate
                      </Link>
                    </div>
                  )}
                  {post.visibility === "PREMIUM" && !post.isBlurred && (
                    <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-bold text-amber-400 backdrop-blur-sm">
                      Premium
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-4 px-4 py-3">
                <button
                  onClick={() => toggleLike(post.id)}
                  className={`flex items-center gap-1.5 text-sm transition ${
                    post.isLiked ? "text-rose-500" : "text-white/30 hover:text-rose-400"
                  }`}
                >
                  <Heart className={`h-5 w-5 ${post.isLiked ? "fill-current" : ""}`} />
                  <span className="text-xs font-medium">{post.likeCount}</span>
                </button>
                <button className="flex items-center gap-1.5 text-white/30 transition hover:text-white/50">
                  <MessageCircle className="h-5 w-5" />
                </button>
              </div>
            </article>
          ))}

          {filtered.length === 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-16 text-center">
              <Grid3X3 className="mx-auto mb-3 h-8 w-8 text-white/10" />
              <p className="text-sm font-medium text-white/40">No hay contenido en esta categoría.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
