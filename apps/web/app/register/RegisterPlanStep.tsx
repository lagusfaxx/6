"use client";

import { useState } from "react";
import { CheckCircle2, Crown, Gem, Loader2, Sparkles } from "lucide-react";
import { apiFetch, friendlyErrorMessage } from "../../lib/api";
import { trialLabel, type BillingInfo, type CatalogProduct } from "../../hooks/useBillingInfo";

const PERKS: Record<"SILVER" | "GOLD" | "DIAMOND", string[]> = {
  SILVER: ["Perfil visible en directorio, búsqueda y mapa", "Mensajes con clientes"],
  GOLD: ["Sección Gold en el inicio", "Antes que Silver en las búsquedas", "Insignia Gold"],
  DIAMOND: ["Sección Diamond sobre el mapa del inicio", "Primero entre los planes en búsquedas", "Insignia Diamond"],
};

const STYLE = {
  SILVER: { icon: Sparkles, text: "text-slate-200", border: "border-slate-300/25", bg: "bg-slate-400/[0.06]" },
  GOLD: { icon: Crown, text: "text-amber-300", border: "border-amber-400/35", bg: "bg-amber-400/[0.07]" },
  DIAMOND: { icon: Gem, text: "text-cyan-200", border: "border-cyan-300/35", bg: "bg-cyan-400/[0.07]" },
} as const;

const clp = (n: number) => `$${n.toLocaleString("es-CL")}`;

/**
 * Último paso del registro de una profesional, sólo con el cobro encendido:
 * la cuenta ya existe (con su prueba gratis) y aquí elige si parte gratis o
 * con un plan pagado. Pagar lleva a Flow y vuelve al estudio.
 */
export default function RegisterPlanStep({ info, onSkip }: { info: BillingInfo; onSkip: () => void }) {
  const [paying, setPaying] = useState<string | null>(null);
  const [error, setError] = useState("");

  const plans = info.products.filter((p) => p.kind === "PLAN") as (CatalogProduct & {
    code: "SILVER" | "GOLD" | "DIAMOND";
  })[];
  const hasTrial = info.trialDays > 0;
  // Con prueba gratis, Silver ya está incluido: se ofrecen sólo los planes que suman algo.
  const offered = plans.filter((p) => (hasTrial ? p.code !== "SILVER" : true));

  const pay = async (p: CatalogProduct) => {
    setPaying(p.id);
    setError("");
    try {
      const r = await apiFetch<{ url?: string }>("/promo/checkout", {
        method: "POST",
        body: JSON.stringify({ productId: p.id, method: "FLOW", returnTo: "studio" }),
      });
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      onSkip();
    } catch (e) {
      setError(friendlyErrorMessage(e));
      setPaying(null);
    }
  };

  return (
    <div className="relative p-6 sm:p-8">
      <div className="mb-5 flex items-center gap-2 text-emerald-300">
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-semibold">Tu cuenta está creada</span>
      </div>
      <h2 className="text-xl font-bold text-white">Elige cómo empezar</h2>
      <p className="mt-1 text-sm text-white/55">Puedes cambiar de plan cuando quieras desde “Planes y boosts”.</p>

      <div className="mt-5 space-y-3">
        {/* Gratis */}
        <button
          type="button"
          onClick={onSkip}
          disabled={Boolean(paying)}
          className="w-full rounded-2xl border border-white/15 bg-white/[0.04] p-4 text-left transition hover:border-white/30 disabled:opacity-50"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-base font-bold text-white">
              {hasTrial ? `Empezar gratis — ${trialLabel(info.trialDays)}` : "Continuar sin plan"}
            </span>
            <span className="text-sm font-semibold text-white/70">{hasTrial ? "$0" : ""}</span>
          </div>
          <p className="mt-1 text-xs text-white/50">
            {hasTrial
              ? `Plan Silver incluido durante tu prueba: perfil visible y mensajes con clientes. Después, desde ${clp(
                  plans.find((p) => p.code === "SILVER")?.priceClp ?? 0,
                )} al mes.`
              : "Tu perfil no se mostrará hasta que actives un plan."}
          </p>
        </button>

        {info.flowAvailable &&
          offered.map((p) => {
            const st = STYLE[p.code];
            const Icon = st.icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => pay(p)}
                disabled={Boolean(paying)}
                className={`w-full rounded-2xl border p-4 text-left transition hover:brightness-125 disabled:opacity-50 ${st.border} ${st.bg}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`flex items-center gap-2 text-base font-bold ${st.text}`}>
                    <Icon className="h-4 w-4" /> {p.name}
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {paying === p.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        {clp(p.priceClp)}
                        <span className="ml-1 text-xs font-normal text-white/45">
                          {p.duration === 30 ? "/ mes" : `/ ${p.duration} días`}
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <ul className="mt-2 space-y-0.5 text-xs text-white/60">
                  {PERKS[p.code].map((perk) => (
                    <li key={perk}>• {perk}</li>
                  ))}
                </ul>
              </button>
            );
          })}
      </div>

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
      <p className="mt-4 text-[11px] text-white/35">Pago seguro con Flow (tarjeta o transferencia).</p>
    </div>
  );
}
