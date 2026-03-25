"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Crown, Diamond, ArrowRight, Heart, Users, WandSparkles, Star, PlayCircle } from "lucide-react";
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
    apiFetch<{ creators: Creator[] }>("/umate/creators?limit=6").then((d) => setCreators(d?.creators || [])).catch(() => {});
    apiFetch<{ plans: Plan[] }>("/umate/plans").then((d) => setPlans(d?.plans || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (me?.user) {
      apiFetch<{ creator: any }>("/umate/creator/me")
        .then((d) => setIsCreator(Boolean(d?.creator && d.creator.status !== "SUSPENDED")))
        .catch(() => {});
    }
  }, [me]);

  const tierIcon: Record<string, typeof Sparkles> = { SILVER: Sparkles, GOLD: Crown, DIAMOND: Diamond };

  return (
    <div className="space-y-10 pb-12">
      <section className="relative overflow-hidden rounded-[2rem] border border-fuchsia-100 bg-gradient-to-br from-white via-rose-50/80 to-amber-50 px-6 py-10 shadow-[0_20px_60px_rgba(244,114,182,0.12)] md:px-10">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-fuchsia-200/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-16 h-60 w-60 rounded-full bg-orange-200/40 blur-3xl" />
        <div className="relative grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-white px-3 py-1 text-xs font-semibold text-fuchsia-700">
              <WandSparkles className="h-3.5 w-3.5" /> Nueva generación de descubrimiento
            </span>
            <h1 className="mt-4 text-3xl font-black leading-tight text-slate-900 md:text-5xl">
              U-Mate: descubre creadoras, conecta y conviértete en fan premium.
            </h1>
            <p className="mt-3 max-w-xl text-sm text-slate-600 md:text-base">
              Menos panel. Más descubrimiento. Explora contenido real, desbloquea experiencias premium y sigue a las creadoras que mejor conectan contigo.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {!isCreator && (
                <Link href="/umate/plans" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 px-5 py-3 text-sm font-bold text-white shadow-sm">
                  Elegir plan <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link href="/umate/explore" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
                Ver discovery feed
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Creadoras activas", value: `${creators.length}+`, icon: Users },
              { label: "Contenido social", value: "Feed vivo", icon: PlayCircle },
              { label: "Experiencia premium", value: "Blur deseable", icon: Star },
              { label: "Conversión", value: "Planes claros", icon: Crown },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white bg-white/90 p-4">
                <item.icon className="h-4 w-4 text-fuchsia-500" />
                <p className="mt-2 text-sm font-bold text-slate-900">{item.value}</p>
                <p className="text-xs text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {creators.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">Creadoras destacadas</h2>
              <p className="text-sm text-slate-500">Perfiles con mejor engagement esta semana</p>
            </div>
            <Link href="/umate/creators" className="text-sm font-semibold text-fuchsia-700">Ver todas</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {creators.map((c) => (
              <Link key={c.id} href={`/umate/profile/${c.user.username}`} className="overflow-hidden rounded-3xl border border-rose-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="relative h-36 bg-gradient-to-br from-fuchsia-100 to-orange-100">
                  {c.coverUrl && <img src={c.coverUrl} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="-mt-10 px-4 pb-4">
                  <div className="h-20 w-20 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-sm">
                    {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-bold text-slate-400">{c.displayName[0]}</div>}
                  </div>
                  <p className="mt-3 text-base font-bold text-slate-900">{c.displayName}</p>
                  <p className="text-xs text-slate-500">@{c.user.username}</p>
                  <div className="mt-2 flex gap-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-fuchsia-500" /> {c.subscriberCount}</span>
                    <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5 text-rose-500" /> {c.totalLikes}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {plans.length > 0 && !isCreator && (
        <section className="rounded-3xl border border-amber-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-slate-900">Planes pensados para convertir</h2>
              <p className="text-sm text-slate-500">Escoge tu nivel y desbloquea cupos mensuales para suscribirte a creadoras.</p>
            </div>
            <Link href="/umate/plans" className="text-sm font-semibold text-fuchsia-700">Comparar planes</Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {plans.map((plan) => {
              const Icon = tierIcon[plan.tier] || Sparkles;
              return (
                <div key={plan.id} className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-rose-50/40 p-4">
                  <Icon className="h-5 w-5 text-fuchsia-600" />
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
