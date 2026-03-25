"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Crown, Diamond, Check, Loader2, Shield } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import useMe from "../../../hooks/useMe";

type Plan = { id: string; tier: string; name: string; priceCLP: number; maxSlots: number };

const TIER_META: Record<string, { icon: typeof Sparkles; accent: string; features: string[] }> = {
  SILVER: { icon: Sparkles, accent: "from-slate-500 to-slate-700", features: ["1 cupo mensual", "Acceso premium", "Renovación automática"] },
  GOLD: { icon: Crown, accent: "from-amber-500 to-orange-500", features: ["3 cupos mensuales", "Mayor flexibilidad", "Soporte prioritario"] },
  DIAMOND: { icon: Diamond, accent: "from-violet-600 to-fuchsia-600", features: ["5 cupos mensuales", "Máxima conversión", "Beneficios VIP"] },
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
    apiFetch<{ plans: Plan[] }>("/umate/plans").then((d) => setPlans(d?.plans || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!me?.user) return;
    apiFetch<{ creator: any }>("/umate/creator/me").then((d) => setIsCreator(Boolean(d?.creator && d.creator.status !== "SUSPENDED"))).catch(() => {});
  }, [me]);

  const handleSubscribe = async (tier: string) => {
    if (!me?.user) return router.push("/login?next=/umate/plans");
    if (isCreator) return setSubError("Las creadoras no pueden suscribirse a planes de cliente.");
    setSubscribing(tier);
    setSubError("");
    try {
      const res = await apiFetch<{ url?: string }>("/umate/subscribe", { method: "POST", body: JSON.stringify({ tier }) });
      if (res?.url) window.location.href = res.url;
    } catch {
      setSubError("No pudimos iniciar tu suscripción. Intenta nuevamente.");
    } finally {
      setSubscribing(null);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" /></div>;

  return (
    <div className="space-y-6 py-4 pb-12">
      <header className="rounded-3xl border border-fuchsia-100 bg-gradient-to-br from-white via-rose-50/70 to-amber-50 p-8 text-center">
        <h1 className="text-3xl font-black text-slate-900">Planes U-Mate</h1>
        <p className="mt-2 text-sm text-slate-600">Cada plan incluye cupos mensuales para suscribirte a creadoras. Tú decides cómo distribuirlos.</p>
      </header>

      {isCreator && (
        <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800">
          <Shield className="mx-auto mb-1 h-4 w-4" /> Las cuentas creadora no pueden activar planes de cliente.
        </div>
      )}
      {subError && <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">{subError}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const meta = TIER_META[plan.tier] || TIER_META.SILVER;
          const Icon = meta.icon;
          const isPopular = plan.tier === "GOLD";
          return (
            <div key={plan.id} className={`rounded-3xl border bg-white p-6 shadow-sm ${isPopular ? "border-amber-300 ring-2 ring-amber-100" : "border-slate-100"}`}>
              {isPopular && <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-amber-700">Más elegido</p>}
              <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-r ${meta.accent} text-white`}><Icon className="h-5 w-5" /></div>
              <h2 className="mt-3 text-lg font-black text-slate-900">{plan.name}</h2>
              <p className="text-3xl font-black text-slate-900">${plan.priceCLP.toLocaleString("es-CL")}</p>
              <p className="text-xs text-slate-500">{plan.maxSlots} cupos por ciclo mensual</p>
              <ul className="mt-4 space-y-2">
                {meta.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-700"><Check className="h-4 w-4 text-emerald-600" />{f}</li>
                ))}
              </ul>
              <button onClick={() => handleSubscribe(plan.tier)} disabled={subscribing !== null || isCreator} className="mt-5 w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 py-3 text-sm font-bold text-white disabled:opacity-60">
                {subscribing === plan.tier ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Activar plan"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
