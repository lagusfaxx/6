"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Crown,
  Diamond,
  Heart,
  Lock,
  PlayCircle,
  Sparkles,
  Star,
  Users,
  WandSparkles,
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
  creator: { displayName: string; user?: { username: string } };
  media: { id: string; url: string | null }[];
};

export default function UmateLandingPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  useEffect(() => {
    Promise.all([
      apiFetch<{ creators: Creator[] }>("/umate/creators?limit=12").catch(() => null),
      apiFetch<{ plans: Plan[] }>("/umate/plans").catch(() => null),
      apiFetch<{ items: FeedItem[] }>("/umate/feed?limit=6").catch(() => null),
    ]).then(([c, p, f]) => {
      setCreators(c?.creators || []);
      setPlans(p?.plans || []);
      setFeed(f?.items || []);
    });
  }, []);

  const tierIcon: Record<string, typeof Sparkles> = { SILVER: Sparkles, GOLD: Crown, DIAMOND: Diamond };
  const collage = useMemo(() => creators.slice(0, 5), [creators]);

  return (
    <div className="space-y-10 pb-16">
      <section className="relative overflow-hidden rounded-[2rem] border border-fuchsia-100 bg-gradient-to-br from-white via-rose-50/80 to-orange-50 p-7 shadow-[0_35px_120px_rgba(236,72,153,0.22)] lg:p-10">
        <div className="absolute -right-20 top-0 h-72 w-72 rounded-full bg-fuchsia-200/40 blur-3xl" />
        <div className="absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-orange-200/40 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-white px-3 py-1 text-xs font-semibold text-fuchsia-700 shadow-sm">
              <WandSparkles className="h-3.5 w-3.5" /> Plataforma de creadoras y suscripciones
            </span>
            <h1 className="mt-4 text-4xl font-black leading-[1.02] text-slate-900 md:text-6xl">
              Contenido premium,
              <span className="block bg-gradient-to-r from-fuchsia-600 via-rose-500 to-orange-500 bg-clip-text text-transparent">comunidad real y negocio escalable.</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm text-slate-600 md:text-base">
              U-Mate conecta fans y creadoras con una experiencia de discovery potente: explora, desbloquea y suscríbete en una plataforma viva.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/umate/explore" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/30">
                Empezar a explorar <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/umate/plans" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
                Ver planes
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-3xl border border-white/80 bg-white/80 p-3 backdrop-blur">
            {collage.map((c, idx) => (
              <Link key={c.id} href={`/umate/profile/${c.user.username}`} className={`group relative overflow-hidden rounded-2xl border border-white bg-slate-100 ${idx === 0 ? "col-span-2 aspect-[16/9]" : "aspect-[4/5]"}`}>
                {c.coverUrl || c.avatarUrl ? <img src={c.coverUrl || c.avatarUrl || ""} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="h-full w-full bg-gradient-to-br from-fuchsia-100 to-orange-100" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2 text-xs text-white">
                  <p className="truncate font-bold">{c.displayName}</p>
                  <p className="truncate text-white/80">@{c.user.username}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Discovery activo", desc: "Feed híbrido con contenido gratis, premium y recomendaciones.", icon: Sparkles },
          { title: "Comunidad", desc: "Perfiles con señales sociales, likes, crecimiento y engagement.", icon: Users },
          { title: "Monetización", desc: "Planes y suscripciones para una economía de creadoras real.", icon: Crown },
        ].map((item) => (
          <article key={item.title} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <item.icon className="h-5 w-5 text-fuchsia-600" />
            <h3 className="mt-3 text-base font-black text-slate-900">{item.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
          </article>
        ))}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Creadoras destacadas</h2>
            <p className="text-sm text-slate-500">Talento en crecimiento con alto rendimiento.</p>
          </div>
          <Link href="/umate/creators" className="text-sm font-semibold text-fuchsia-700">Ver catálogo completo</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {creators.slice(0, 8).map((c) => (
            <Link key={c.id} href={`/umate/profile/${c.user.username}`} className="overflow-hidden rounded-3xl border border-rose-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-fuchsia-100">
              <div className="relative h-36 bg-gradient-to-br from-fuchsia-100 to-orange-100">{c.coverUrl && <img src={c.coverUrl} alt="" className="h-full w-full object-cover" />}</div>
              <div className="px-4 pb-4 pt-3">
                <p className="font-black text-slate-900">{c.displayName}</p>
                <p className="text-xs text-slate-500">@{c.user.username}</p>
                {c.bio && <p className="mt-1 line-clamp-2 text-xs text-slate-600">{c.bio}</p>}
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  <span className="rounded-lg bg-slate-50 px-2 py-1 text-center font-semibold text-slate-700">{c.subscriberCount}</span>
                  <span className="rounded-lg bg-slate-50 px-2 py-1 text-center font-semibold text-slate-700">{c.totalLikes}</span>
                  <span className="rounded-lg bg-slate-50 px-2 py-1 text-center font-semibold text-slate-700">{c.totalPosts}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900">Preview de contenido</h2>
          <Link href="/umate/explore" className="text-sm font-semibold text-fuchsia-700">Abrir feed</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {feed.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-100">
              <div className="relative aspect-[4/5] bg-slate-100">
                {item.media[0]?.url ? <img src={item.media[0].url} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-fuchsia-100 to-orange-100" />}
                {item.visibility === "PREMIUM" && <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-white"><Lock className="h-3 w-3" /> Premium</span>}
              </div>
              <div className="p-3">
                <p className="text-xs font-semibold text-slate-500">{item.creator.displayName}</p>
                {item.caption && <p className="mt-1 line-clamp-2 text-sm text-slate-700">{item.caption}</p>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-amber-100 bg-gradient-to-r from-white via-amber-50 to-orange-50 p-6 shadow-sm">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">Planes para desbloquear más</h2>
            <p className="text-sm text-slate-500">Comparación rápida para entrar hoy.</p>
          </div>
          <Link href="/umate/plans" className="text-sm font-semibold text-fuchsia-700">Ver tabla completa</Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {plans.map((plan) => {
            const Icon = tierIcon[plan.tier] || Sparkles;
            return (
              <div key={plan.id} className="rounded-2xl border border-white bg-white/90 p-4">
                <Icon className="h-5 w-5 text-fuchsia-600" />
                <p className="mt-2 text-sm font-bold text-slate-900">{plan.name}</p>
                <p className="text-2xl font-black text-slate-900">${plan.priceCLP.toLocaleString("es-CL")}</p>
                <p className="text-xs text-slate-500">{plan.maxSlots} cupos por mes</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-fuchsia-200 bg-gradient-to-r from-fuchsia-600 via-rose-500 to-orange-500 p-8 text-center text-white shadow-xl">
        <h2 className="text-3xl font-black">Pasa de mirar a pertenecer.</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-white/85">Descubre creadoras, súmate a su comunidad y desbloquea experiencias exclusivas en U-Mate.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/umate/explore" className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-fuchsia-700">Explorar ahora</Link>
          <Link href="/umate/plans" className="rounded-xl border border-white/50 px-5 py-2.5 text-sm font-bold text-white">Activar plan</Link>
        </div>
      </section>
    </div>
  );
}
