"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  Crown,
  Diamond,
  Eye,
  Heart,
  Lock,
  Play,
  Shield,
  Sparkles,
  Star,
  Users,
  Zap,
} from "lucide-react";
import { apiFetch } from "../../lib/api";

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
  { id: "f1", caption: "Nuevo drop detrás de cámaras ✨", visibility: "FREE", creator: { displayName: "Martina V", avatarUrl: null }, media: [] },
  { id: "f2", caption: "Sesión premium exclusiva para suscriptoras.", visibility: "PREMIUM", creator: { displayName: "Dana Bloom", avatarUrl: null }, media: [] },
  { id: "f3", caption: "Preview de contenido del fin de semana.", visibility: "FREE", creator: { displayName: "Niki Rose", avatarUrl: null }, media: [] },
  { id: "f4", caption: "Pack premium desbloqueado para miembros.", visibility: "PREMIUM", creator: { displayName: "Jade Noir", avatarUrl: null }, media: [] },
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
      apiFetch<{ items: FeedItem[] }>("/umate/feed?limit=12").catch(() => null),
    ]).then(([c, p, f]) => {
      setCreators(c?.creators || []);
      setPlans(p?.plans || []);
      setFeed(f?.items || []);
    });
  }, []);

  const tierIcon: Record<string, typeof Sparkles> = { SILVER: Sparkles, GOLD: Crown, DIAMOND: Diamond };
  const catalogCreators = useMemo(() => (creators.length > 0 ? creators : FALLBACK_CREATORS), [creators]);
  const catalogFeed = useMemo(() => (feed.length > 0 ? feed : FALLBACK_FEED), [feed]);
  const heroCreators = useMemo(() => catalogCreators.slice(0, 6), [catalogCreators]);
  const featuredCreators = useMemo(() => catalogCreators.slice(0, 8), [catalogCreators]);
  const latestContent = useMemo(() => catalogFeed.slice(0, 8), [catalogFeed]);

  const totalSubscribers = Math.max(catalogCreators.reduce((acc, c) => acc + c.subscriberCount, 0), 340);
  const totalPosts = Math.max(catalogCreators.reduce((acc, c) => acc + c.totalPosts, 0), 520);
  const totalLikes = Math.max(catalogCreators.reduce((acc, c) => acc + c.totalLikes, 0), 1200);
  const premiumPieces = Math.max(catalogFeed.filter((item) => item.visibility === "PREMIUM").length, 12);

  return (
    <div className="space-y-0 bg-gradient-to-b from-[#fffefd] via-white to-[#fff9f8]">
      <section className="relative overflow-hidden border-b border-fuchsia-100/60 bg-gradient-to-b from-fuchsia-50/90 via-white to-[#fff8f6] pb-12 pt-6 lg:pb-16 lg:pt-10">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-20 -top-24 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-fuchsia-200/35 to-rose-100/20 blur-[90px]" />
          <div className="absolute -left-20 top-24 h-[320px] w-[320px] rounded-full bg-gradient-to-br from-orange-200/30 to-amber-100/20 blur-[75px]" />
        </div>

        <div className="relative mx-auto max-w-[1320px] px-4 lg:px-6">
          <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200/80 bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur">
                <img src="/brand/Umate.png" alt="U-Mate" className="h-5 w-auto" />
                <span className="text-xs font-bold text-fuchsia-700">Discovery + suscripción en una sola plataforma</span>
              </div>

              <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight text-slate-900 md:text-6xl lg:text-[4rem]">
                Descubre creadoras premium,
                <span className="bg-gradient-to-r from-fuchsia-600 via-rose-500 to-orange-500 bg-clip-text text-transparent"> suscríbete y conéctate de verdad.</span>
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 md:text-lg">
                U-Mate reúne catálogo vivo, contenido gratuito + premium y planes flexibles para convertir visitas en comunidad activa.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/umate/explore" className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-rose-500 to-orange-500 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-fuchsia-500/25 transition hover:brightness-105">
                  Explorar creadoras <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/umate/onboarding" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-fuchsia-200 hover:text-fuchsia-700">
                  Unirme como creadora
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-5 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5"><Shield className="h-4 w-4 text-emerald-500" /> Pagos seguros</span>
                <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-sky-500" /> Perfiles verificados</span>
                <span className="inline-flex items-center gap-1.5"><Heart className="h-4 w-4 text-rose-500" /> +{totalLikes.toLocaleString()} likes</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {heroCreators.map((c, idx) => (
                <Link
                  key={c.id}
                  href={`/umate/profile/${c.user.username}`}
                  className={`group relative overflow-hidden rounded-2xl border border-white/60 bg-slate-100 shadow-lg transition duration-500 hover:scale-[1.02] hover:shadow-xl ${idx === 0 || idx === 3 ? "col-span-2 aspect-[5/4]" : "aspect-[3/4]"}`}
                >
                  {c.coverUrl || c.avatarUrl ? (
                    <img src={c.coverUrl || c.avatarUrl || ""} alt={c.displayName} className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-fuchsia-200 to-orange-200" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="truncate text-sm font-bold text-white">{c.displayName}</p>
                    <p className="text-[11px] text-white/80">@{c.user.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-100 bg-white py-4">
        <div className="mx-auto grid max-w-[1320px] gap-3 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
          {[
            { label: "Creadoras activas", value: `${Math.max(catalogCreators.length, 25)}+`, icon: Users },
            { label: "Publicaciones", value: `${totalPosts.toLocaleString()}+`, icon: Eye },
            { label: "Suscriptores", value: `${totalSubscribers.toLocaleString()}+`, icon: Heart },
            { label: "Piezas premium", value: `${premiumPieces}+`, icon: Crown },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-100">
                <item.icon className="h-5 w-5 text-fuchsia-600" />
              </div>
              <div>
                <p className="text-lg font-black text-slate-900">{item.value}</p>
                <p className="text-xs text-slate-500">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-[1320px] px-4 lg:px-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-fuchsia-50 px-3 py-1 text-[11px] font-bold text-fuchsia-700">
                <Star className="h-3 w-3" /> Creadoras destacadas
              </span>
              <h2 className="mt-3 text-3xl font-black text-slate-900">Catálogo en crecimiento, comunidad en movimiento</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">Explora perfiles activos con publicaciones constantes, engagement real y experiencias exclusivas para fans.</p>
            </div>
            <Link href="/umate/creators" className="hidden items-center gap-1 text-sm font-bold text-fuchsia-700 transition hover:gap-2 md:flex">
              Ver catálogo completo <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredCreators.map((c) => (
              <Link key={c.id} href={`/umate/profile/${c.user.username}`} className="group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-fuchsia-100/60">
                <div className="relative h-40 overflow-hidden bg-gradient-to-br from-fuchsia-100 to-orange-50">
                  {c.coverUrl ? <img src={c.coverUrl} alt={c.displayName} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="h-full w-full bg-gradient-to-br from-fuchsia-200/80 to-orange-200/70" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                  {c.user.isVerified && (
                    <span className="absolute right-2.5 top-2.5 rounded-full bg-white/90 p-1 shadow-sm backdrop-blur">
                      <BadgeCheck className="h-4 w-4 text-sky-500" />
                    </span>
                  )}
                </div>
                <div className="-mt-7 px-4 pb-4">
                  <div className="h-14 w-14 overflow-hidden rounded-xl border-[3px] border-white bg-white shadow-md">
                    {c.avatarUrl ? <img src={c.avatarUrl} alt={c.displayName} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-fuchsia-50 text-sm font-bold text-fuchsia-600">{c.displayName[0]}</div>}
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-slate-900">{c.displayName}</h3>
                  <p className="text-xs text-slate-500">@{c.user.username}</p>
                  <p className="mt-1.5 line-clamp-2 min-h-9 text-xs leading-relaxed text-slate-600">{c.bio || "Contenido exclusivo, comunidad cercana y actividad constante."}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 font-semibold"><Users className="h-3 w-3 text-fuchsia-500" />{c.subscriberCount}</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 font-semibold"><Heart className="h-3 w-3 text-rose-400" />{c.totalLikes}</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 font-semibold"><Eye className="h-3 w-3 text-sky-400" />{c.totalPosts}</span>
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-fuchsia-700">Ver perfil <ChevronRight className="h-3.5 w-3.5" /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-white py-12 lg:py-14">
        <div className="mx-auto max-w-[1320px] px-4 lg:px-6">
          <div className="mb-7 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-slate-900">Cómo funciona</h2>
              <p className="mt-1 text-sm text-slate-500">Entra, elige y desbloquea en minutos.</p>
            </div>
            <Link href="/umate/plans" className="text-sm font-bold text-fuchsia-700">Ver planes</Link>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { step: "01", title: "Explora", desc: "Recorre creadoras por estilo, actividad y tipo de contenido.", icon: Sparkles, color: "from-fuchsia-500 to-rose-500" },
              { step: "02", title: "Elige plan", desc: "Activa tu suscripción con cupos mensuales para perfiles premium.", icon: Crown, color: "from-amber-500 to-orange-500" },
              { step: "03", title: "Desbloquea", desc: "Accede a contenido exclusivo y conecta con su comunidad VIP.", icon: Heart, color: "from-rose-500 to-pink-500" },
            ].map((item) => (
              <article key={item.step} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
                <div className="flex items-center justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-r ${item.color} text-white shadow-lg`}><item.icon className="h-5 w-5" /></div>
                  <span className="text-2xl font-black text-slate-200">{item.step}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{item.title}</h3>
                <p className="mt-1.5 text-sm text-slate-600">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-[1320px] px-4 lg:px-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-700">
                <Play className="h-3 w-3" /> Contenido reciente
              </span>
              <h2 className="mt-3 text-3xl font-black text-slate-900">Preview vivo del feed</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-500">Descubre una mezcla de piezas gratis y premium para entrar al descubrimiento continuo.</p>
            </div>
            <Link href="/umate/explore" className="hidden items-center gap-1 text-sm font-bold text-fuchsia-700 transition hover:gap-2 md:flex">
              Ir al feed <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {latestContent.map((item) => (
              <article key={item.id} className="group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:shadow-lg">
                <div className="relative aspect-[4/5] overflow-hidden bg-slate-100">
                  {item.media[0]?.url ? <img src={item.media[0].url} alt={item.caption || "Publicación"} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="h-full w-full bg-gradient-to-br from-fuchsia-100 to-orange-100" />}
                  {item.visibility === "PREMIUM" && (
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-bold text-white">
                      <Lock className="h-3 w-3" /> Premium
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 overflow-hidden rounded-full bg-fuchsia-100">
                      {item.creator.avatarUrl ? <img src={item.creator.avatarUrl} alt={item.creator.displayName} className="h-full w-full object-cover" /> : null}
                    </div>
                    <p className="truncate text-xs font-bold text-slate-900">{item.creator.displayName}</p>
                    <span className={`ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-bold ${item.visibility === "FREE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {item.visibility === "FREE" ? "Gratis" : "Premium"}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-600">{item.caption || "Nuevo contenido disponible en el feed de discovery."}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-[1320px] px-4 lg:px-6">
          <div className="overflow-hidden rounded-3xl border border-amber-100/80 bg-gradient-to-br from-white via-amber-50/50 to-orange-50/50 p-8 shadow-lg lg:p-12">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800">
                <Crown className="h-3 w-3" /> Planes de suscripción
              </span>
              <h2 className="mt-4 text-3xl font-black text-slate-900">Sube de nivel tu experiencia</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">Después de descubrir creadoras y contenido, activa el plan que mejor encaja con tu ritmo.</p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {plans.map((plan) => {
                const Icon = tierIcon[plan.tier] || Sparkles;
                const isPopular = plan.tier === "GOLD";
                return (
                  <div key={plan.id} className={`relative rounded-2xl border bg-white p-6 text-center transition hover:-translate-y-1 hover:shadow-xl ${isPopular ? "border-amber-300 shadow-lg shadow-amber-100/50 ring-1 ring-amber-200" : "border-slate-100 shadow-sm"}`}>
                    {isPopular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-lg">Popular</span>}
                    <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r text-white shadow-lg ${plan.tier === "GOLD" ? "from-amber-500 to-orange-500" : plan.tier === "DIAMOND" ? "from-violet-600 to-fuchsia-500" : "from-slate-500 to-slate-600"}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-lg font-black text-slate-900">{plan.name}</h3>
                    <p className="mt-1 text-3xl font-black text-slate-900">${plan.priceCLP.toLocaleString("es-CL")}<span className="text-sm font-semibold text-slate-400">/mes</span></p>
                    <p className="mt-1 text-xs text-slate-500">{plan.maxSlots} cupos mensuales</p>
                    <Link href="/umate/plans" className={`mt-5 block rounded-xl py-2.5 text-sm font-bold transition ${isPopular ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-200/40 hover:brightness-105" : "bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100"}`}>
                      Elegir plan
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="pb-14 pt-4 lg:pb-20">
        <div className="mx-auto max-w-[1320px] px-4 lg:px-6">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-fuchsia-600 via-rose-500 to-orange-500 p-10 text-center shadow-2xl shadow-fuchsia-500/20 lg:p-14">
            <h2 className="text-3xl font-black text-white md:text-4xl">Tu próxima comunidad favorita está en U-Mate.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-white/85">Explora catálogo, descubre contenido y conviértete en suscriptor. O abre tu perfil y empieza a monetizar como creadora.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/umate/creators" className="rounded-2xl bg-white px-7 py-3.5 text-sm font-bold text-fuchsia-700 shadow-lg transition hover:shadow-xl">
                Explorar creadoras
              </Link>
              <Link href="/umate/onboarding" className="rounded-2xl border-2 border-white/40 px-6 py-3.5 text-sm font-bold text-white transition hover:border-white/70">
                Unirme como creadora
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
