"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, Crown, Diamond, ArrowRight, Heart, Users, WandSparkles, Star, PlayCircle, ShieldCheck, TrendingUp } from "lucide-react";
import { apiFetch } from "../../lib/api";
import useMe from "../../hooks/useMe";

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

export default function UmateLandingPage() {
  const { me } = useMe();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    apiFetch<{ creators: Creator[] }>("/umate/creators?limit=8").then((d) => setCreators(d?.creators || [])).catch(() => {});
    apiFetch<{ plans: Plan[] }>("/umate/plans").then((d) => setPlans(d?.plans || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (me?.user) {
      apiFetch<{ creator: any }>("/umate/creator/me")
        .then((d) => setIsCreator(Boolean(d?.creator && d.creator.status !== "SUSPENDED")))
        .catch(() => {});
    }
  }, [me]);

  const featured = useMemo(() => creators.slice(0, 4), [creators]);
  const collage = useMemo(() => creators.slice(0, 5), [creators]);
  const tierIcon: Record<string, typeof Sparkles> = { SILVER: Sparkles, GOLD: Crown, DIAMOND: Diamond };

  return (
    <div className="space-y-8 pb-14">
      <section className="relative overflow-hidden rounded-[2rem] border border-fuchsia-100 bg-gradient-to-br from-white via-rose-50/80 to-orange-50 p-6 shadow-[0_25px_80px_rgba(236,72,153,0.17)] md:p-9">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-fuchsia-300/30 blur-3xl" />
        <div className="absolute -bottom-16 -left-14 h-56 w-56 rounded-full bg-orange-300/30 blur-3xl" />

        <div className="relative grid gap-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-white px-3 py-1 text-xs font-semibold text-fuchsia-700 shadow-sm">
              <WandSparkles className="h-3.5 w-3.5" /> Plataforma social de suscripción
            </span>
            <h1 className="mt-4 text-3xl font-black leading-[1.05] text-slate-900 md:text-5xl">
              Menos scrolling vacío.
              <span className="block bg-gradient-to-r from-fuchsia-600 via-rose-500 to-orange-500 bg-clip-text text-transparent">Más creadoras, conexión y valor premium.</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm text-slate-600 md:text-base">
              Descubre perfiles reales, desbloquea contenido aspiracional y activa planes pensados para convertir seguidores en suscriptores.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {!isCreator && (
                <Link href="/umate/plans" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/25">
                  Activar plan ahora <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link href="/umate/explore" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                Ir al discovery feed
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" /> Comunidad verificada</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 font-semibold text-amber-700"><TrendingUp className="h-3.5 w-3.5" /> +{creators.length || 12} creadoras activas</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/80 bg-white/80 p-4 shadow-xl backdrop-blur-sm">
            <div className="grid h-full grid-cols-2 gap-3">
              {collage.map((c, idx) => (
                <Link
                  key={c.id}
                  href={`/umate/profile/${c.user.username}`}
                  className={`group relative overflow-hidden rounded-2xl border border-white bg-slate-100 ${idx === 0 ? "col-span-2 aspect-[16/9]" : "aspect-[4/5]"}`}
                >
                  {c.coverUrl || c.avatarUrl ? (
                    <img src={c.coverUrl || c.avatarUrl || ""} alt={c.displayName} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-fuchsia-100 via-rose-100 to-orange-100" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="truncate text-sm font-bold text-white">{c.displayName}</p>
                    <p className="text-[11px] text-white/80">@{c.user.username}</p>
                  </div>
                </Link>
              ))}
              {!collage.length && <div className="col-span-2 h-56 rounded-2xl bg-gradient-to-br from-fuchsia-100 to-orange-100" />}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Creadoras destacadas</h2>
            <p className="text-sm text-slate-500">Perfiles con mejor combinación de engagement, consistencia y crecimiento.</p>
          </div>
          <Link href="/umate/creators" className="text-sm font-semibold text-fuchsia-700">Explorar todas</Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featured.map((c) => (
            <Link key={c.id} href={`/umate/profile/${c.user.username}`} className="group overflow-hidden rounded-3xl border border-rose-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-fuchsia-100">
              <div className="relative h-36 bg-gradient-to-br from-fuchsia-100 to-orange-100">
                {c.coverUrl && <img src={c.coverUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
                <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">Top creator</span>
              </div>
              <div className="-mt-9 px-4 pb-4">
                <div className="h-20 w-20 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-md">
                  {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-bold text-slate-400">{c.displayName[0]}</div>}
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-black text-slate-900">{c.displayName}</p>
                    <p className="text-xs text-slate-500">@{c.user.username}</p>
                  </div>
                  {c.user.isVerified && <Star className="h-4 w-4 text-amber-500" />}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                  <p className="rounded-xl bg-slate-50 px-2 py-1.5 font-semibold text-slate-700"><Users className="mx-auto mb-1 h-3.5 w-3.5 text-fuchsia-500" />{c.subscriberCount}</p>
                  <p className="rounded-xl bg-slate-50 px-2 py-1.5 font-semibold text-slate-700"><Heart className="mx-auto mb-1 h-3.5 w-3.5 text-rose-500" />{c.totalLikes}</p>
                  <p className="rounded-xl bg-slate-50 px-2 py-1.5 font-semibold text-slate-700"><PlayCircle className="mx-auto mb-1 h-3.5 w-3.5 text-orange-500" />{c.totalPosts}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {plans.length > 0 && !isCreator && (
        <section className="rounded-3xl border border-amber-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-slate-900">Elige plan y empieza a desbloquear</h2>
              <p className="text-sm text-slate-500">Empuja tu experiencia premium con cupos mensuales flexibles.</p>
            </div>
            <Link href="/umate/plans" className="text-sm font-semibold text-fuchsia-700">Ver comparación completa</Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {plans.map((plan) => {
              const Icon = tierIcon[plan.tier] || Sparkles;
              const highlight = plan.tier === "GOLD";
              return (
                <div key={plan.id} className={`rounded-2xl border p-4 ${highlight ? "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 shadow-md" : "border-slate-100 bg-gradient-to-br from-white to-rose-50/30"}`}>
                  {highlight && <p className="text-[11px] font-black uppercase tracking-wide text-amber-700">Mejor elección</p>}
                  <Icon className="mt-1 h-5 w-5 text-fuchsia-600" />
                  <p className="mt-2 text-sm font-bold text-slate-900">{plan.name}</p>
                  <p className="text-2xl font-black text-slate-900">${plan.priceCLP.toLocaleString("es-CL")}</p>
                  <p className="text-xs text-slate-500">{plan.maxSlots} cupos de creadora por ciclo</p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
