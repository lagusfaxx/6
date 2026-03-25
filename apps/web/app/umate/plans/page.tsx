"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Crown, Diamond, Check, Loader2 } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import useMe from "../../../hooks/useMe";

type Plan = { id: string; tier: string; name: string; priceCLP: number; maxSlots: number };

const TIER_META: Record<string, { icon: typeof Sparkles; gradient: string; border: string; features: string[] }> = {
  SILVER: {
    icon: Sparkles,
    gradient: "from-slate-300 to-slate-400",
    border: "border-slate-400/20",
    features: ["Acceso a U-Mate", "1 suscripción activa a creadora", "Contenido premium desbloqueado", "Soporte estándar"],
  },
  GOLD: {
    icon: Crown,
    gradient: "from-amber-300 to-amber-500",
    border: "border-amber-400/20",
    features: ["Acceso a U-Mate", "3 suscripciones activas a creadoras", "Contenido premium desbloqueado", "Soporte prioritario"],
  },
  DIAMOND: {
    icon: Diamond,
    gradient: "from-violet-300 to-fuchsia-400",
    border: "border-fuchsia-400/20",
    features: ["Acceso a U-Mate", "5 suscripciones activas a creadoras", "Contenido premium desbloqueado", "Soporte VIP", "Acceso anticipado a nuevas funciones"],
  },
};

export default function PlansPage() {
  const router = useRouter();
  const { me } = useMe();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ plans: Plan[] }>("/umate/plans")
      .then((d) => setPlans(d?.plans || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubscribe = async (tier: string) => {
    if (!me?.user) {
      router.push("/login?next=/umate/plans");
      return;
    }
    setSubscribing(tier);
    try {
      const res = await apiFetch<{ url?: string; error?: string }>("/umate/subscribe", {
        method: "POST",
        body: JSON.stringify({ tier }),
      });
      if (res?.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      if (err?.body?.error === "ALREADY_SUBSCRIBED") {
        router.push("/umate/account");
      }
    } finally {
      setSubscribing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-rose-400" />
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Elige tu plan U-Mate</h1>
        <p className="mt-2 text-sm text-white/50">Suscripción mensual. Cancela cuando quieras.</p>
      </div>

      <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-3">
        {plans.map((plan) => {
          const meta = TIER_META[plan.tier] || TIER_META.SILVER;
          const Icon = meta.icon;
          const isPopular = plan.tier === "GOLD";

          return (
            <div
              key={plan.id}
              className={`relative overflow-hidden rounded-3xl border ${meta.border} bg-white/[0.02] p-6 transition hover:bg-white/[0.04] ${
                isPopular ? "ring-1 ring-amber-400/30 shadow-[0_0_40px_rgba(245,158,11,0.08)]" : ""
              }`}
            >
              {isPopular && (
                <span className="absolute top-4 right-4 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                  POPULAR
                </span>
              )}
              <div className="mb-4 flex items-center gap-2">
                <Icon className={`h-6 w-6 bg-gradient-to-r ${meta.gradient} bg-clip-text text-transparent`} />
                <h2 className="text-lg font-bold">{plan.name}</h2>
              </div>
              <p className="text-3xl font-bold">
                ${plan.priceCLP.toLocaleString("es-CL")}
                <span className="text-sm font-normal text-white/40"> /mes</span>
              </p>
              <p className="mt-1 text-xs text-white/40">
                {plan.maxSlots} {plan.maxSlots === 1 ? "cupo de suscripción" : "cupos de suscripción"}
              </p>

              <ul className="mt-6 space-y-2.5">
                {meta.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-white/60">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.tier)}
                disabled={subscribing !== null}
                className={`mt-6 w-full rounded-xl py-3 text-sm font-semibold text-white transition ${
                  isPopular
                    ? "bg-gradient-to-r from-amber-500 to-rose-500 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                    : "bg-gradient-to-r from-rose-500 to-amber-500 hover:shadow-[0_0_20px_rgba(244,63,94,0.3)]"
                } disabled:opacity-50`}
              >
                {subscribing === plan.tier ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  "Suscribirme"
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-8 text-center text-[11px] text-white/30">
        <p>La suscripción se renueva automáticamente cada mes. Puedes cancelar en cualquier momento.</p>
        <p className="mt-1">Los cupos se reinician cada ciclo de pago. Pago seguro a través de Flow.cl</p>
      </div>
    </div>
  );
}
