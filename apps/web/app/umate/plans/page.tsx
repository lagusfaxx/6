"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Crown, Diamond, Check, Loader2, Shield, ArrowLeft } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import useMe from "../../../hooks/useMe";

type Plan = { id: string; tier: string; name: string; priceCLP: number; maxSlots: number };

const TIER_META: Record<string, { icon: typeof Sparkles; gradient: string; bgGradient: string; border: string; features: string[] }> = {
  SILVER: {
    icon: Sparkles,
    gradient: "from-slate-300 to-slate-500",
    bgGradient: "from-slate-500/[0.06] to-transparent",
    border: "border-slate-400/15",
    features: ["Acceso a U-Mate", "1 suscripción activa a creadora", "Contenido premium desbloqueado"],
  },
  GOLD: {
    icon: Crown,
    gradient: "from-amber-300 to-amber-600",
    bgGradient: "from-amber-500/[0.06] to-transparent",
    border: "border-amber-400/20",
    features: ["Acceso a U-Mate", "3 suscripciones activas a creadoras", "Contenido premium desbloqueado", "Soporte prioritario"],
  },
  DIAMOND: {
    icon: Diamond,
    gradient: "from-violet-300 to-fuchsia-500",
    bgGradient: "from-fuchsia-500/[0.06] to-transparent",
    border: "border-fuchsia-400/15",
    features: ["Acceso a U-Mate", "5 suscripciones activas a creadoras", "Contenido premium desbloqueado", "Soporte VIP", "Acceso anticipado a nuevas funciones"],
  },
};

export default function PlansPage() {
  const router = useRouter();
  const { me } = useMe();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [subError, setSubError] = useState("");

  useEffect(() => {
    apiFetch<{ plans: Plan[] }>("/umate/plans")
      .then((d) => setPlans(d?.plans || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (me?.user) {
      apiFetch<{ creator: any }>("/umate/creator/me")
        .then((d) => setIsCreator(Boolean(d?.creator && d.creator.status !== "SUSPENDED")))
        .catch(() => {});
    }
  }, [me]);

  const handleSubscribe = async (tier: string) => {
    if (!me?.user) {
      router.push("/login?next=/umate/plans");
      return;
    }
    if (isCreator) {
      setSubError("Las creadoras no pueden suscribirse a planes de cliente.");
      return;
    }
    setSubscribing(tier);
    setSubError("");
    try {
      const res = await apiFetch<{ url?: string; error?: string }>("/umate/subscribe", {
        method: "POST",
        body: JSON.stringify({ tier }),
      });
      if (res?.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      const code = err?.body?.error;
      if (code === "ALREADY_SUBSCRIBED") {
        router.push("/umate/account");
      } else if (code === "CREATOR_CANNOT_SUBSCRIBE") {
        setSubError("Las creadoras no pueden suscribirse a planes de cliente.");
      }
    } finally {
      setSubscribing(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-rose-400/60" /></div>;
  }

  return (
    <div className="py-8 pb-12">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Elige tu plan{" "}
          <span className="bg-gradient-to-r from-rose-400 to-amber-400 bg-clip-text text-transparent">U-Mate</span>
        </h1>
        <p className="mt-3 text-sm text-white/40">Suscripción mensual. Cancela cuando quieras. Cupos se reinician cada ciclo.</p>
      </div>

      {/* Creator warning */}
      {isCreator && (
        <div className="mx-auto mb-8 max-w-md rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4 text-center">
          <Shield className="mx-auto mb-2 h-5 w-5 text-amber-400" />
          <p className="text-xs text-white/50">Las creadoras no pueden suscribirse a planes de cliente. Para suscribirte, usa una cuenta diferente.</p>
        </div>
      )}

      {subError && (
        <div className="mx-auto mb-6 max-w-md rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-center text-xs text-red-300">
          {subError}
        </div>
      )}

      <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-3">
        {plans.map((plan) => {
          const meta = TIER_META[plan.tier] || TIER_META.SILVER;
          const Icon = meta.icon;
          const isPopular = plan.tier === "GOLD";

          return (
            <div
              key={plan.id}
              className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br ${meta.bgGradient} p-7 transition hover:shadow-lg ${meta.border} ${
                isPopular ? "ring-1 ring-amber-400/25 shadow-[0_0_50px_rgba(245,158,11,0.08)]" : ""
              }`}
            >
              {isPopular && (
                <span className="absolute top-4 right-4 rounded-full bg-amber-500/25 px-3 py-0.5 text-[10px] font-bold text-amber-200">
                  POPULAR
                </span>
              )}
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.gradient} shadow-lg`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <h2 className="mt-4 text-lg font-extrabold">{plan.name}</h2>
              <p className="mt-2 text-3xl font-extrabold">
                ${plan.priceCLP.toLocaleString("es-CL")}
                <span className="text-sm font-normal text-white/30"> /mes</span>
              </p>
              <p className="mt-1 text-xs text-white/35">
                {plan.maxSlots} {plan.maxSlots === 1 ? "cupo de suscripción" : "cupos de suscripción"}
              </p>

              <ul className="mt-6 space-y-2.5">
                {meta.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-xs text-white/50">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400/70" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.tier)}
                disabled={subscribing !== null || isCreator}
                className={`mt-7 w-full rounded-xl py-3.5 text-sm font-bold text-white transition ${
                  isCreator
                    ? "bg-white/[0.06] text-white/25 cursor-not-allowed"
                    : isPopular
                    ? "bg-gradient-to-r from-amber-500 to-rose-500 hover:shadow-[0_0_25px_rgba(245,158,11,0.3)]"
                    : "bg-gradient-to-r from-rose-500 to-pink-500 hover:shadow-[0_0_25px_rgba(244,63,94,0.3)]"
                } disabled:opacity-50`}
              >
                {subscribing === plan.tier ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : isCreator ? (
                  "No disponible"
                ) : (
                  "Suscribirme"
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-10 text-center text-[11px] text-white/20 space-y-1">
        <p>La suscripción se renueva automáticamente cada mes. Puedes cancelar en cualquier momento.</p>
        <p>Los cupos se reinician cada ciclo de pago. Pago seguro a través de Flow.cl</p>
      </div>
    </div>
  );
}
