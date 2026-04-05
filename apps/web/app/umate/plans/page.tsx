"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Crown,
  Diamond,
  Loader2,
  Shield,
  Sparkles,
} from "lucide-react";
import { apiFetch } from "../../../lib/api";
import useMe from "../../../hooks/useMe";

type Plan = { id: string; tier: string; name: string; priceCLP: number; maxSlots: number };

const TIER_META: Record<string, { icon: typeof Sparkles; color: string; features: string[]; subtitle: string }> = {
  SILVER: {
    icon: Sparkles,
    color: "#94a3b8",
    subtitle: "Entrada premium",
    features: ["Sigue a 1 creadora premium", "Acceso a fotos y videos exclusivos", "Soporte estándar", "Renovación automática"],
  },
  GOLD: {
    icon: Crown,
    color: "#f59e0b",
    subtitle: "El más elegido",
    features: ["Sigue hasta 3 creadoras premium", "Contenido exclusivo sin límites", "Soporte prioritario", "Insignia de fan Gold"],
  },
  DIAMOND: {
    icon: Diamond,
    color: "#8b5cf6",
    subtitle: "Máximo alcance",
    features: ["Sigue hasta 5 creadoras premium", "Acceso completo a todo el contenido", "Beneficios VIP exclusivos", "Acceso anticipado a novedades"],
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
    } catch (err: any) {
      if (err?.status === 400 && err?.body?.error === "ALREADY_SUBSCRIBED") {
        setSubError("Ya tienes un plan activo. Ve a tu cuenta para administrarlo.");
      } else if (err?.status === 401) {
        router.push("/login?next=/umate/plans");
        return;
      } else {
        setSubError(err?.body?.message || "No pudimos iniciar tu suscripcion. Intenta nuevamente.");
      }
    } finally {
      setSubscribing(null);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-[#00aff0]/60" />
      </div>
    );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-white/[0.03] py-12 text-center lg:py-16">
        <div className="mx-auto max-w-[700px] px-4">
          <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Elige tu plan
          </h1>
          <p className="mt-3 text-[15px] text-white/35 leading-relaxed">
            Suscríbete a creadoras y accede a su contenido exclusivo. Cada plan define a cuántas creadoras puedes seguir simultáneamente.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[900px] px-4 py-10 lg:py-14">
        {/* How it works */}
        <div className="mb-10 grid gap-4 text-center sm:grid-cols-3">
          {[
            { step: "1", title: "Elige un plan", desc: "Selecciona según cuántas creadoras quieras seguir." },
            { step: "2", title: "Sigue creadoras", desc: "Suscríbete a las creadoras que más te gusten." },
            { step: "3", title: "Disfruta el contenido", desc: "Accede a fotos, videos y publicaciones exclusivas." },
          ].map((s) => (
            <div key={s.step} className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#00aff0]/10 text-sm font-bold text-[#00aff0]">{s.step}</div>
              <p className="mt-3 text-sm font-bold text-white/80">{s.title}</p>
              <p className="mt-1 text-xs text-white/40">{s.desc}</p>
            </div>
          ))}
        </div>

        {isCreator && (
          <div className="mx-auto mb-6 max-w-md rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4 text-center text-sm text-amber-400/80">
            <Shield className="mx-auto mb-1 h-5 w-5" /> Las cuentas creadora no pueden activar planes de cliente.
          </div>
        )}
        {subError && (
          <div className="mx-auto mb-6 max-w-md rounded-xl border border-red-500/20 bg-red-500/[0.05] p-4 text-center text-sm text-red-400/80">{subError}</div>
        )}

        {/* Plans grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const meta = TIER_META[plan.tier] || TIER_META.SILVER;
            const Icon = meta.icon;
            const isPopular = plan.tier === "GOLD";
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-7 transition-all duration-300 hover:-translate-y-0.5 ${
                  isPopular
                    ? "border-[#00aff0]/25 bg-[#00aff0]/[0.03] shadow-[0_8px_40px_rgba(0,175,240,0.08)]"
                    : "border-white/[0.04] bg-white/[0.015] hover:border-white/[0.1]"
                }`}
              >
                {isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#00aff0] px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-[0_2px_12px_rgba(0,175,240,0.35)]">
                    Más popular
                  </span>
                )}

                <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: `${meta.color}15` }}>
                  <Icon className="h-5 w-5" style={{ color: meta.color }} />
                </div>

                <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-white/40">{meta.subtitle}</p>
                <h2 className="mt-1 text-xl font-extrabold text-white">{plan.name}</h2>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">${plan.priceCLP.toLocaleString("es-CL")}</span>
                  <span className="text-sm text-white/40">/mes</span>
                </div>
                <p className="mt-1 text-xs text-white/40">Sigue a {plan.maxSlots} creadora{plan.maxSlots > 1 ? "s" : ""} al mes</p>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {meta.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/50">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.tier)}
                  disabled={subscribing !== null || isCreator}
                  className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all duration-200 disabled:opacity-40 ${
                    isPopular
                      ? "bg-gradient-to-r from-[#00aff0] to-[#0090d0] text-white shadow-[0_4px_20px_rgba(0,175,240,0.3)] hover:shadow-[0_6px_28px_rgba(0,175,240,0.4)]"
                      : "border border-white/[0.08] bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white hover:border-white/[0.12]"
                  }`}
                >
                  {subscribing === plan.tier ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Activar plan <ArrowRight className="h-4 w-4" /></>}
                </button>
              </div>
            );
          })}
        </div>

        {/* Comparison table */}
        <div className="mt-16 overflow-hidden rounded-2xl border border-white/[0.04]">
          <div className="border-b border-white/[0.04] bg-white/[0.015] px-6 py-4">
            <h3 className="text-sm font-bold tracking-wide text-white">Comparación detallada</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/40">Característica</th>
                  {plans.map((p) => (
                    <th key={p.id} className="px-4 py-3 text-center text-xs font-bold text-white/50">{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Creadoras simultáneas", values: plans.map((p) => String(p.maxSlots)) },
                  { label: "Contenido premium", values: plans.map(() => "check") },
                  { label: "Soporte prioritario", values: plans.map((p) => p.tier !== "SILVER" ? "check" : "dash") },
                  { label: "Beneficios VIP", values: plans.map((p) => p.tier === "DIAMOND" ? "check" : "dash") },
                  { label: "Insignia de fan", values: plans.map((p) => p.tier !== "SILVER" ? "check" : "dash") },
                ].map((row) => (
                  <tr key={row.label} className="border-b border-white/[0.03]">
                    <td className="px-6 py-3 text-white/40">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className="px-4 py-3 text-center">
                        {v === "check" ? (
                          <Check className="mx-auto h-4 w-4 text-emerald-500" />
                        ) : v === "dash" ? (
                          <span className="text-white/10">—</span>
                        ) : (
                          <span className="font-semibold text-white/60">{v}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16">
          <h3 className="text-center text-xl font-bold tracking-tight text-white">Preguntas frecuentes</h3>
          <div className="mx-auto mt-8 max-w-2xl space-y-2">
            {[
              { q: "¿Cómo funcionan los planes?", a: "Cada plan te permite seguir a un número determinado de creadoras premium al mismo tiempo. Por ejemplo, con Gold puedes acceder al contenido exclusivo de hasta 3 creadoras." },
              { q: "¿Puedo cambiar de plan?", a: "Sí, puedes subir o bajar tu plan en cualquier momento. El cambio aplica en tu próximo ciclo de facturación." },
              { q: "¿Cómo funciona la renovación?", a: "Todos los planes se renuevan automáticamente cada mes. Puedes cancelar cuando quieras sin penalización." },
              { q: "¿Los pagos son seguros?", a: "Todos los pagos se procesan a través de pasarelas de pago seguras con encriptación de nivel bancario." },
            ].map((item) => (
              <details key={item.q} className="group rounded-2xl border border-white/[0.04] bg-white/[0.015] transition-colors duration-200 hover:border-white/[0.07]">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-medium text-white/60 transition-colors duration-200 hover:text-white/80">
                  {item.q}
                  <ChevronRight className="h-4 w-4 text-white/40 transition-transform duration-200 group-open:rotate-90" />
                </summary>
                <p className="px-5 pb-4 text-sm text-white/45">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
        {/* Creator CTA */}
        <div className="mt-16 rounded-2xl border border-fuchsia-500/15 bg-gradient-to-br from-fuchsia-500/[0.04] via-violet-500/[0.02] to-transparent p-8 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-fuchsia-400/70" />
          <h3 className="mt-3 text-lg font-bold text-white">¿Quieres ganar dinero como creadora?</h3>
          <p className="mt-2 text-sm text-white/40 leading-relaxed max-w-md mx-auto">
            Publica contenido exclusivo, recibe pagos de tus fans y retira tus ganancias. Tú decides el precio.
          </p>
          <Link
            href="/umate/onboarding"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(168,85,247,0.3)] transition hover:shadow-[0_6px_28px_rgba(168,85,247,0.4)]"
          >
            <Sparkles className="h-4 w-4" /> Comenzar como creadora
          </Link>
        </div>
      </div>
    </div>
  );
}
