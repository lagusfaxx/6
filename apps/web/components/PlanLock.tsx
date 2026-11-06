"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, Loader2, Lock, LogOut, X } from "lucide-react";
import { apiFetch } from "../lib/api";
import useMe from "../hooks/useMe";

/**
 * Bloqueo por falta de pago: si el perfil de una profesional, establecimiento
 * o tienda dejó de mostrarse porque no tiene plan vigente, la app entera queda
 * bloqueada y lo único que puede hacer es pagar. Antes seguían navegando como
 * si nada y no se enteraban de que su perfil estaba oculto.
 */

const PAID_PROFILE_TYPES = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"];

/** Rutas que se pueden abrir con la cuenta bloqueada. */
const ALLOWED_PREFIXES = ["/pago", "/ayuda", "/contacto", "/terminos", "/privacidad"];

export function isPlanLockAllowedPath(pathname: string) {
  return ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

type Access = {
  blocked: boolean;
  priceClp?: number;
  expiredAt?: string | null;
  /** Perfil nuevo que todavía no elige cómo empezar su prueba. */
  needsTrialChoice?: boolean;
  trialDays?: number;
  cardTrialDays?: number;
};

export function usePlanLock(pathname: string) {
  const { me } = useMe();
  const [access, setAccess] = useState<Access | null>(null);
  const profileType = me?.user?.profileType ?? null;
  const applies = Boolean(profileType && PAID_PROFILE_TYPES.includes(profileType));

  // Se vuelve a consultar en cada cambio de página: así, apenas paga, se
  // desbloquea sin tener que recargar. Si la consulta falla, no se bloquea.
  useEffect(() => {
    if (!applies) {
      setAccess(null);
      return;
    }
    let alive = true;
    apiFetch<Access>("/billing/access")
      .then((r) => alive && setAccess(r))
      .catch(() => alive && setAccess(null));
    return () => {
      alive = false;
    };
  }, [applies, pathname]);

  const refresh = () =>
    apiFetch<Access>("/billing/access")
      .then(setAccess)
      .catch(() => undefined);

  return { blocked: Boolean(applies && access?.blocked), access, refresh };
}

async function logout() {
  await apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/";
}

function reasonText(access: Access | null) {
  if (access?.needsTrialChoice) return "Tu perfil está apagado hasta que elijas cómo empezar tu prueba gratis";
  if (access?.expiredAt) {
    const when = new Date(access.expiredAt).toLocaleDateString("es-CL", { day: "numeric", month: "long" });
    return `Tu plan venció el ${when}`;
  }
  return "Se terminó tu prueba gratis";
}

/** Pantalla que reemplaza a toda la app mientras la cuenta está bloqueada. */
export function PlanLockScreen({ access }: { access: Access | null }) {
  const price = access?.priceClp;
  return (
    <div className="flex min-h-[100svh] w-full items-center justify-center px-4 py-10 text-white">
      <div className="w-full max-w-sm rounded-3xl border border-fuchsia-500/20 bg-gradient-to-br from-violet-600/10 via-fuchsia-500/5 to-transparent p-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-fuchsia-500/25 bg-fuchsia-500/10">
          <Lock className="h-6 w-6 text-fuchsia-300" />
        </div>
        <h1 className="text-xl font-bold">Tu cuenta está pausada</h1>
        <p className="mt-2 text-sm text-white/60">
          {reasonText(access)} y tu perfil ya no aparece en UZEED. Los clientes no te pueden ver ni escribir hasta que
          actives tu plan.
        </p>
        <Link
          href="/pago"
          className="mt-5 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:shadow-[0_0_24px_rgba(168,85,247,0.35)]"
        >
          Activar mi plan{price ? ` · $${price.toLocaleString("es-CL")}/mes` : ""}
        </Link>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-white/40">
          <Link href="/contacto" className="hover:text-white/70">
            ¿Dudas? Escríbenos
          </Link>
          <button type="button" onClick={logout} className="inline-flex items-center gap-1 hover:text-white/70">
            <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

/** Layout para las pocas páginas abiertas (pagar, ayuda): sin menú ni accesos al resto de la app. */
export function PlanLockLayout({ access, children }: { access: Access | null; children: React.ReactNode }) {
  return (
    <div className="min-h-[100svh] w-full text-white">
      <div className="sticky top-0 z-40 border-b border-fuchsia-500/20 bg-[#0b0712]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <p className="text-xs text-white/70">
            <Lock className="mr-1 inline h-3.5 w-3.5 text-fuchsia-300" />
            {reasonText(access)}{access?.needsTrialChoice ? "." : ". Activa tu plan para volver a aparecer."}
          </p>
          <button
            type="button"
            onClick={logout}
            className="inline-flex shrink-0 items-center gap-1 text-xs text-white/40 hover:text-white/70"
          >
            <LogOut className="h-3.5 w-3.5" /> Salir
          </button>
        </div>
      </div>
      <main className="px-4 pb-10 pt-4">{children}</main>
    </div>
  );
}

/**
 * Perfil recién creado que no elige cómo empezar su prueba: puede usar la app,
 * pero su perfil no se muestra y este aviso aparece en cada pantalla que
 * visita (se cierra con "Ahora no"). La opción con tarjeta (más días) va
 * destacada; sin tarjeta queda como alternativa.
 */
export function TrialChoiceModal({
  access,
  onChosen,
  onClose,
}: {
  access: Access | null;
  onChosen: () => void;
  onClose: () => void;
}) {
  const card = access?.cardTrialDays ?? 30;
  const free = access?.trialDays ?? 14;
  const price = access?.priceClp ? `$${access.priceClp.toLocaleString("es-CL")}` : null;
  const hasBonus = card > free;
  const [busy, setBusy] = useState<"card" | "free" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const withCard = async () => {
    setError(null);
    setBusy("card");
    try {
      const r = await apiFetch<{ url: string }>("/billing/subscription/register-card", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (r?.url) {
        window.location.href = r.url;
        return;
      }
      setError("No se pudo abrir el registro de tarjeta. Intenta de nuevo.");
    } catch (err: any) {
      setError(err?.body?.message || "No se pudo abrir el registro de tarjeta. Intenta de nuevo.");
    }
    setBusy(null);
  };

  const withoutCard = async () => {
    setError(null);
    setBusy("free");
    try {
      await apiFetch("/billing/trial/start-free", { method: "POST", body: JSON.stringify({}) });
      onChosen();
    } catch (err: any) {
      setError(err?.body?.message || "No se pudo activar tu prueba. Intenta de nuevo.");
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-black/75 px-4 py-6 text-white backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-choice-title"
    >
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#120a1c] p-5 pt-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white/80"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="mb-6 pr-6 text-center">
          <h2 id="trial-choice-title" className="text-xl font-bold">Tu perfil todavía no aparece</h2>
          <p className="mt-2 text-sm text-white/60">
            Elige cómo empezar tu prueba gratis para que los clientes te puedan ver.
          </p>
        </div>

        <div className="relative rounded-3xl border-2 border-fuchsia-500/60 bg-gradient-to-br from-violet-600/20 via-fuchsia-500/10 to-transparent p-5 shadow-[0_0_32px_rgba(217,70,239,0.18)]">
          {hasBonus && (
            <span className="absolute -top-3 left-5 rounded-full bg-fuchsia-500 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              Recomendado
            </span>
          )}
          <p className="text-3xl font-bold">{card} días gratis</p>
          <p className="mt-1 text-sm font-medium text-fuchsia-200">Registrando tu tarjeta</p>
          <ul className="mt-3 space-y-1.5 text-sm text-white/70">
            <li>Hoy no se cobra nada.</li>
            <li>
              El primer cobro{price ? ` de ${price}` : ""} es el día {card} y después se renueva solo cada mes.
            </li>
            <li>Puedes cancelar cuando quieras desde tu cuenta.</li>
          </ul>
          <button
            type="button"
            onClick={withCard}
            disabled={busy !== null}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-4 text-base font-semibold text-white transition hover:shadow-[0_0_24px_rgba(168,85,247,0.4)] disabled:opacity-60"
          >
            {busy === "card" ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
            Registrar tarjeta y tener {card} días
          </button>
        </div>

        {error && <p className="mt-3 text-center text-sm text-red-300">{error}</p>}

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={withoutCard}
            disabled={busy !== null}
            className="text-sm text-white/50 underline underline-offset-4 transition hover:text-white/80 disabled:opacity-60"
          >
            {busy === "free" ? "Activando…" : `Prefiero no dejar tarjeta: ${free} días gratis`}
          </button>
          {hasBonus && (
            <p className="mt-1 text-xs text-white/35">Al terminar los {free} días tendrás que pagar a mano para seguir apareciendo.</p>
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <button type="button" onClick={onClose} className="text-xs text-white/35 transition hover:text-white/70">
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}

/** El aviso de elegir la prueba, que se vuelve a abrir en cada pantalla nueva. */
export function TrialChoiceNudge({
  access,
  pathname,
  onChosen,
}: {
  access: Access | null;
  pathname: string;
  onChosen: () => void;
}) {
  const [closedOn, setClosedOn] = useState<string | null>(null);
  if (!access?.needsTrialChoice || closedOn === pathname) return null;
  return <TrialChoiceModal access={access} onChosen={onChosen} onClose={() => setClosedOn(pathname)} />;
}
