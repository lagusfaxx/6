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
  MessageCircle,
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
  { id: "c9", displayName: "Luna Mode", bio: "Drops nocturnos + lives íntimos.", avatarUrl: null, coverUrl: null, subscriberCount: 228, totalPosts: 160, totalLikes: 2211, user: { username: "lunamode", isVerified: true } },
  { id: "c10", displayName: "Mia Dark", bio: "Estética editorial y comunidad premium.", avatarUrl: null, coverUrl: null, subscriberCount: 146, totalPosts: 97, totalLikes: 1203, user: { username: "miadark", isVerified: true } },
  { id: "c11", displayName: "Alma Red", bio: "Contenido exclusivo con releases semanales.", avatarUrl: null, coverUrl: null, subscriberCount: 170, totalPosts: 109, totalLikes: 1406, user: { username: "almared", isVerified: false } },
  { id: "c12", displayName: "Cami Glow", bio: "Backstage, lifestyle y comunidad activa.", avatarUrl: null, coverUrl: null, subscriberCount: 201, totalPosts: 149, totalLikes: 1985, user: { username: "camiglow", isVerified: true } },
];

const FALLBACK_FEED: FeedItem[] = [
  { id: "f1", caption: "Nuevo drop detrás de cámaras ✨", visibility: "FREE", creator: { displayName: "Martina V", avatarUrl: null }, media: [] },
  { id: "f2", caption: "Sesión premium exclusiva para suscriptoras.", visibility: "PREMIUM", creator: { displayName: "Dana Bloom", avatarUrl: null }, media: [] },
  { id: "f3", caption: "Preview de contenido del fin de semana.", visibility: "FREE", creator: { displayName: "Niki Rose", avatarUrl: null }, media: [] },
  { id: "f4", caption: "Pack premium desbloqueado para miembros.", visibility: "PREMIUM", creator: { displayName: "Jade Noir", avatarUrl: null }, media: [] },
  { id: "f5", caption: "Stories exclusivas para mi comunidad.", visibility: "PREMIUM", creator: { displayName: "Mia Fox", avatarUrl: null }, media: [] },
  { id: "f6", caption: "Clip gratis + acceso al contenido completo.", visibility: "FREE", creator: { displayName: "Naya Luna", avatarUrl: null }, media: [] },
  { id: "f7", caption: "Mini vlog gratis + bonus premium esta noche.", visibility: "FREE", creator: { displayName: "Luna Mode", avatarUrl: null }, media: [] },
  { id: "f8", caption: "Drop premium: sesión completa en HD.", visibility: "PREMIUM", creator: { displayName: "Mia Dark", avatarUrl: null }, media: [] },
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

  const heroMain = catalogCreators[0];
  const heroSide = catalogCreators.slice(1, 5);
  const featuredCreators = catalogCreators.slice(0, 12);
  const latestContent = catalogFeed.slice(0, 8);

  const totalSubscribers = Math.max(catalogCreators.reduce((acc, c) => acc + c.subscriberCount, 0), 980);
  const totalPosts = Math.max(catalogCreators.reduce((acc, c) => acc + c.totalPosts, 0), 1300);
  const totalLikes = Math.max(catalogCreators.reduce((acc, c) => acc + c.totalLikes, 0), 7600);
  const premiumPieces = Math.max(catalogFeed.filter((item) => item.visibility === "PREMIUM").length, 24);

  return (
    <div className="space-y-0 bg-gradient-to-b from-[#fffaf9] via-white to-[#fff9f5]">
      <section className="relative overflow-hidden border-b border-fuchsia-100/80 bg-gradient-to-b from-[#fff3f8] via-white to-[#fff9f5] pb-14 pt-8 lg:pb-20 lg:pt-14">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 left-[-80px] h-[320px] w-[320px] rounded-full bg-fuchsia-200/45 blur-[80px]" />
          <div className="absolute right-[-100px] top-16 h-[360px] w-[360px] rounded-full bg-orange-200/40 blur-[95px]" />
          <div className="absolute bottom-[-130px] left-1/3 h-[300px] w-[300px] rounded-full bg-rose-200/45 blur-[85px]" />
        </div>

        <div className="relative mx-auto max-w-[1320px] px-4 lg:px-6">
          <div className="grid items-start gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200/70 bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur">
                <img src="/brand/Umate.webp" alt="U-Mate" className="h-5 w-auto" />
                <span className="text-[11px] font-black uppercase tracking-wide text-fuchsia-700">Catálogo + suscripción + comunidad</span>
              </div>

              <h1 className="mt-5 text-4xl font-black leading-[1.03] tracking-tight text-slate-900 md:text-6xl lg:text-[4rem]">
                U-Mate no es un feed más.
                <span className="bg-gradient-to-r from-fuchsia-600 via-rose-500 to-orange-500 bg-clip-text text-transparent"> Es discovery premium con fandom real.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
                Descubre creadoras activas, desbloquea contenido premium por suscripción y participa en una comunidad que se mueve todos los días.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/umate/creators" className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-rose-500 to-orange-500 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-fuchsia-500/25 transition hover:brightness-105">
                  Ver catálogo ahora <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/umate/plans" className="inline-flex items-center gap-2 rounded-2xl border border-fuchsia-200 bg-white px-6 py-3.5 text-sm font-semibold text-fuchsia-700 shadow-sm transition hover:bg-fuchsia-50">
                  Ver planes
                </Link>
                <Link href="/umate/onboarding" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-fuchsia-200 hover:text-fuchsia-700">
                  Unirme como creadora
                </Link>
              </div>

              <div className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:max-w-2xl">
                {[
                  { label: "Creadoras activas", value: `${Math.max(catalogCreators.length, 40)}+`, icon: Users },
                  { label: "Suscriptoras", value: `${totalSubscribers.toLocaleString()}+`, icon: Heart },
                  { label: "Publicaciones", value: `${totalPosts.toLocaleString()}+`, icon: Eye },
                  { label: "Piezas premium", value: `${premiumPieces}+`, icon: Crown },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-100 to-rose-100">
                      <item.icon className="h-5 w-5 text-fuchsia-600" />
                    </div>
                    <div>
                      <p className="text-base font-black text-slate-900">{item.value}</p>
                      <p className="text-xs text-slate-500">{item.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-[28px] border border-white/70 bg-white/70 p-3 shadow-2xl shadow-fuchsia-200/40 backdrop-blur">
                <div className="grid gap-3 rounded-3xl bg-gradient-to-br from-slate-950 via-[#1a1028] to-[#251229] p-3 sm:grid-cols-2">
                  <Link
                    href={heroMain ? `/umate/profile/${heroMain.user.username}` : "/umate/creators"}
                    className="group relative min-h-[330px] overflow-hidden rounded-2xl sm:col-span-2"
                  >
                    {heroMain?.coverUrl || heroMain?.avatarUrl ? (
                      <img src={heroMain.coverUrl || heroMain.avatarUrl || ""} alt={heroMain.displayName} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-fuchsia-400 via-rose-400 to-orange-400" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
                      <Zap className="h-3 w-3" /> Trending ahora
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="text-xl font-black text-white">{heroMain?.displayName || "Creadora destacada"}</p>
                      <p className="mt-1 text-sm text-white/85">{heroMain?.bio || "Contenido editorial, drops premium y comunidad activa."}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/90">
                        <span className="rounded-lg bg-white/15 px-2 py-1">{heroMain?.subscriberCount || 220} suscriptoras</span>
                        <span className="rounded-lg bg-white/15 px-2 py-1">{heroMain?.totalPosts || 140} publicaciones</span>
                        <span className="rounded-lg bg-white/15 px-2 py-1">{heroMain?.totalLikes || 1900} likes</span>
                      </div>
                    </div>
                  </Link>

                  {heroSide.map((c) => (
                    <Link key={c.id} href={`/umate/profile/${c.user.username}`} className="group relative min-h-[150px] overflow-hidden rounded-2xl border border-white/10">
                      {c.coverUrl || c.avatarUrl ? (
                        <img src={c.coverUrl || c.avatarUrl || ""} alt={c.displayName} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-fuchsia-300 to-orange-300" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
                      <div className="absolute bottom-2.5 left-2.5 right-2.5">
                        <p className="truncate text-sm font-bold text-white">{c.displayName}</p>
                        <p className="truncate text-[11px] text-white/75">@{c.user.username}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="absolute -left-3 top-8 rounded-2xl border border-fuchsia-200 bg-white/95 px-3 py-2 shadow-lg">
                <p className="text-[10px] font-black uppercase text-fuchsia-600">Nuevo contenido</p>
                <p className="text-xs font-semibold text-slate-700">+{latestContent.length} piezas hoy</p>
              </div>
              <div className="absolute -right-3 bottom-8 rounded-2xl border border-amber-200 bg-white/95 px-3 py-2 shadow-lg">
                <p className="text-[10px] font-black uppercase text-amber-700">Premium</p>
                <p className="text-xs font-semibold text-slate-700">{premiumPieces}+ desbloqueables</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-[1320px] px-4 lg:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-fuchsia-50 px-3 py-1 text-[11px] font-bold text-fuchsia-700">
                <Star className="h-3 w-3" /> Catálogo destacado
              </span>
              <h2 className="mt-3 text-3xl font-black text-slate-900">Volumen real de creadoras, estilos y comunidades</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">Más perfiles visibles, más ritmo visual y más señales de actividad para decidir rápido a quién seguir.</p>
            </div>
            <Link href="/umate/creators" className="hidden items-center gap-1 text-sm font-bold text-fuchsia-700 transition hover:gap-2 md:flex">
              Ver catálogo completo <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featuredCreators.map((c, idx) => (
              <Link key={c.id} href={`/umate/profile/${c.user.username}`} className="group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-fuchsia-100/70">
                <div className={`relative overflow-hidden bg-gradient-to-br from-fuchsia-100 to-orange-100 ${idx % 5 === 0 ? "h-52" : "h-44"}`}>
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
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-white py-12 lg:py-16">
        <div className="mx-auto max-w-[1320px] px-4 lg:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-700">
                <Play className="h-3 w-3" /> Feed preview
              </span>
              <h2 className="mt-3 text-3xl font-black text-slate-900">Gratis + premium, en una composición más aspiracional</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-500">Una vista previa viva del feed con piezas variadas para que den ganas de entrar y descubrir más.</p>
            </div>
            <Link href="/umate/explore" className="hidden items-center gap-1 text-sm font-bold text-fuchsia-700 transition hover:gap-2 md:flex">
              Ir al feed <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-12">
            {latestContent.map((item, idx) => (
              <article
                key={item.id}
                className={`group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:shadow-lg ${idx === 0 ? "sm:col-span-2 xl:col-span-6" : idx === 3 || idx === 4 ? "xl:col-span-3" : "xl:col-span-2"}`}
              >
                <div className={`relative overflow-hidden bg-slate-100 ${idx === 0 ? "aspect-[16/10]" : "aspect-[4/5]"}`}>
                  {item.media[0]?.url ? <img src={item.media[0].url} alt={item.caption || "Publicación"} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="h-full w-full bg-gradient-to-br from-fuchsia-100 to-orange-100" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  {item.visibility === "PREMIUM" && (
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold text-white">
                      <Lock className="h-3 w-3" /> Premium
                    </span>
                  )}
                  {idx === 0 && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-fuchsia-700">
                      <Zap className="h-3 w-3" /> Destacado hoy
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
          <div className="mb-7 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-slate-900">Cómo funciona</h2>
              <p className="mt-1 text-sm text-slate-500">Del descubrimiento al vínculo en tres pasos claros.</p>
            </div>
            <Link href="/umate/plans" className="text-sm font-bold text-fuchsia-700">Ver planes</Link>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { step: "01", title: "Descubre", desc: "Navega un catálogo abundante, filtrado por estilo, ritmo de publicación y tipo de comunidad.", icon: Sparkles, color: "from-fuchsia-500 to-rose-500", accent: "bg-fuchsia-50" },
              { step: "02", title: "Suscríbete", desc: "Activa un plan con cupos mensuales para desbloquear contenido premium sin fricción.", icon: Crown, color: "from-amber-500 to-orange-500", accent: "bg-amber-50" },
              { step: "03", title: "Conecta", desc: "Sigue el feed, participa, comenta y construye comunidad real con tus creadoras favoritas.", icon: MessageCircle, color: "from-rose-500 to-orange-500", accent: "bg-rose-50" },
            ].map((item) => (
              <article key={item.step} className={`rounded-2xl border border-slate-100 ${item.accent} p-5`}>
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
          <div className="overflow-hidden rounded-3xl border border-amber-100/80 bg-gradient-to-br from-white via-amber-50/50 to-orange-50/60 p-8 shadow-lg lg:p-12">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800">
                <Crown className="h-3 w-3" /> Planes de suscripción
              </span>
              <h2 className="mt-4 text-3xl font-black text-slate-900">Elige tu ritmo de acceso premium</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">Después del discovery, activa el plan que convierta mejor tu exploración en comunidad activa.</p>
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
          <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-fuchsia-600 via-rose-500 to-orange-500 p-10 text-center shadow-2xl shadow-fuchsia-500/25 lg:p-14">
            <h2 className="text-3xl font-black text-white md:text-4xl">Tu próxima comunidad favorita está en U-Mate.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-white/90">Explora un catálogo abundante, entra al feed aspiracional y transforma descubrimiento en suscripción activa.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/umate/creators" className="rounded-2xl bg-white px-7 py-3.5 text-sm font-bold text-fuchsia-700 shadow-lg transition hover:shadow-xl">
                Explorar creadoras
              </Link>
              <Link href="/umate/explore" className="rounded-2xl border-2 border-white/50 px-6 py-3.5 text-sm font-bold text-white transition hover:border-white/80">
                Entrar al feed
              </Link>
              <Link href="/umate/onboarding" className="rounded-2xl border-2 border-white/35 px-6 py-3.5 text-sm font-bold text-white transition hover:border-white/70">
                Crear perfil de creadora
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-4 text-xs font-semibold text-white/85">
              <span className="inline-flex items-center gap-1.5"><Shield className="h-4 w-4" /> Pagos seguros</span>
              <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-4 w-4" /> Perfiles verificados</span>
              <span className="inline-flex items-center gap-1.5"><Heart className="h-4 w-4" /> +{totalLikes.toLocaleString()} likes</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
