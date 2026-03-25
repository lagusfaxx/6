"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Crown, Diamond, ArrowRight, Heart, Users, Flame, Shield, ChevronRight } from "lucide-react";
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

  useEffect(() => {
    apiFetch<{ creators: Creator[] }>("/umate/creators?limit=8").then((d) => setCreators(d?.creators || [])).catch(() => {});
    apiFetch<{ plans: Plan[] }>("/umate/plans").then((d) => setPlans(d?.plans || [])).catch(() => {});
  }, []);

  const tierIcon: Record<string, typeof Sparkles> = { SILVER: Sparkles, GOLD: Crown, DIAMOND: Diamond };
  const tierGradient: Record<string, string> = {
    SILVER: "from-slate-400 to-slate-500",
    GOLD: "from-amber-400 to-amber-600",
    DIAMOND: "from-violet-400 to-fuchsia-500",
  };

  // Check if user is a creator (hide subscribe CTAs)
  const [isCreator, setIsCreator] = useState(false);
  useEffect(() => {
    if (me?.user) {
      apiFetch<{ creator: any }>("/umate/creator/me")
        .then((d) => setIsCreator(Boolean(d?.creator && d.creator.status !== "SUSPENDED")))
        .catch(() => {});
    }
  }, [me]);

  return (
    <div className="space-y-20 pb-12">
      {/* Hero — full-width immersive */}
      <section className="relative -mx-4 -mt-6 overflow-hidden bg-gradient-to-b from-rose-950/40 via-[#0a0a12] to-[#08080f] px-4 py-16 md:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(244,63,94,0.15),transparent_60%)]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-rose-500/20 to-transparent" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/[0.08] px-4 py-1.5 text-[11px] font-medium text-rose-300">
            <Flame className="h-3.5 w-3.5" /> Plataforma de contenido exclusivo
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
            Contenido exclusivo{" "}
            <span className="bg-gradient-to-r from-rose-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">sin límites</span>
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-base text-white/45 md:text-lg">
            Suscríbete a tus creadoras favoritas. Fotos, videos y contenido premium que no encontrarás en otro lugar.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            {!isCreator && (
              <Link
                href="/umate/plans"
                className="group inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 px-8 py-4 text-sm font-bold text-white shadow-[0_0_40px_rgba(244,63,94,0.25)] transition hover:shadow-[0_0_60px_rgba(244,63,94,0.4)]"
              >
                Suscribirme ahora <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
            )}
            <Link
              href="/umate/explore"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.04] px-8 py-4 text-sm font-medium text-white/60 transition hover:bg-white/[0.08] hover:text-white"
            >
              Explorar creadoras
            </Link>
          </div>
        </div>
      </section>

      {/* Featured creators — horizontal scroll like OnlyFans */}
      {creators.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Creadoras populares</h2>
              <p className="mt-1 text-xs text-white/30">Las más seguidas en U-Mate</p>
            </div>
            <Link href="/umate/explore" className="flex items-center gap-1 text-xs font-medium text-rose-400/70 transition hover:text-rose-400">
              Ver todas <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
            {creators.map((c) => (
              <Link
                key={c.id}
                href={`/umate/profile/${c.user.username}`}
                className="group w-44 shrink-0 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition hover:border-rose-500/20 hover:shadow-[0_0_30px_rgba(244,63,94,0.06)]"
              >
                {/* Cover */}
                <div className="relative h-24 bg-gradient-to-br from-rose-500/20 to-amber-500/10 overflow-hidden">
                  {c.coverUrl && (
                    <img src={c.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent" />
                </div>
                {/* Avatar overlapping cover */}
                <div className="-mt-7 px-3 relative z-10">
                  <div className="h-14 w-14 overflow-hidden rounded-full border-[3px] border-[#08080f] bg-white/10 shadow-lg">
                    {c.avatarUrl ? (
                      <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-base font-bold text-white/30">
                        {c.displayName[0]}
                      </div>
                    )}
                  </div>
                </div>
                <div className="px-3 pb-3 pt-1.5">
                  <p className="truncate text-sm font-bold">{c.displayName}</p>
                  <p className="truncate text-[10px] text-white/30">@{c.user.username}</p>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-white/25">
                    <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> {c.subscriberCount}</span>
                    <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" /> {c.totalLikes}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Plans — pricing cards */}
      {plans.length > 0 && !isCreator && (
        <section className="space-y-5">
          <div className="text-center">
            <h2 className="text-xl font-bold tracking-tight">Planes de suscripción</h2>
            <p className="mt-1 text-sm text-white/35">Elige cuántas creadoras quieres seguir</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {plans.map((plan) => {
              const Icon = tierIcon[plan.tier] || Sparkles;
              const gradient = tierGradient[plan.tier] || "from-white to-white";
              const isPopular = plan.tier === "GOLD";
              return (
                <Link
                  key={plan.id}
                  href="/umate/plans"
                  className={`group relative overflow-hidden rounded-2xl border bg-white/[0.02] p-6 transition hover:bg-white/[0.04] ${
                    isPopular
                      ? "border-amber-500/25 ring-1 ring-amber-500/10 shadow-[0_0_30px_rgba(245,158,11,0.06)]"
                      : "border-white/[0.08]"
                  }`}
                >
                  {isPopular && (
                    <span className="absolute top-3 right-3 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                      MÁS POPULAR
                    </span>
                  )}
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="mt-3 text-base font-bold">{plan.name}</h3>
                  <p className="mt-1 text-2xl font-extrabold">
                    ${plan.priceCLP.toLocaleString("es-CL")}
                    <span className="text-xs font-normal text-white/30"> /mes</span>
                  </p>
                  <p className="mt-2 text-xs text-white/35">
                    {plan.maxSlots} {plan.maxSlots === 1 ? "creadora" : "creadoras"} incluidas
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Trust indicators */}
      <section className="grid grid-cols-3 gap-4">
        {[
          { icon: Shield, label: "Pagos seguros", desc: "Procesados por Flow.cl" },
          { icon: Heart, label: "Contenido exclusivo", desc: "Solo para suscriptores" },
          { icon: Users, label: "Comunidad activa", desc: "Creadoras verificadas" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
            <item.icon className="mx-auto h-5 w-5 text-rose-400/60" />
            <p className="mt-2 text-xs font-semibold">{item.label}</p>
            <p className="mt-0.5 text-[10px] text-white/25">{item.desc}</p>
          </div>
        ))}
      </section>

      {/* Creator CTA — only for non-subscribers, non-creators */}
      {me?.user && !isCreator && (
        <section className="relative overflow-hidden rounded-3xl border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.06] via-rose-500/[0.03] to-transparent p-8 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(245,158,11,0.08),transparent_60%)]" />
          <div className="relative">
            <h2 className="text-lg font-bold">¿Quieres ser creadora?</h2>
            <p className="mt-2 text-sm text-white/45">
              Publica contenido, consigue suscriptores y monetiza tu perfil.
            </p>
            <Link
              href="/umate/onboarding"
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 px-8 py-3.5 text-sm font-bold text-white transition hover:shadow-[0_0_30px_rgba(245,158,11,0.3)]"
            >
              Crear cuenta de creadora <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
