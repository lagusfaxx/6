"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useMe from "../../hooks/useMe";
import { apiFetch } from "../../lib/api";

function fmtDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function DashboardPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const membershipActive = useMemo(() => {
    if (!user?.membershipExpiresAt) return false;
    const d = new Date(user.membershipExpiresAt);
    return !Number.isNaN(d.getTime()) && d.getTime() > Date.now();
  }, [user?.membershipExpiresAt]);

  const isProfessional = user?.profileType === "PROFESSIONAL";
  const isShop = user?.profileType === "SHOP";
  const isViewer = user?.profileType === "VIEWER";
  const isAdmin = (user?.role ?? "").toUpperCase() === "ADMIN";
  const isMotel = (user?.profileType ?? "").toUpperCase() === "ESTABLISHMENT" || ["MOTEL", "MOTEL_OWNER"].includes((user?.role ?? "").toUpperCase());

  useEffect(() => {
    if (isMotel) window.location.href = "/dashboard/motel";
  }, [isMotel]);

  const startPlan = async (kind: "professional" | "shop") => {
    setError(null);
    setBusy(kind);
    try {
      const path = kind === "professional" ? "/billing/professional-plan/start" : "/billing/shop-plan/start";
      const r = await apiFetch<{ paymentUrl: string }>(path, { method: "POST", body: JSON.stringify({}) });
      if (!r?.paymentUrl) throw new Error("NO_PAYMENT_URL");
      window.location.href = r.paymentUrl;
    } catch (e: any) {
      setError("No se pudo iniciar el pago. Revisa tu sesión y configuración de Khipu.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="p-6 text-white/80">Cargando...</div>;

  if (!user) {
    return (
      <div className="p-6 text-white">
        <h1 className="text-2xl font-semibold mb-2">Dashboard</h1>
        <p className="text-white/80 mb-4">Debes iniciar sesión para ver tu dashboard.</p>
        <Link className="underline" href="/login">Ir a iniciar sesión</Link>
      </div>
    );
  }

  return (
    <div className="p-6 text-white max-w-3xl">
      <h1 className="text-2xl font-semibold mb-2">Dashboard</h1>
      <p className="text-white/80 mb-6">
        Estado de tu cuenta y publicidad mensual (Khipu).
      </p>

      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-4">
        <div className="text-sm text-white/70">Usuario</div>
        <div className="text-lg font-medium">{user.username}</div>
        <div className="text-sm text-white/70 mt-2">Tipo de perfil</div>
        <div className="text-base">{user.profileType ?? "—"}</div>

        <div className="text-sm text-white/70 mt-4">Publicidad / membresía</div>
        <div className="text-base">
          {membershipActive ? "Activa" : "Inactiva"}{" "}
          {user.membershipExpiresAt ? (
            <span className="text-white/60">· vence: {fmtDate(user.membershipExpiresAt)}</span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 mb-4 text-red-200">
          {error}
        </div>
      ) : null}

      {isViewer ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <div className="font-medium mb-1">Perfil consumidor</div>
          <div className="text-white/80 text-sm">
            Puedes explorar categorías, chatear y solicitar servicios. Este perfil no paga.
          </div>
        </div>
      ) : null}

      {(isProfessional || isShop) ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <div className="font-medium mb-1">Activar publicidad mensual</div>
          <div className="text-white/80 text-sm mb-4">
            Para aparecer como perfil <span className="font-medium">activo</span> en el directorio, debes mantener tu plan mensual al día.
          </div>

          {isProfessional ? (
            <button
              onClick={() => startPlan("professional")}
              disabled={busy !== null}
              className="px-4 py-2 rounded-xl bg-white text-black font-medium disabled:opacity-60"
            >
              {busy === "professional" ? "Redirigiendo a Khipu..." : "Pagar plan Experiencia"}
            </button>
          ) : null}

          {isShop ? (
            <button
              onClick={() => startPlan("shop")}
              disabled={busy !== null}
              className="px-4 py-2 rounded-xl bg-white text-black font-medium disabled:opacity-60"
            >
              {busy === "shop" ? "Redirigiendo a Khipu..." : "Pagar plan Tienda"}
            </button>
          ) : null}

          <div className="text-xs text-white/60 mt-3">
            Al pagar, volverás a este dashboard. La activación se confirma automáticamente vía webhook de Khipu.
          </div>
        </div>
      ) : null}

      {isAdmin ? (
        <div className="mt-6">
          <Link className="underline" href="/admin/pricing">Panel Admin: Precios</Link>
        </div>
      ) : null}
    </div>
  );
}
