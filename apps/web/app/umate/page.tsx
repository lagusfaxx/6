"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  Crown,
  Diamond,
  Heart,
  Lock,
  Play,
  Shield,
  Sparkles,
  Star,
  Users,
  Zap,
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
  creator: { displayName: string; avatarUrl: string | null; user?: { username: string } };
  media: { id: string; url: string | null }[];
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

  const tierIcon: Record<string, typeof Sparkles> = { SILVER: Sparkles, GOLD: Crown, DIAMOND: Diamond };
  const catalogCreators = useMemo(() => (creators.length > 0 ? creators : FALLBACK_CREATORS), [creators]);
  const catalogFeed = useMemo(() => (feed.length > 0 ? feed : FALLBACK_FEED), [feed]);

  const featuredCreators = catalogCreators.slice(0, 8);
  const heroCreator = catalogCreators[0];
  const latestContent = catalogFeed.slice(0, 6);

  return (
    <div className="space-y-0">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/[0.04] bg-gradient-to-b from-[#0d0d16] via-[#08080d] to-[#08080d] pb-16 pt-10 lg:pb-28 lg:pt-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/4 h-[600px] w-[600px] rounded-full bg-[#00aff0]/[0.035] blur-[140px]" />
          <div className="absolute -right-24 top-16 h-[450px] w-[450px] rounded-full bg-purple-600/[0.025] blur-[120px]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
        </div>

        <div className="relative mx-auto max-w-[1170px] px-4">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
            {/* Left: Copy */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-widest text-white/40">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00aff0] shadow-[0_0_6px_rgba(0,175,240,0.5)]" />
                Plataforma de suscripcion premium
              </div>

              <h1 className="mt-7 text-[2.5rem] font-extrabold leading-[1.08] tracking-[-0.02em] text-white md:text-5xl lg:text-[3.5rem]">
                Contenido exclusivo de creadoras que te{" "}
                <span className="bg-gradient-to-r from-[#00aff0] via-[#00c4ff] to-cyan-400 bg-clip-text text-transparent">importan.</span>
              </h1>
              <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-white/45 md:text-base">
                Suscríbete a tus creadoras favoritas. Desbloquea contenido premium, conecta directamente y apoya su trabajo.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/umate/explore"
                  className="inline-flex items-center gap-2 rounded-full bg-[#00aff0] px-7 py-3 text-sm font-bold text-white shadow-[0_2px_20px_rgba(0,175,240,0.3)] transition-all duration-300 hover:bg-[#00aff0]/90 hover:shadow-[0_4px_30px_rgba(0,175,240,0.4)] hover:-translate-y-px"
                >
                  Explorar creadoras <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/umate/onboarding"
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-6 py-3 text-sm font-semibold text-white/60 transition-all duration-300 hover:border-white/[0.16] hover:text-white hover:bg-white/[0.03]"
                >
                  Ser creadora
                </Link>
              </div>

              {/* Stats */}
              <div className="mt-10 flex gap-8 border-t border-white/[0.04] pt-8">
                {[
                  { value: `${Math.max(catalogCreators.length, 40)}+`, label: "Creadoras" },
                  { value: `${Math.max(catalogCreators.reduce((a, c) => a + c.subscriberCount, 0), 980).toLocaleString()}+`, label: "Suscriptores" },
                  { value: `${Math.max(catalogCreators.reduce((a, c) => a + c.totalPosts, 0), 1300).toLocaleString()}+`, label: "Publicaciones" },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-2xl font-extrabold tracking-tight text-white">{s.value}</p>
                    <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-white/40">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Featured Creators Grid */}
            <div className="relative">
              <div className="grid grid-cols-2 gap-3">
                {featuredCreators.slice(0, 4).map((c, idx) => (
                  <Link
                    key={c.id}
                    href={`/umate/profile/${c.user.username}`}
                    className={`group relative overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.02] transition-all duration-500 hover:border-white/[0.1] hover:shadow-[0_8px_40px_rgba(0,0,0,0.3)] ${
                      idx === 0 ? "col-span-2 aspect-[2/1]" : "aspect-[3/4]"
                    }`}
                  >
                    {c.coverUrl || c.avatarUrl ? (
                      <img src={resolveMediaUrl(c.coverUrl || c.avatarUrl) || ""} alt={c.displayName} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-[#00aff0]/20 via-purple-500/10 to-transparent" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 overflow-hidden rounded-full border-2 border-white/20 bg-white/10">
                          {c.avatarUrl ? <img src={resolveMediaUrl(c.avatarUrl) || ""} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs font-bold text-white">{(c.displayName || "?")[0]}</div>}
                        </div>
                        <div>
                          <p className="flex items-center gap-1 text-sm font-bold text-white">
                            {c.displayName}
                            {c.user.isVerified && <BadgeCheck className="h-3.5 w-3.5 text-[#00aff0]" />}
                          </p>
                          <p className="text-[11px] text-white/50">@{c.user.username}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Creators */}
      <section className="border-b border-white/[0.04] py-14 lg:py-20">
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

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredCreators.map((c) => (
              <Link
                key={c.id}
                href={`/umate/profile/${c.user.username}`}
                className="group overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.02] transition-all duration-300 hover:border-white/[0.1] hover:bg-white/[0.035] hover:shadow-[0_8px_40px_rgba(0,0,0,0.25)]"
              >
                <div className="relative aspect-[3/2] overflow-hidden bg-white/[0.03]">
                  {c.coverUrl ? (
                    <img src={c.coverUrl} alt={c.displayName} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
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
                  <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-[#0a0a0f] bg-[#0a0a0f]">
                    {c.avatarUrl ? (
                      <img src={c.avatarUrl} alt={c.displayName} className="h-full w-full object-cover" />
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
          </div>
        </div>
      </section>

      {/* Latest Content Feed Preview */}
      <section className="border-b border-white/[0.04] py-14 lg:py-20">
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

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latestContent.map((item) => (
              <article
                key={item.id}
                className="group overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.02] transition-all duration-300 hover:border-white/[0.1] hover:shadow-[0_8px_40px_rgba(0,0,0,0.25)]"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-white/[0.03]">
                  {item.media[0]?.url ? (
                    <img src={item.media[0].url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-white/[0.04] to-white/[0.02]" />
                  )}
                  {item.visibility === "PREMIUM" && (
                    <>
                      <div className="absolute inset-0 backdrop-blur-xl" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40">
                        <div className="rounded-full bg-white/10 p-3 backdrop-blur-sm">
                          <Lock className="h-6 w-6 text-white/80" />
                        </div>
                        <p className="text-sm font-semibold text-white/80">Contenido premium</p>
                        <Link href="/umate/plans" className="mt-1 rounded-full bg-[#00aff0] px-5 py-1.5 text-xs font-bold text-white transition hover:bg-[#00aff0]/90">
                          Suscríbete para desbloquear
                        </Link>
                      </div>
                    </>
                  )}
                  {item.visibility === "FREE" && (
                    <span className="absolute left-2 top-2 rounded-md bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
                      Gratis
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 overflow-hidden rounded-full bg-white/[0.08]">
                      {item.creator.avatarUrl && <img src={item.creator.avatarUrl} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <p className="truncate text-sm font-semibold text-white/90">{item.creator.displayName}</p>
                  </div>
                  {item.caption && <p className="mt-2 line-clamp-2 text-xs text-white/40">{item.caption}</p>}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-white/[0.04] py-14 lg:py-20">
        <div className="mx-auto max-w-[1170px] px-4">
          <h2 className="text-center text-xl font-bold tracking-tight text-white">Como funciona</h2>
          <p className="mt-2 text-center text-sm text-white/40">Tres pasos simples para empezar</p>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { step: "01", title: "Descubre", desc: "Explora un catalogo de creadoras activas con contenido exclusivo.", icon: Sparkles },
              { step: "02", title: "Suscribete", desc: "Elige un plan con cupos mensuales para acceder a contenido premium.", icon: Crown },
              { step: "03", title: "Disfruta", desc: "Desbloquea contenido, interactua y conecta con tus creadoras favoritas.", icon: Heart },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-7 transition-all duration-300 hover:border-white/[0.08] hover:bg-white/[0.03]">
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#00aff0]/[0.08]">
                    <item.icon className="h-5 w-5 text-[#00aff0]" />
                  </div>
                  <span className="text-3xl font-extrabold text-white/[0.04]">{item.step}</span>
                </div>
                <h3 className="mt-5 text-base font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/40">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans Preview */}
      <section className="border-b border-white/[0.04] py-14 lg:py-20">
        <div className="mx-auto max-w-[1170px] px-4">
          <h2 className="text-center text-xl font-bold tracking-tight text-white">Planes de suscripcion</h2>
          <p className="mt-2 text-center text-sm text-white/40">Elige el plan que se adapte a ti</p>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {(plans.length > 0 ? plans : [
              { id: "s", tier: "SILVER", name: "Silver", priceCLP: 14990, maxSlots: 1 },
              { id: "g", tier: "GOLD", name: "Gold", priceCLP: 24990, maxSlots: 3 },
              { id: "d", tier: "DIAMOND", name: "Diamond", priceCLP: 34990, maxSlots: 5 },
            ]).map((plan) => {
              const Icon = tierIcon[plan.tier] || Sparkles;
              const isPopular = plan.tier === "GOLD";
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border p-7 text-center transition-all duration-300 hover:-translate-y-1 ${
                    isPopular
                      ? "border-[#00aff0]/25 bg-[#00aff0]/[0.03] shadow-[0_8px_40px_rgba(0,175,240,0.08)]"
                      : "border-white/[0.05] bg-white/[0.02] hover:border-white/[0.08]"
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#00aff0] px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-[0_2px_12px_rgba(0,175,240,0.35)]">
                      Popular
                    </span>
                  )}
                  <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${isPopular ? "bg-[#00aff0]/15" : "bg-white/[0.06]"}`}>
                    <Icon className={`h-5 w-5 ${isPopular ? "text-[#00aff0]" : "text-white/50"}`} />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-white">{plan.name}</h3>
                  <p className="mt-2 text-3xl font-extrabold text-white">
                    ${plan.priceCLP.toLocaleString("es-CL")}
                    <span className="text-sm font-medium text-white/40">/mes</span>
                  </p>
                  <p className="mt-1 text-xs text-white/40">{plan.maxSlots} cupo{plan.maxSlots > 1 ? "s" : ""} por ciclo</p>
                  <Link
                    href="/umate/plans"
                    className={`mt-5 block rounded-full py-2.5 text-sm font-bold transition ${
                      isPopular
                        ? "bg-[#00aff0] text-white hover:bg-[#00aff0]/90"
                        : "border border-white/[0.1] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    Elegir plan
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-14 lg:py-20">
        <div className="mx-auto max-w-[1170px] px-4">
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.05] bg-gradient-to-br from-[#00aff0]/[0.06] via-purple-500/[0.03] to-[#00aff0]/[0.06] p-10 text-center lg:p-16">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/2 top-0 h-px w-1/2 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#00aff0]/25 to-transparent" />
              <div className="absolute bottom-0 left-1/4 h-[300px] w-[300px] rounded-full bg-[#00aff0]/[0.03] blur-[100px]" />
            </div>
            <h2 className="relative text-2xl font-extrabold tracking-tight text-white md:text-3xl">
              Tu próxima comunidad favorita está en U-Mate.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/40">
              Explora creadoras, desbloquea contenido premium y construye conexiones reales.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/umate/explore"
                className="rounded-full bg-[#00aff0] px-7 py-3 text-sm font-bold text-white shadow-[0_2px_20px_rgba(0,175,240,0.3)] transition-all duration-300 hover:bg-[#00aff0]/90 hover:shadow-[0_4px_30px_rgba(0,175,240,0.4)] hover:-translate-y-px"
              >
                Explorar ahora
              </Link>
              <Link
                href="/umate/onboarding"
                className="rounded-full border border-white/[0.08] px-6 py-3 text-sm font-semibold text-white/50 transition-all duration-300 hover:border-white/[0.16] hover:text-white hover:bg-white/[0.03]"
              >
                Crear perfil de creadora
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-4 text-[11px] text-white/40">
              <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Pagos seguros</span>
              <span className="flex items-center gap-1"><BadgeCheck className="h-3 w-3" /> Perfiles verificados</span>
              <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Contenido protegido</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
