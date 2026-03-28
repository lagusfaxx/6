"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Heart,
  Lock,
  Play,
  Users,
} from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../lib/api";

type Creator = {
  id: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  subscriberCount: number;
  totalPosts: number;
  totalLikes: number;
  user: { username: string; isVerified: boolean };
};

type Plan = { id: string; tier: string; name: string; priceCLP: number; maxSlots: number };
type FeedItem = {
  id: string;
  caption: string | null;
  visibility: "FREE" | "PREMIUM";
  creator: { id?: string; displayName: string; avatarUrl: string | null; user?: { username: string } };
  media: { id: string; type: string; url: string | null }[];
};

const FALLBACK_CREATORS: Creator[] = [
  { id: "c1", displayName: "Martina V", bio: "Lifestyle premium y contenido diario.", avatarUrl: null, coverUrl: null, subscriberCount: 210, totalPosts: 142, totalLikes: 1960, user: { username: "martinavip", isVerified: true } },
  { id: "c2", displayName: "Niki Rose", bio: "Backstage, reels y comunidad privada.", avatarUrl: null, coverUrl: null, subscriberCount: 175, totalPosts: 118, totalLikes: 1488, user: { username: "nikirose", isVerified: true } },
  { id: "c3", displayName: "Naya Luna", bio: "Contenido curado + lives para fans.", avatarUrl: null, coverUrl: null, subscriberCount: 132, totalPosts: 95, totalLikes: 1170, user: { username: "nayaluna", isVerified: false } },
  { id: "c4", displayName: "Dana Bloom", bio: "Editorial, estilo y experiencias exclusivas.", avatarUrl: null, coverUrl: null, subscriberCount: 255, totalPosts: 178, totalLikes: 2512, user: { username: "danabloom", isVerified: true } },
  { id: "c5", displayName: "Sofi K", bio: "Cercanía real con tu creadora favorita.", avatarUrl: null, coverUrl: null, subscriberCount: 104, totalPosts: 80, totalLikes: 980, user: { username: "sofik", isVerified: false } },
  { id: "c6", displayName: "Valen M", bio: "Premium drops semanales.", avatarUrl: null, coverUrl: null, subscriberCount: 121, totalPosts: 89, totalLikes: 1054, user: { username: "valenm", isVerified: true } },
  { id: "c7", displayName: "Jade Noir", bio: "Comunidad activa y contenido exclusivo.", avatarUrl: null, coverUrl: null, subscriberCount: 167, totalPosts: 111, totalLikes: 1380, user: { username: "jadenoir", isVerified: true } },
  { id: "c8", displayName: "Mia Fox", bio: "Contenido premium y conexión constante.", avatarUrl: null, coverUrl: null, subscriberCount: 192, totalPosts: 134, totalLikes: 1658, user: { username: "miafox", isVerified: false } },
];

const FALLBACK_FEED: FeedItem[] = [
  { id: "f1", caption: "Nuevo drop detrás de cámaras", visibility: "FREE", creator: { displayName: "Martina V", avatarUrl: null }, media: [] },
  { id: "f2", caption: "Sesión premium exclusiva.", visibility: "PREMIUM", creator: { displayName: "Dana Bloom", avatarUrl: null }, media: [] },
  { id: "f3", caption: "Preview contenido del fin de semana.", visibility: "FREE", creator: { displayName: "Niki Rose", avatarUrl: null }, media: [] },
  { id: "f4", caption: "Pack premium desbloqueado.", visibility: "PREMIUM", creator: { displayName: "Jade Noir", avatarUrl: null }, media: [] },
  { id: "f5", caption: "Stories exclusivas para mi comunidad.", visibility: "PREMIUM", creator: { displayName: "Mia Fox", avatarUrl: null }, media: [] },
  { id: "f6", caption: "Clip gratis + acceso al contenido completo.", visibility: "FREE", creator: { displayName: "Naya Luna", avatarUrl: null }, media: [] },
];

type CreatorFeedGroup = {
  creator: FeedItem["creator"];
  posts: FeedItem[];
};

/* ── Animated floating orbs background ── */
function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Large slow-moving orbs */}
      <div className="absolute -top-32 -left-32 h-[600px] w-[600px] rounded-full bg-[#00aff0]/[0.04] blur-[120px] animate-[float-slow_25s_ease-in-out_infinite]" />
      <div className="absolute top-1/3 -right-48 h-[500px] w-[500px] rounded-full bg-purple-600/[0.04] blur-[140px] animate-[float-slow_30s_ease-in-out_infinite_reverse]" />
      <div className="absolute -bottom-24 left-1/3 h-[450px] w-[450px] rounded-full bg-cyan-500/[0.03] blur-[130px] animate-[float-drift_20s_ease-in-out_infinite]" />

      {/* Smaller accent orbs */}
      <div className="absolute top-[20%] left-[15%] h-[200px] w-[200px] rounded-full bg-[#00aff0]/[0.06] blur-[80px] animate-[float-drift_15s_ease-in-out_infinite_2s]" />
      <div className="absolute top-[60%] right-[20%] h-[180px] w-[180px] rounded-full bg-pink-500/[0.04] blur-[90px] animate-[float-slow_18s_ease-in-out_infinite_4s]" />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Gradient noise texture */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a12]/50 to-[#0a0a12]" />
    </div>
  );
}

/* ── Auto-rotating media card per creator (BLUR FIXED) ── */
function AutoRotateCard({ group }: { group: CreatorFeedGroup }) {
  const [current, setCurrent] = useState(0);
  const posts = group.posts;

  useEffect(() => {
    if (posts.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % posts.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [posts.length]);

  const post = posts[current];
  const username = group.creator.user?.username || "";
  const isPremium = post?.visibility === "PREMIUM";

  return (
    <Link
      href={username ? `/umate/profile/${username}` : "/umate/explore"}
      className="group w-[280px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm transition-all duration-500 hover:border-[#00aff0]/20 hover:shadow-[0_8px_40px_rgba(0,175,240,0.1)] hover:-translate-y-1 md:w-[300px]"
    >
      {/* Creator header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/[0.1] bg-white/[0.06] ring-2 ring-transparent group-hover:ring-[#00aff0]/20 transition-all duration-500">
          {group.creator.avatarUrl ? (
            <img src={resolveMediaUrl(group.creator.avatarUrl) || ""} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm font-bold text-white/40">{(group.creator.displayName || "?")[0]}</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white/90 truncate">{group.creator.displayName}</p>
          <p className="text-[10px] text-white/30">{posts.length} publicacion{posts.length > 1 ? "es" : ""}</p>
        </div>
      </div>

      {/* Auto-rotating media — blur rendered conditionally, not as overlay */}
      <div className="relative aspect-[4/5] overflow-hidden bg-white/[0.03]">
        {isPremium ? (
          /* PREMIUM: Only render blurred version — never show clear image */
          <div className="relative h-full w-full">
            {post.media[0]?.url ? (
              <img
                src={resolveMediaUrl(post.media[0].url) || ""}
                alt=""
                className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl brightness-75 saturate-150"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#00aff0]/30 via-purple-600/20 to-rose-500/15" />
            )}
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="rounded-2xl bg-white/[0.12] p-4 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                <Lock className="h-7 w-7 text-white/80" />
              </div>
              <p className="mt-3 text-sm font-bold text-white drop-shadow-lg">Premium</p>
              <p className="mt-1 text-[11px] text-white/50">Suscribete para ver</p>
            </div>
          </div>
        ) : post?.media[0]?.url ? (
          /* FREE with media */
          post.media[0].type === "VIDEO" ? (
            <video src={resolveMediaUrl(post.media[0].url) || ""} muted playsInline preload="metadata" crossOrigin="anonymous" className="h-full w-full object-cover transition-opacity duration-700" />
          ) : (
            <img key={post.id} src={resolveMediaUrl(post.media[0].url) || ""} alt="" className="h-full w-full object-cover transition-opacity duration-700" />
          )
        ) : (
          /* No media placeholder */
          <div className="h-full w-full bg-gradient-to-br from-[#00aff0]/15 via-purple-600/10 to-pink-500/10" />
        )}

        {!isPremium && (
          <span className="absolute left-2 top-2 rounded-md bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
            Gratis
          </span>
        )}

        {/* Dots */}
        {posts.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {posts.map((_, i) => (
              <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === current ? "w-4 bg-[#00aff0]" : "w-1 bg-white/30"}`} />
            ))}
          </div>
        )}
      </div>

      {/* Caption */}
      {post?.caption && (
        <div className="px-4 py-2.5">
          <p className="text-xs text-white/45 line-clamp-2">{post.caption}</p>
        </div>
      )}
    </Link>
  );
}

/* ── Reusable horizontal carousel ── */
function Carousel({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir * ref.current.offsetWidth * 0.7, behavior: "smooth" });
  };
  return (
    <div className="group/carousel relative">
      <div
        ref={ref}
        className={`flex gap-4 overflow-x-auto scroll-smooth scrollbar-hide snap-x snap-mandatory ${className || ""}`}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => scroll(-1)}
        className="absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 hidden h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#0a0a12]/90 text-white/60 backdrop-blur-xl transition hover:bg-white/10 hover:text-white md:group-hover/carousel:flex"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => scroll(1)}
        className="absolute right-0 top-1/2 z-10 translate-x-1/2 -translate-y-1/2 hidden h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#0a0a12]/90 text-white/60 backdrop-blur-xl transition hover:bg-white/10 hover:text-white md:group-hover/carousel:flex"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function UmateLandingPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  useEffect(() => {
    Promise.all([
      apiFetch<{ creators: Creator[] }>("/umate/creators?limit=24").catch(() => null),
      apiFetch<{ plans: Plan[] }>("/umate/plans").catch(() => null),
      apiFetch<{ items: FeedItem[] }>("/umate/feed?limit=18").catch(() => null),
    ]).then(([c, p, f]) => {
      setCreators(c?.creators || []);
      setPlans(p?.plans || []);
      setFeed(f?.items || []);
    });
  }, []);

  const catalogCreators = useMemo(() => (creators.length > 0 ? creators : FALLBACK_CREATORS), [creators]);
  const catalogFeed = useMemo(() => (feed.length > 0 ? feed : FALLBACK_FEED), [feed]);

  const featuredCreators = catalogCreators.slice(0, 8);

  const feedByCreator = useMemo<CreatorFeedGroup[]>(() => {
    const map = new Map<string, CreatorFeedGroup>();
    for (const item of catalogFeed) {
      const key = item.creator.displayName;
      if (!map.has(key)) {
        map.set(key, { creator: item.creator, posts: [] });
      }
      map.get(key)!.posts.push(item);
    }
    return Array.from(map.values());
  }, [catalogFeed]);

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />

      {/* ═══ Compact Hero ═══ */}
      <section className="relative pt-8 pb-6 lg:pt-14 lg:pb-10">
        <div className="mx-auto max-w-[1170px] px-4">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl lg:text-4xl">
                Bienvenido a{" "}
                <span className="bg-gradient-to-r from-[#00aff0] via-[#00c4ff] to-cyan-400 bg-clip-text text-transparent">
                  U-Mate
                </span>
              </h1>
              <p className="mt-2 max-w-md text-sm text-white/40">
                Descubre contenido exclusivo de creadoras que te importan.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/umate/explore"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_24px_rgba(0,175,240,0.25)] transition-all duration-300 hover:shadow-[0_8px_36px_rgba(0,175,240,0.4)] hover:-translate-y-0.5"
              >
                Explorar <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/umate/onboarding"
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-2.5 text-sm font-medium text-white/50 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:text-white hover:bg-white/[0.05]"
              >
                Ser creadora
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Creadoras destacadas ═══ */}
      <section className="relative py-10 lg:py-14">
        <div className="mx-auto max-w-[1170px] px-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">Creadoras destacadas</h2>
              <p className="mt-1.5 text-sm text-white/40">Perfiles activos con contenido exclusivo</p>
            </div>
            <Link href="/umate/creators" className="flex items-center gap-1 text-sm font-medium text-[#00aff0] transition hover:text-[#00aff0]/80">
              Ver todas <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8">
            <Carousel>
              {featuredCreators.map((c) => (
                <Link
                  key={c.id}
                  href={`/umate/profile/${c.user.username}`}
                  className="group w-[260px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm transition-all duration-500 hover:border-[#00aff0]/20 hover:bg-white/[0.04] hover:shadow-[0_8px_40px_rgba(0,175,240,0.08)] hover:-translate-y-1 md:w-[280px]"
                >
                  <div className="relative aspect-[3/2] overflow-hidden bg-white/[0.03]">
                    {c.coverUrl ? (
                      <img src={resolveMediaUrl(c.coverUrl) || ""} alt={c.displayName} className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-[#00aff0]/10 to-purple-500/10" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent" />
                    {c.user.isVerified && (
                      <span className="absolute right-2 top-2 rounded-full bg-black/50 p-1 backdrop-blur-sm">
                        <BadgeCheck className="h-3.5 w-3.5 text-[#00aff0]" />
                      </span>
                    )}
                  </div>
                  <div className="-mt-6 relative px-4 pb-4">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-white/20 bg-white/10 ring-2 ring-transparent group-hover:ring-[#00aff0]/20 transition-all duration-500">
                      {c.avatarUrl ? (
                        <img src={resolveMediaUrl(c.avatarUrl) || ""} alt={c.displayName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-white/[0.08] text-sm font-bold text-white/60">{(c.displayName || "?")[0]}</div>
                      )}
                    </div>
                    <h3 className="mt-2 text-sm font-bold text-white">{c.displayName}</h3>
                    <p className="text-[11px] text-white/40">@{c.user.username}</p>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/40">{c.bio || "Contenido exclusivo"}</p>
                    <div className="mt-3 flex items-center gap-3 text-[11px] text-white/45">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.subscriberCount}</span>
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {c.totalLikes}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </Carousel>
          </div>
        </div>
      </section>

      {/* ═══ Contenido reciente ═══ */}
      <section className="relative py-10 lg:py-14">
        <div className="mx-auto max-w-[1170px] px-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">Contenido reciente</h2>
              <p className="mt-1.5 text-sm text-white/40">Lo ultimo de tus creadoras</p>
            </div>
            <Link href="/umate/explore" className="flex items-center gap-1 text-sm font-medium text-[#00aff0] transition hover:text-[#00aff0]/80">
              Ver feed <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6">
            <Carousel>
              {feedByCreator.map((group) => (
                <AutoRotateCard key={group.creator.displayName} group={group} />
              ))}
            </Carousel>
          </div>
        </div>
      </section>

      {/* ═══ Minimal CTA ═══ */}
      <section className="relative py-10 lg:py-16">
        <div className="mx-auto max-w-[1170px] px-4">
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-8 text-center lg:p-12">
            {/* Animated accent inside CTA */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-[300px] w-[500px] rounded-full bg-[#00aff0]/[0.05] blur-[100px] animate-[float-drift_12s_ease-in-out_infinite]" />
            </div>

            <h2 className="relative text-xl font-extrabold tracking-tight text-white md:text-2xl">
              Tu proxima comunidad favorita esta aqui.
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-sm text-white/40">
              Explora creadoras, desbloquea contenido premium y conecta.
            </p>
            <div className="relative mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/umate/explore"
                className="rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-6 py-3 text-sm font-bold text-white shadow-[0_4px_24px_rgba(0,175,240,0.25)] transition-all duration-300 hover:shadow-[0_8px_36px_rgba(0,175,240,0.4)] hover:-translate-y-0.5"
              >
                Explorar ahora
              </Link>
              <Link
                href="/umate/onboarding"
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-6 py-3 text-sm font-medium text-white/40 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:text-white hover:bg-white/[0.05]"
              >
                Crear perfil de creadora
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
