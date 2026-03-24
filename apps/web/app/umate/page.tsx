"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Crown, Diamond, ArrowRight, Heart, Eye, Users } from "lucide-react";
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
  const tierColor: Record<string, string> = {
    SILVER: "from-slate-300 to-slate-400",
    GOLD: "from-amber-300 to-amber-500",
    DIAMOND: "from-violet-300 to-fuchsia-400",
  };

  return (
    <div className="py-8 space-y-16">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-rose-500/10 bg-gradient-to-br from-rose-600/[0.08] via-amber-500/[0.04] to-transparent px-6 py-12 text-center md:px-12 md:py-20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/40 to-transparent" />
        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
          Contenido exclusivo de{" "}
          <span className="bg-gradient-to-r from-rose-400 to-amber-400 bg-clip-text text-transparent">creadoras</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-white/50 md:text-base">
          Suscríbete con un plan mensual y accede al contenido premium de tus creadoras favoritas.
          Fotos, videos y mucho más.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/umate/plans"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(244,63,94,0.3)] transition hover:shadow-[0_0_32px_rgba(244,63,94,0.45)]"
          >
            Ver planes <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/umate/explore"
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-6 py-3 text-sm font-medium text-white/70 transition hover:bg-white/[0.08]"
          >
            Explorar creadoras
          </Link>
        </div>
      </section>

      {/* Plans preview */}
      {plans.length > 0 && (
        <section>
          <h2 className="mb-6 text-xl font-bold tracking-tight">Elige tu plan</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {plans.map((plan) => {
              const Icon = tierIcon[plan.tier] || Sparkles;
              const gradient = tierColor[plan.tier] || "from-white to-white";
              return (
                <Link
                  key={plan.id}
                  href="/umate/plans"
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition hover:border-rose-500/20 hover:bg-white/[0.04]"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Icon className={`h-5 w-5 bg-gradient-to-r ${gradient} bg-clip-text text-transparent`} />
                    <span className="text-sm font-semibold">{plan.name}</span>
                  </div>
                  <p className="text-2xl font-bold">
                    ${plan.priceCLP.toLocaleString("es-CL")}
                    <span className="text-sm font-normal text-white/40">/mes</span>
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    {plan.maxSlots} {plan.maxSlots === 1 ? "suscripción" : "suscripciones"} a creadoras
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Featured creators */}
      {creators.length > 0 && (
        <section>
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-xl font-bold tracking-tight">Creadoras destacadas</h2>
            <Link href="/umate/explore" className="text-xs font-medium text-white/40 hover:text-rose-400 transition">
              Ver todas <ArrowRight className="inline h-3 w-3" />
            </Link>
          </div>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {creators.map((c) => (
              <Link
                key={c.id}
                href={`/umate/profile/${c.user.username}`}
                className="group overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] transition hover:border-rose-500/20"
              >
                {/* Cover */}
                <div className="relative h-28 bg-gradient-to-br from-rose-500/20 to-amber-500/10">
                  {c.coverUrl && (
                    <img src={c.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  )}
                </div>
                {/* Avatar */}
                <div className="-mt-8 px-3">
                  <div className="relative inline-block">
                    <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-[#06060c] bg-white/10">
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg font-bold text-white/30">
                          {c.displayName[0]}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="px-3 pb-4 pt-1">
                  <p className="truncate text-sm font-semibold">{c.displayName}</p>
                  <p className="truncate text-[11px] text-white/40">@{c.user.username}</p>
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-white/30">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.subscriberCount}</span>
                    <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{c.totalLikes}</span>
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{c.totalPosts}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA for creators */}
      {me?.user && (
        <section className="rounded-3xl border border-amber-500/10 bg-gradient-to-br from-amber-500/[0.06] to-transparent p-8 text-center">
          <h2 className="text-lg font-bold">¿Eres creadora?</h2>
          <p className="mt-2 text-sm text-white/50">
            Publica contenido, consigue suscriptores y monetiza tu perfil en U-Mate.
          </p>
          <Link
            href="/umate/onboarding"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 px-6 py-3 text-sm font-semibold text-white transition hover:shadow-[0_0_24px_rgba(245,158,11,0.3)]"
          >
            Crear cuenta de creadora
          </Link>
        </section>
      )}
    </div>
  );
}
