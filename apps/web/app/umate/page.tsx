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
  TrendingUp,
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

export default function UmateLandingPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  useEffect(() => {
    Promise.all([
      apiFetch<{ creators: Creator[] }>("/umate/creators?limit=16").catch(() => null),
      apiFetch<{ plans: Plan[] }>("/umate/plans").catch(() => null),
      apiFetch<{ items: FeedItem[] }>("/umate/feed?limit=8").catch(() => null),
    ]).then(([c, p, f]) => {
      setCreators(c?.creators || []);
      setPlans(p?.plans || []);
      setFeed(f?.items || []);
    });
  }, []);

  const tierIcon: Record<string, typeof Sparkles> = { SILVER: Sparkles, GOLD: Crown, DIAMOND: Diamond };
  const heroCreators = useMemo(() => creators.slice(0, 6), [creators]);
  const featuredCreators = useMemo(() => creators.slice(0, 8), [creators]);
  const risingCreators = useMemo(() => creators.slice(4, 12), [creators]);

  return (
    <div className="space-y-0">
      {/* ═══════════════════════════════════════════════════════════════
          HERO — Full-width immersive landing
      ═══════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-fuchsia-50/80 via-white to-[#fffaf8] pb-16 pt-8 lg:pb-24 lg:pt-12">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-fuchsia-200/30 to-rose-200/20 blur-[100px]" />
          <div className="absolute -left-20 top-20 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-orange-200/25 to-amber-100/20 blur-[80px]" />
          <div className="absolute bottom-0 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-t from-rose-100/30 to-transparent blur-[60px]" />
        </div>

        <div className="relative mx-auto max-w-[1320px] px-4 lg:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
            {/* Left — Copy */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200/80 bg-white/80 px-4 py-1.5 shadow-sm backdrop-blur">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500">
                  <Zap className="h-3 w-3 text-white" />
                </span>
                <span className="text-xs font-bold text-fuchsia-700">Plataforma de creadoras y suscripciones</span>
              </div>

              <h1 className="mt-6 text-[2.75rem] font-black leading-[1.05] tracking-tight text-slate-900 md:text-6xl lg:text-[4rem]">
                Contenido exclusivo.{" "}
                <span className="bg-gradient-to-r from-fuchsia-600 via-rose-500 to-orange-500 bg-clip-text text-transparent">
                  Comunidad real.
                </span>
              </h1>

              <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600 md:text-lg">
                Descubre creadoras, desbloquea contenido premium y sé parte de una economía de suscripción diseñada para conectar fans y talento.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/umate/explore"
                  className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-rose-500 to-orange-500 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-fuchsia-500/25 transition hover:shadow-fuchsia-500/35 hover:brightness-105"
                >
                  Explorar contenido <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/umate/creators"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-fuchsia-200 hover:text-fuchsia-700"
                >
                  Ver creadoras
                </Link>
              </div>

              {/* Trust signals */}
              <div className="mt-8 flex flex-wrap items-center gap-5 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5"><Shield className="h-4 w-4 text-emerald-500" /> Pagos seguros</span>
                <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-sky-500" /> Creadoras verificadas</span>
                <span className="inline-flex items-center gap-1.5"><Heart className="h-4 w-4 text-rose-500" /> +{Math.max(creators.reduce((a, c) => a + c.totalLikes, 0), 1200).toLocaleString()} likes</span>
              </div>
            </div>

            {/* Right — Creator collage */}
            <div className="relative">
              <div className="grid grid-cols-3 gap-2.5">
                {heroCreators.map((c, idx) => (
                  <Link
                    key={c.id}
                    href={`/umate/profile/${c.user.username}`}
                    className={`group relative overflow-hidden rounded-2xl border border-white/50 bg-slate-100 shadow-lg transition duration-500 hover:scale-[1.03] hover:shadow-xl ${
                      idx === 0 ? "col-span-2 row-span-2 aspect-[4/5]" : "aspect-[3/4]"
                    }`}
                  >
                    {(c.coverUrl || c.avatarUrl) ? (
                      <img src={c.coverUrl || c.avatarUrl || ""} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-fuchsia-200 to-orange-200" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="truncate text-sm font-bold text-white">{c.displayName}</p>
                      <p className="text-[11px] text-white/70">@{c.user.username}</p>
                    </div>
                    {idx < 3 && (
                      <div className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                        <Heart className="mr-1 inline h-3 w-3" />{c.totalLikes}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          STATS BAR — Social proof
      ═══════════════════════════════════════════════════════════════ */}
      <section className="border-y border-slate-100 bg-white py-6">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-center gap-8 px-4 text-center lg:justify-between lg:gap-4 lg:px-6">
          {[
            { value: `${Math.max(creators.length, 25)}+`, label: "Creadoras activas", icon: Users },
            { value: `${Math.max(creators.reduce((a, c) => a + c.subscriberCount, 0), 340)}+`, label: "Suscriptores", icon: Heart },
            { value: `${Math.max(creators.reduce((a, c) => a + c.totalPosts, 0), 520)}+`, label: "Publicaciones", icon: Eye },
            { value: "3", label: "Planes disponibles", icon: Crown },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-50">
                <stat.icon className="h-5 w-5 text-fuchsia-600" />
              </div>
              <div className="text-left">
                <p className="text-lg font-black text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          FEATURED CREATORS — Carousel-style grid
      ═══════════════════════════════════════════════════════════════ */}
      <section className="py-14 lg:py-20">
        <div className="mx-auto max-w-[1320px] px-4 lg:px-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-fuchsia-50 px-3 py-1 text-[11px] font-bold text-fuchsia-700">
                <Star className="h-3 w-3" /> Destacadas
              </span>
              <h2 className="mt-3 text-3xl font-black text-slate-900">Creadoras en crecimiento</h2>
              <p className="mt-1 max-w-lg text-sm text-slate-500">Talento con alto engagement, contenido constante y comunidad activa.</p>
            </div>
            <Link href="/umate/creators" className="hidden items-center gap-1 text-sm font-bold text-fuchsia-700 transition hover:gap-2 md:flex">
              Ver catálogo <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredCreators.map((c) => (
              <Link key={c.id} href={`/umate/profile/${c.user.username}`} className="group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-fuchsia-100/50">
                <div className="relative h-40 overflow-hidden bg-gradient-to-br from-fuchsia-100 to-orange-50">
                  {c.coverUrl && <img src={c.coverUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                  {c.user.isVerified && (
                    <span className="absolute right-2.5 top-2.5 rounded-full bg-white/90 p-1 shadow-sm backdrop-blur">
                      <BadgeCheck className="h-4 w-4 text-sky-500" />
                    </span>
                  )}
                </div>
                <div className="-mt-7 px-4 pb-4">
                  <div className="h-14 w-14 overflow-hidden rounded-xl border-[3px] border-white bg-white shadow-md">
                    {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-fuchsia-50 text-sm font-bold text-fuchsia-600">{c.displayName[0]}</div>}
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-slate-900">{c.displayName}</h3>
                  <p className="text-xs text-slate-500">@{c.user.username}</p>
                  {c.bio && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600">{c.bio}</p>}
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 font-semibold"><Users className="h-3 w-3 text-fuchsia-500" />{c.subscriberCount}</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 font-semibold"><Heart className="h-3 w-3 text-rose-400" />{c.totalLikes}</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 font-semibold"><Eye className="h-3 w-3 text-sky-400" />{c.totalPosts}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-6 text-center md:hidden">
            <Link href="/umate/creators" className="inline-flex items-center gap-1 text-sm font-bold text-fuchsia-700">Ver todas las creadoras <ChevronRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          HOW IT WORKS — 3-step process
      ═══════════════════════════════════════════════════════════════ */}
      <section className="border-y border-slate-100 bg-white py-14 lg:py-20">
        <div className="mx-auto max-w-[1320px] px-4 lg:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-black text-slate-900">Cómo funciona U-Mate</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">Tres pasos para entrar a una comunidad exclusiva de creadoras.</p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Explora y descubre",
                desc: "Navega el feed de discovery con contenido gratis y premium. Encuentra creadoras por estilo, categoría y engagement.",
                icon: Sparkles,
                color: "from-fuchsia-500 to-rose-500",
                bg: "bg-fuchsia-50",
              },
              {
                step: "02",
                title: "Elige tu plan",
                desc: "Activa un plan mensual con cupos para suscribirte a creadoras premium y desbloquear contenido exclusivo.",
                icon: Crown,
                color: "from-amber-500 to-orange-500",
                bg: "bg-amber-50",
              },
              {
                step: "03",
                title: "Conecta y disfruta",
                desc: "Accede a publicaciones exclusivas, apoya a tus creadoras favoritas y forma parte de su comunidad VIP.",
                icon: Heart,
                color: "from-rose-500 to-pink-500",
                bg: "bg-rose-50",
              },
            ].map((item) => (
              <article key={item.step} className="group relative rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:shadow-lg">
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r ${item.color} text-white shadow-lg`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="text-4xl font-black text-slate-100">{item.step}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          CONTENT PREVIEW — Feed sample
      ═══════════════════════════════════════════════════════════════ */}
      <section className="py-14 lg:py-20">
        <div className="mx-auto max-w-[1320px] px-4 lg:px-6">
          <div className="flex items-end justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-700">
                <Play className="h-3 w-3" /> Preview
              </span>
              <h2 className="mt-3 text-3xl font-black text-slate-900">Contenido reciente</h2>
              <p className="mt-1 text-sm text-slate-500">Una muestra de lo que encontrarás en el feed de discovery.</p>
            </div>
            <Link href="/umate/explore" className="hidden items-center gap-1 text-sm font-bold text-fuchsia-700 transition hover:gap-2 md:flex">
              Abrir feed <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {feed.map((item) => (
              <article key={item.id} className="group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:shadow-lg">
                <div className="relative aspect-[3/4] overflow-hidden bg-slate-100">
                  {item.media[0]?.url ? (
                    <img src={item.media[0].url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-fuchsia-100 to-orange-100" />
                  )}
                  {item.visibility === "PREMIUM" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur">
                        <Lock className="h-3 w-3" /> Premium
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 overflow-hidden rounded-full bg-fuchsia-100">
                      {item.creator.avatarUrl && <img src={item.creator.avatarUrl} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-900">{item.creator.displayName}</p>
                    </div>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${item.visibility === "FREE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {item.visibility === "FREE" ? "Gratis" : "Premium"}
                    </span>
                  </div>
                  {item.caption && <p className="mt-2 line-clamp-2 text-xs text-slate-600">{item.caption}</p>}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          RISING CREATORS — Second batch
      ═══════════════════════════════════════════════════════════════ */}
      {risingCreators.length > 0 && (
        <section className="border-t border-slate-100 bg-gradient-to-b from-white to-rose-50/30 py-14 lg:py-20">
          <div className="mx-auto max-w-[1320px] px-4 lg:px-6">
            <div className="flex items-end justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700">
                  <TrendingUp className="h-3 w-3" /> En ascenso
                </span>
                <h2 className="mt-3 text-3xl font-black text-slate-900">Nuevas creadoras</h2>
                <p className="mt-1 text-sm text-slate-500">Perfiles emergentes con potencial y contenido fresco.</p>
              </div>
              <Link href="/umate/creators" className="hidden items-center gap-1 text-sm font-bold text-fuchsia-700 md:flex">
                Explorar catálogo <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 flex gap-3 overflow-x-auto pb-4 scrollbar-none">
              {risingCreators.map((c) => (
                <Link key={c.id} href={`/umate/profile/${c.user.username}`} className="group w-44 shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-fuchsia-100 to-orange-50">
                    {(c.coverUrl || c.avatarUrl) && <img src={c.coverUrl || c.avatarUrl || ""} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="truncate text-sm font-bold text-white">{c.displayName}</p>
                      <p className="text-[11px] text-white/70">@{c.user.username}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PLANS OVERVIEW — Quick comparison
      ═══════════════════════════════════════════════════════════════ */}
      <section className="py-14 lg:py-20">
        <div className="mx-auto max-w-[1320px] px-4 lg:px-6">
          <div className="overflow-hidden rounded-3xl border border-amber-100/80 bg-gradient-to-br from-white via-amber-50/50 to-orange-50/50 p-8 shadow-lg lg:p-12">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800">
                <Crown className="h-3 w-3" /> Planes de suscripción
              </span>
              <h2 className="mt-4 text-3xl font-black text-slate-900">Desbloquea el contenido completo</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">Cada plan incluye cupos mensuales para suscribirte a creadoras premium.</p>
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

      {/* ═══════════════════════════════════════════════════════════════
          FOR CREATORS — CTA para crear cuenta
      ═══════════════════════════════════════════════════════════════ */}
      <section className="border-y border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 py-14 lg:py-20">
        <div className="mx-auto max-w-[1320px] px-4 text-center lg:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-fuchsia-300 backdrop-blur">
            <Sparkles className="h-3 w-3" /> Para creadoras
          </span>
          <h2 className="mt-4 text-3xl font-black text-white md:text-4xl">Monetiza tu contenido con U-Mate</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
            Crea tu perfil, publica contenido exclusivo, gestiona suscriptores y retira tus ganancias. Todo desde un studio profesional.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/umate/onboarding" className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-rose-500 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-fuchsia-500/30 transition hover:brightness-105">
              Crear cuenta creadora <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/umate/rules" className="inline-flex items-center gap-2 rounded-2xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white">
              Ver reglas de la plataforma
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          FINAL CTA — Conversion
      ═══════════════════════════════════════════════════════════════ */}
      <section className="py-14 lg:py-20">
        <div className="mx-auto max-w-[1320px] px-4 lg:px-6">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-fuchsia-600 via-rose-500 to-orange-500 p-10 text-center shadow-2xl shadow-fuchsia-500/20 lg:p-16">
            <h2 className="text-3xl font-black text-white md:text-4xl">Pasa de mirar a pertenecer.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/80">
              Descubre creadoras, únete a su comunidad y desbloquea experiencias exclusivas ahora.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/umate/explore" className="rounded-2xl bg-white px-7 py-3.5 text-sm font-bold text-fuchsia-700 shadow-lg transition hover:shadow-xl">
                Explorar ahora
              </Link>
              <Link href="/umate/plans" className="rounded-2xl border-2 border-white/40 px-6 py-3.5 text-sm font-bold text-white transition hover:border-white/70">
                Activar plan
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
