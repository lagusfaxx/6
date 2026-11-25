"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Crown, Loader2, Sparkles } from "lucide-react";
import useMe from "../../../hooks/useMe";
import { apiFetch } from "../../../lib/api";
import { apiErrorMessage, TIER_LABEL, type AiAccount, type Tier } from "../../../lib/aiCompanions";

type Pricing = {
  days: number;
  plans: {
    tier: Tier;
    tokens: number;
    dailyMessages: number;
    memoryLimit: number;
    contextMessages: number;
    autoMemory: boolean;
    imageTokens: number;
  }[];
};

const EXTRAS: Record<Tier, string[]> = {
  FREE: ["Personajes gratuitos del catálogo", "Memoria manual"],
  PREMIUM: ["Personajes Premium", "Memoria automática y resumen de conversaciones"],
  VIP: ["Todos los personajes, incluidos los exclusivos", "Memoria ampliada", "Imágenes a menor precio"],
};

export default function AiPlansPage() {
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [account, setAccount] = useState<AiAccount | null>(null);
  const [buying, setBuying] = useState<Tier | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    apiFetch<Pricing>("/ai-companions/pricing").then(setPricing).catch(() => {});
  }, []);
  useEffect(() => {
    if (isAuthed) apiFetch<AiAccount>("/ai-companions/me").then(setAccount).catch(() => {});
  }, [isAuthed]);

  async function buy(tier: Tier) {
    if (!isAuthed) {
      window.location.href = `/login?next=${encodeURIComponent("/acompanantes-ia/planes")}`;
      return;
    }
    setBuying(tier);
    setMsg(null);
    try {
      await apiFetch("/ai-companions/plans/buy", { method: "POST", body: JSON.stringify({ tier }) });
      setAccount(await apiFetch<AiAccount>("/ai-companions/me"));
      setMsg({ ok: true, text: `Plan ${TIER_LABEL[tier]} activado.` });
    } catch (err: any) {
      const text =
        err?.body?.error === "CONSENT_REQUIRED"
          ? "Primero entra a un chat y confirma que eres mayor de edad."
          : apiErrorMessage(err);
      setMsg({ ok: false, text });
    } finally {
      setBuying(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4">
      <Link href="/acompanantes-ia" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Acompañantes IA
      </Link>
      <h1 className="text-2xl font-black text-white sm:text-3xl">Planes de Acompañantes IA</h1>
      <p className="mt-1 text-sm text-white/60">
        Se pagan con tokens de tu billetera. Las imágenes se cobran aparte por cada una.
      </p>

      {account && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
          <span>
            Plan actual: <b className="text-white">{TIER_LABEL[account.tier]}</b>
            {account.tierExpiresAt && ` hasta el ${new Date(account.tierExpiresAt).toLocaleDateString("es-CL")}`}
          </span>
          <span className="text-white/30">·</span>
          <span>
            Saldo: <b className="text-white">{account.walletBalance} tokens</b>{" "}
            <Link href="/wallet" className="text-fuchsia-300 underline">
              Recargar
            </Link>
          </span>
        </div>
      )}

      {msg && (
        <p className={`mt-4 rounded-xl px-4 py-2.5 text-sm ${msg.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
          {msg.text}{" "}
          {!msg.ok && /tokens/i.test(msg.text) && (
            <Link href="/wallet" className="font-semibold underline">
              Recargar tokens
            </Link>
          )}
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {(pricing?.plans || []).map((p) => {
          const current = account?.tier === p.tier;
          const highlight = p.tier === "VIP";
          return (
            <div
              key={p.tier}
              className={`flex flex-col rounded-3xl border p-5 ${
                highlight ? "border-amber-400/40 bg-gradient-to-b from-amber-400/10 to-[#0d0e1a]" : "border-white/10 bg-[#0d0e1a]"
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                {p.tier === "FREE" ? <Sparkles className="h-4 w-4 text-white/60" /> : <Crown className={`h-4 w-4 ${highlight ? "text-amber-300" : "text-fuchsia-300"}`} />}
                <h2 className="text-lg font-bold text-white">{TIER_LABEL[p.tier]}</h2>
              </div>
              <p className="mb-4 text-2xl font-black text-white">
                {p.tokens === 0 ? "Gratis" : `${p.tokens} tokens`}
                {p.tokens > 0 && <span className="text-sm font-medium text-white/50"> / {pricing?.days} días</span>}
              </p>
              <ul className="mb-5 flex-1 space-y-2 text-sm text-white/70">
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> {p.dailyMessages} mensajes al día</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> Hasta {p.memoryLimit} recuerdos por personaje</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> Imágenes a {p.imageTokens} {p.imageTokens === 1 ? "token" : "tokens"} c/u</li>
                {EXTRAS[p.tier].map((e) => (
                  <li key={e} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /> {e}</li>
                ))}
              </ul>
              {p.tier === "FREE" ? (
                <span className="rounded-xl bg-white/5 py-2.5 text-center text-sm text-white/50">{current ? "Tu plan actual" : "Incluido"}</span>
              ) : (
                <button
                  onClick={() => buy(p.tier)}
                  disabled={buying !== null}
                  className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold disabled:opacity-60 ${
                    highlight ? "bg-amber-400 text-black" : "bg-fuchsia-500 text-white"
                  }`}
                >
                  {buying === p.tier && <Loader2 className="h-4 w-4 animate-spin" />}
                  {current ? "Renovar" : `Activar ${TIER_LABEL[p.tier]}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-[11px] text-white/35">
        Al renovar el mismo plan se suman los días al vencimiento actual. Cambiar de plan comienza un nuevo periodo desde hoy.
        Los personajes exclusivos también pueden desbloquearse uno a uno.
      </p>
    </div>
  );
}
