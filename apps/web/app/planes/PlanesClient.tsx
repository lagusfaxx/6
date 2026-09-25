"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Coins,
  CreditCard,
  Crown,
  Flame,
  Gem,
  Loader2,
  Rocket,
  Sparkles,
  X,
} from "lucide-react";
import { apiFetch, friendlyErrorMessage } from "../../lib/api";
import useMe from "../../hooks/useMe";

type Code = "SILVER" | "GOLD" | "DIAMOND" | "BUMP" | "SPOTLIGHT";
type Product = {
  id: string;
  kind: "PLAN" | "BOOST";
  code: Code;
  name: string;
  description: string | null;
  duration: number;
  priceClp: number;
  tokens: number;
};
type Me = {
  profileType: string;
  canBuy: boolean;
  plan: { code: "SILVER" | "GOLD" | "DIAMOND"; manual: boolean; expiresAt: string | null } | null;
  membershipExpiresAt: string | null;
  boosts: { id: string; code: Code; name: string; startsAt: string; endsAt: string }[];
  walletBalance: number;
};
type Catalog = {
  products: Product[];
  tokenRate: number;
  billingEnabled: boolean;
  flowAvailable: boolean;
  me: Me | null;
};
type HistoryItem = { id: string; name: string; status: string; method: string; amount: number; createdAt: string };

const RANK = { SILVER: 1, GOLD: 2, DIAMOND: 3 } as const;

/** Lo que da cada plan, en concreto (se ve igual con el cobro apagado). */
const PLAN_PERKS: Record<"SILVER" | "GOLD" | "DIAMOND", string[]> = {
  SILVER: ["Perfil visible en directorio, búsqueda y mapa", "Mensajes con clientes", "Estadísticas de visitas"],
  GOLD: [
    "Todo lo de Silver",
    "Sección Gold en el inicio",
    "Apareces antes que Silver en las búsquedas",
    "Insignia Gold en tu perfil",
  ],
  DIAMOND: [
    "Todo lo de Gold",
    "Sección Diamond sobre el mapa del inicio",
    "Primer lugar entre los planes en las búsquedas",
    "Insignia Diamond y marco destacado",
  ],
};

const BOOST_PERKS: Record<"BUMP" | "SPOTLIGHT", string[]> = {
  BUMP: ["Primer lugar en la búsqueda y los listados de tu comuna", "Por encima de todos los planes mientras dure"],
  SPOTLIGHT: ["Arriba del inicio en “Destacadas”", "Primer lugar en las búsquedas", "Insignia de destacada en tu tarjeta"],
};

const PLAN_STYLE: Record<"SILVER" | "GOLD" | "DIAMOND", { icon: typeof Sparkles; ring: string; text: string; bg: string }> = {
  SILVER: { icon: Sparkles, ring: "border-slate-300/20", text: "text-slate-200", bg: "from-slate-400/10" },
  GOLD: { icon: Crown, ring: "border-amber-400/30", text: "text-amber-300", bg: "from-amber-400/15" },
  DIAMOND: { icon: Gem, ring: "border-cyan-300/30", text: "text-cyan-200", bg: "from-cyan-400/15" },
};

const clp = (n: number) => `$${n.toLocaleString("es-CL")}`;
const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "long" });

function remaining(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "terminó";
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.max(1, Math.round(ms / 60000))} min`;
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} días`;
}

function durationLabel(p: Product) {
  if (p.kind === "PLAN") return p.duration === 30 ? "al mes" : `por ${p.duration} días`;
  if (p.duration % 24 === 0) {
    const d = p.duration / 24;
    return d === 1 ? "por 24 horas" : `por ${d} días`;
  }
  return `por ${p.duration} horas`;
}

export default function PlanesClient() {
  const { me: session } = useMe();
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [paying, setPaying] = useState<null | "FLOW" | "TOKENS">(null);
  const [payError, setPayError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(() => {
    apiFetch<Catalog>("/promo/catalog")
      .then(setData)
      .catch((e) => setError(friendlyErrorMessage(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load, session?.user?.id]);

  useEffect(() => {
    if (!data?.me?.canBuy) return;
    apiFetch<{ history: HistoryItem[] }>("/promo/history")
      .then((r) => setHistory(r.history))
      .catch(() => {});
  }, [data?.me?.canBuy, success]);

  const plans = useMemo(() => (data?.products ?? []).filter((p) => p.kind === "PLAN"), [data]);
  const boosts = useMemo(() => (data?.products ?? []).filter((p) => p.kind === "BOOST"), [data]);
  const me = data?.me ?? null;
  const selling = Boolean(data?.billingEnabled && me?.canBuy);

  const planAction = (p: Product): { label: string; disabled: boolean; hint?: string } => {
    const current = me?.plan;
    const code = p.code as "SILVER" | "GOLD" | "DIAMOND";
    if (!current) return { label: "Activar", disabled: false };
    if (current.manual) {
      return RANK[code] > RANK[current.code]
        ? { label: "Mejorar", disabled: false }
        : { label: "Extender visibilidad", disabled: false, hint: "Mantienes tu rango actual" };
    }
    if (current.code === code) return { label: "Extender", disabled: false };
    if (RANK[code] > RANK[current.code]) return { label: "Mejorar", disabled: false, hint: "Tus días actuales se suman" };
    return { label: "Tienes un plan mayor", disabled: true };
  };

  const pay = async (method: "FLOW" | "TOKENS") => {
    if (!selected) return;
    setPaying(method);
    setPayError("");
    try {
      const r = await apiFetch<{ paid: boolean; url?: string; summary?: string }>("/promo/checkout", {
        method: "POST",
        body: JSON.stringify({ productId: selected.id, method }),
      });
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      setSelected(null);
      setSuccess(r.summary || "Compra activada.");
      load();
    } catch (e) {
      setPayError(friendlyErrorMessage(e));
    } finally {
      setPaying(null);
    }
  };

  if (error) {
    return <div className="mx-auto max-w-4xl px-4 py-10 text-center text-sm text-white/60">{error}</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 pb-24 text-white">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Planes y boosts</h1>
        <p className="mt-1 text-sm text-white/50">Más visibilidad para tu perfil: planes mensuales y empujones puntuales.</p>
      </header>

      {!data ? (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="h-72 animate-pulse rounded-2xl bg-white/[0.04]" />
        </div>
      ) : (
        <>
          {/* Aviso según el interruptor y la cuenta */}
          {!data.billingEnabled ? (
            <div className="mb-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4 text-sm">
              <p className="font-semibold text-emerald-200">Por ahora UZEED es gratis</p>
              <p className="mt-1 text-white/60">
                Publicar no tiene costo ni vencimiento. Los planes y boosts estarán a la venta cuando empiece el cobro; te
                avisaremos con tiempo.
              </p>
            </div>
          ) : !session?.user ? (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
              <p className="text-white/65">Inicia sesión con tu perfil profesional para activar un plan o un boost.</p>
              <Link href="/login?next=/planes" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black">
                Iniciar sesión
              </Link>
            </div>
          ) : me && !me.canBuy ? (
            <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
              Los planes y boosts son para perfiles profesionales.
            </div>
          ) : null}

          {success && (
            <div className="mb-5 flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {success}
            </div>
          )}

          {/* Estado actual */}
          {me?.canBuy && (
            <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Tu perfil hoy</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                {me.plan ? (
                  <span className={`rounded-full border px-3 py-1 font-semibold ${PLAN_STYLE[me.plan.code].ring} ${PLAN_STYLE[me.plan.code].text}`}>
                    {me.plan.code === "DIAMOND" ? "Diamond" : me.plan.code === "GOLD" ? "Gold" : "Silver"}
                    <span className="ml-1 font-normal text-white/50">
                      {me.plan.manual ? "· asignado por UZEED" : `· hasta el ${fecha(me.plan.expiresAt!)}`}
                    </span>
                  </span>
                ) : (
                  <span className="rounded-full border border-white/10 px-3 py-1 text-white/60">Sin plan</span>
                )}
                {me.boosts.map((b) => (
                  <span key={b.id} className="flex items-center gap-1 rounded-full border border-fuchsia-400/30 px-3 py-1 text-fuchsia-200">
                    <Flame className="h-3.5 w-3.5" />
                    {b.name} ·{" "}
                    {new Date(b.startsAt).getTime() > Date.now() ? `empieza en ${remaining(b.startsAt)}` : `quedan ${remaining(b.endsAt)}`}
                  </span>
                ))}
                {me.walletBalance > 0 && (
                  <span className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-white/60">
                    <Coins className="h-3.5 w-3.5 text-amber-300" /> {me.walletBalance} tokens
                  </span>
                )}
              </div>
            </section>
          )}

          {/* Planes */}
          <h2 className="mb-3 text-lg font-semibold">Planes mensuales</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {plans.map((p) => {
              const code = p.code as "SILVER" | "GOLD" | "DIAMOND";
              const st = PLAN_STYLE[code];
              const Icon = st.icon;
              const action = planAction(p);
              const isCurrent = me?.plan?.code === code;
              return (
                <article
                  key={p.id}
                  className={`relative flex flex-col rounded-2xl border bg-gradient-to-b ${st.bg} to-transparent p-5 ${st.ring} ${
                    code === "GOLD" ? "md:-translate-y-1" : ""
                  }`}
                >
                  {code === "GOLD" && (
                    <span className="absolute -top-2.5 left-5 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-black">
                      Más elegido
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${st.text}`} />
                    <h3 className={`text-lg font-bold ${st.text}`}>{p.name}</h3>
                    {isCurrent && <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px]">Tu plan</span>}
                  </div>
                  <p className="mt-3 text-2xl font-bold">
                    {clp(p.priceClp)} <span className="text-sm font-normal text-white/45">{durationLabel(p)}</span>
                  </p>
                  {selling && <p className="text-[11px] text-white/35">o {p.tokens} tokens</p>}
                  <ul className="mt-4 flex-1 space-y-1.5 text-sm text-white/70">
                    {PLAN_PERKS[code].map((perk) => (
                      <li key={perk} className="flex gap-2">
                        <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${st.text}`} /> {perk}
                      </li>
                    ))}
                  </ul>
                  {selling && (
                    <>
                      <button
                        type="button"
                        disabled={action.disabled}
                        onClick={() => {
                          setPayError("");
                          setSelected(p);
                        }}
                        className="mt-5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:bg-white/10 disabled:text-white/40"
                      >
                        {action.label}
                      </button>
                      {action.hint && <p className="mt-1.5 text-center text-[11px] text-white/40">{action.hint}</p>}
                    </>
                  )}
                </article>
              );
            })}
          </div>

          {/* Boosts */}
          {boosts.length > 0 && (
            <>
              <h2 className="mb-1 mt-8 text-lg font-semibold">Boosts</h2>
              <p className="mb-3 text-sm text-white/45">Un empujón puntual, sumado a tu plan. Si compras otro igual, se encadena.</p>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {boosts.map((p) => {
                  const code = p.code as "BUMP" | "SPOTLIGHT";
                  return (
                    <article key={p.id} className="flex flex-col rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/[0.05] p-5">
                      <div className="flex items-center gap-2">
                        {code === "SPOTLIGHT" ? (
                          <Flame className="h-5 w-5 text-fuchsia-300" />
                        ) : (
                          <Rocket className="h-5 w-5 text-fuchsia-300" />
                        )}
                        <h3 className="font-bold">{p.name}</h3>
                      </div>
                      <p className="mt-3 text-xl font-bold">
                        {clp(p.priceClp)} <span className="text-sm font-normal text-white/45">{durationLabel(p)}</span>
                      </p>
                      {selling && <p className="text-[11px] text-white/35">o {p.tokens} tokens</p>}
                      <ul className="mt-3 flex-1 space-y-1.5 text-sm text-white/70">
                        {BOOST_PERKS[code].map((perk) => (
                          <li key={perk} className="flex gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300" /> {perk}
                          </li>
                        ))}
                      </ul>
                      {selling && (
                        <button
                          type="button"
                          onClick={() => {
                            setPayError("");
                            setSelected(p);
                          }}
                          className="mt-5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                        >
                          Activar
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {!session?.user && (
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
              <p className="font-semibold">¿Aún no publicas en UZEED?</p>
              <p className="mt-1 text-sm text-white/55">Crea tu perfil y elige tu plan cuando quieras.</p>
              <Link
                href="/publicate"
                className="mt-3 inline-flex rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold"
              >
                Publicar mi perfil
              </Link>
            </div>
          )}

          {/* Historial */}
          {history.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-2 text-sm font-semibold text-white/70">Tus compras</h2>
              <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/10 bg-white/[0.02] text-sm">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0 truncate">{h.name}</span>
                    <span className="shrink-0 text-xs text-white/45">
                      {clp(h.amount)} · {h.method === "TOKENS" ? "tokens" : "Flow"} ·{" "}
                      {h.status === "PAID" ? fecha(h.createdAt) : "pendiente"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Pago */}
      {selected && data && me && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !paying && setSelected(null)} />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0e1a] p-5">
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setSelected(null)}
              disabled={Boolean(paying)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-white/40 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Confirmar compra</p>
            <h3 className="mt-1 text-lg font-bold">{selected.name}</h3>
            <p className="text-sm text-white/55">
              {clp(selected.priceClp)} {durationLabel(selected)}
            </p>

            <div className="mt-4 space-y-2">
              {data.flowAvailable && (
                <button
                  type="button"
                  onClick={() => pay("FLOW")}
                  disabled={Boolean(paying)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/25 disabled:opacity-50"
                >
                  <CreditCard className="h-5 w-5 text-white/70" />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">Tarjeta o transferencia</span>
                    <span className="block text-xs text-white/45">Pago seguro con Flow · {clp(selected.priceClp)}</span>
                  </span>
                  {paying === "FLOW" && <Loader2 className="h-4 w-4 animate-spin" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => pay("TOKENS")}
                disabled={Boolean(paying) || me.walletBalance < selected.tokens}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/25 disabled:opacity-50"
              >
                <Coins className="h-5 w-5 text-amber-300" />
                <span className="flex-1">
                  <span className="block text-sm font-semibold">Con tokens de mi billetera</span>
                  <span className="block text-xs text-white/45">
                    {selected.tokens} tokens · tienes {me.walletBalance}
                    {me.walletBalance < selected.tokens && " (no alcanza)"}
                  </span>
                </span>
                {paying === "TOKENS" && <Loader2 className="h-4 w-4 animate-spin" />}
              </button>
            </div>

            {payError && <p className="mt-3 text-sm text-red-300">{payError}</p>}
            <p className="mt-3 text-[11px] text-white/35">
              Con tokens se activa al instante. Con Flow, apenas se confirme el pago.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
