"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, LogOut } from "lucide-react";
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

type Access = { blocked: boolean; priceClp?: number; expiredAt?: string | null };

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

  return { blocked: Boolean(applies && access?.blocked), access };
}

async function logout() {
  await apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/";
}

function reasonText(access: Access | null) {
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
            {reasonText(access)}. Activa tu plan para volver a aparecer.
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
