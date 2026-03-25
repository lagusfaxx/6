"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronRight,
  Crown,
  Diamond,
  HelpCircle,
  Loader2,
  Shield,
  Sparkles,
  Star,
  Users,
  Zap,
} from "lucide-react";
import { apiFetch } from "../../../lib/api";
import useMe from "../../../hooks/useMe";

type Plan = { id: string; tier: string; name: string; priceCLP: number; maxSlots: number };

const TIER_META: Record<string, { icon: typeof Sparkles; gradient: string; accent: string; shadow: string; features: string[]; subtitle: string }> = {
  SILVER: {
    icon: Sparkles,
    gradient: "from-slate-500 to-slate-700",
    accent: "text-slate-700",
    shadow: "shadow-slate-200/50",
    subtitle: "Entrada premium",
    features: ["1 cupo mensual de creadora premium", "Acceso a contenido exclusivo", "Soporte estándar", "Renovación automática"],
  },
  GOLD: {
    icon: Crown,
    gradient: "from-amber-500 to-orange-500",
    accent: "text-amber-700",
    shadow: "shadow-amber-200/50",
    subtitle: "El más elegido",
    features: ["3 cupos mensuales de creadoras premium", "Mayor flexibilidad de discovery", "Soporte prioritario", "Insignia de fan Gold"],
  },
  DIAMOND: {
    icon: Diamond,
    gradient: "from-violet-600 to-fuchsia-600",
    accent: "text-violet-700",
    shadow: "shadow-violet-200/50",
    subtitle: "Máximo alcance",
    features: ["5 cupos mensuales de creadoras premium", "Máxima conversión y acceso", "Beneficios VIP exclusivos", "Acceso anticipado a novedades"],
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
    if (!me?.user) return;
    apiFetch<{ creator: any }>("/umate/creator/me")
      .then((d) => setIsCreator(Boolean(d?.creator && d.creator.status !== "SUSPENDED")))
      .catch(() => {});
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

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" />
      </div>
    );

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="border-b border-slate-100 bg-gradient-to-b from-amber-50/50 via-orange-50/30 to-white pb-10 pt-8 lg:pb-14 lg:pt-14">
        <div className="mx-auto max-w-[1320px] px-4 text-center lg:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-4 py-1.5 text-xs font-bold text-amber-800">
            <Crown className="h-3.5 w-3.5" /> Planes de suscripción
          </span>
          <h1 className="mt-4 text-4xl font-black text-slate-900 md:text-5xl">
            Desbloquea contenido{" "}
            <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">exclusivo</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 md:text-base">
            Cada plan incluye cupos mensuales para suscribirte a creadoras premium. Elige según cuánto quieras explorar y desbloquear.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1320px] px-4 py-10 lg:px-6 lg:py-14">
        {isCreator && (
          <div className="mx-auto mb-6 max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800">
            <Shield className="mx-auto mb-1 h-5 w-5" /> Las cuentas creadora no pueden activar planes de cliente.
          </div>
        )}
        {subError && (
          <div className="mx-auto mb-6 max-w-xl rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">{subError}</div>
        )}

        {/* Plans grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const meta = TIER_META[plan.tier] || TIER_META.SILVER;
            const Icon = meta.icon;
            const isPopular = plan.tier === "GOLD";
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-3xl border bg-white p-7 transition duration-300 hover:-translate-y-1 hover:shadow-2xl ${
                  isPopular ? "border-amber-300 shadow-xl " + meta.shadow + " ring-1 ring-amber-200" : "border-slate-100 shadow-sm hover:shadow-lg"
                }`}
              >
                {isPopular && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-1.5 text-[11px] font-black uppercase tracking-wider text-white shadow-lg shadow-amber-300/50">
                    Más popular
                  </span>
                )}

                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r ${meta.gradient} text-white shadow-xl ${meta.shadow}`}>
                  <Icon className="h-7 w-7" />
                </div>

                <p className={`mt-4 text-xs font-bold uppercase tracking-wider ${meta.accent}`}>{meta.subtitle}</p>
                <h2 className="mt-1 text-2xl font-black text-slate-900">{plan.name}</h2>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-slate-900">${plan.priceCLP.toLocaleString("es-CL")}</span>
                  <span className="text-sm font-semibold text-slate-400">/mes</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{plan.maxSlots} cupo{plan.maxSlots > 1 ? "s" : ""} por ciclo mensual</p>

                <ul className="mt-6 flex-1 space-y-3">
                  {meta.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.tier)}
                  disabled={subscribing !== null || isCreator}
                  className={`mt-7 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition disabled:opacity-50 ${
                    isPopular
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 shadow-xl shadow-amber-300/40 hover:brightness-105"
                      : "bg-gradient-to-r from-fuchsia-600 to-rose-500 shadow-lg shadow-fuchsia-300/30 hover:brightness-105"
                  }`}
                >
                  {subscribing === plan.tier ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Activar plan <ArrowRight className="h-4 w-4" /></>}
                </button>
              </div>
            );
          })}
        </div>

        {/* Comparison table */}
        <div className="mt-14 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <h3 className="text-sm font-bold text-slate-900">Comparación detallada</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Característica</th>
                  {plans.map((p) => (
                    <th key={p.id} className="px-4 py-3 text-center text-xs font-bold text-slate-700">{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Cupos mensuales", values: plans.map((p) => String(p.maxSlots)) },
                  { label: "Contenido premium", values: plans.map(() => "✓") },
                  { label: "Soporte prioritario", values: plans.map((p) => p.tier !== "SILVER" ? "✓" : "—") },
                  { label: "Beneficios VIP", values: plans.map((p) => p.tier === "DIAMOND" ? "✓" : "—") },
                  { label: "Insignia de fan", values: plans.map((p) => p.tier !== "SILVER" ? "✓" : "—") },
                ].map((row) => (
                  <tr key={row.label} className="border-b border-slate-50">
                    <td className="px-6 py-3 text-slate-700">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className={`px-4 py-3 text-center font-semibold ${v === "✓" ? "text-emerald-600" : v === "—" ? "text-slate-300" : "text-slate-700"}`}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-14">
          <h3 className="text-center text-2xl font-black text-slate-900">Preguntas frecuentes</h3>
          <div className="mx-auto mt-6 max-w-2xl space-y-3">
            {[
              { q: "¿Qué es un cupo mensual?", a: "Cada cupo te permite suscribirte a una creadora premium. La cantidad de cupos depende de tu plan." },
              { q: "¿Puedo cambiar de plan?", a: "Sí, puedes subir o bajar tu plan en cualquier momento. El cambio aplica en tu próximo ciclo de facturación." },
              { q: "¿Cómo funciona la renovación?", a: "Todos los planes se renuevan automáticamente cada mes. Puedes cancelar cuando quieras sin penalización." },
              { q: "¿Los pagos son seguros?", a: "Todos los pagos se procesan a través de pasarelas de pago seguras con encriptación de nivel bancario." },
            ].map((item) => (
              <details key={item.q} className="group rounded-xl border border-slate-100 bg-white">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold text-slate-900">
                  {item.q}
                  <ChevronRight className="h-4 w-4 text-slate-400 transition group-open:rotate-90" />
                </summary>
                <p className="px-5 pb-4 text-sm text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
