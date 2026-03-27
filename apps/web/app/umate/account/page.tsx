"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  Settings,
  ShieldCheck,
  UserCircle2,
  XCircle,
} from "lucide-react";
import { apiFetch } from "../../../lib/api";
import useMe from "../../../hooks/useMe";

type CreatorInfo = { id: string; status: string } | null;
type CreatorStats = {
  termsAccepted: boolean;
  rulesAccepted: boolean;
  contractAccepted: boolean;
  bankConfigured: boolean;
};
type SubscriptionInfo = {
  active: boolean;
  plan?: { name: string; tier: string };
  slotsTotal?: number;
  slotsUsed?: number;
  slotsAvailable?: number;
  cycleEnd?: string;
  subscribedCreators?: { displayName: string; username: string }[];
};

export default function UmateAccountPage() {
  const { me } = useMe();
  const [creator, setCreator] = useState<CreatorInfo>(null);
  const [creatorStats, setCreatorStats] = useState<CreatorStats | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ creator: CreatorInfo }>("/umate/creator/me").catch(() => null),
      apiFetch<CreatorStats>("/umate/creator/stats").catch(() => null),
      apiFetch<SubscriptionInfo>("/umate/subscription/status").catch(() => null),
    ]).then(([c, st, sub]) => {
      setCreator(c?.creator || null);
      setCreatorStats(st);
      setSubscription(sub);
      setLoading(false);
    });
  }, []);

  const handleCancelSubscription = async () => {
    if (!confirm("¿Estás seguro de cancelar tu plan? Mantendrás acceso hasta el fin del ciclo.")) return;
    setCancelling(true);
    const res = await apiFetch<{ cancelled: boolean }>("/umate/subscription/cancel", { method: "POST" }).catch(() => null);
    if (res?.cancelled) {
      setSubscription((prev) => prev ? { ...prev, active: false } : prev);
    }
    setCancelling(false);
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-white/20" /></div>;

  const checks = [
    { label: "Términos de servicio", ok: creatorStats?.termsAccepted, href: "/umate/terms" },
    { label: "Reglas de la plataforma", ok: creatorStats?.rulesAccepted, href: "/umate/rules" },
    { label: "Contrato de creadora", ok: creatorStats?.contractAccepted, href: "#" },
    { label: "Datos bancarios", ok: creatorStats?.bankConfigured, href: "#" },
  ];
  const pendingCount = checks.filter((c) => !c.ok).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Cuenta y ajustes</h1>
        <p className="mt-1 text-sm text-white/30">Perfil, datos legales y configuración.</p>
      </div>

      {pendingCount > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
            <AlertCircle className="h-4 w-4" /> {pendingCount} pendiente{pendingCount > 1 ? "s" : ""}
          </div>
          <p className="mt-1 text-xs text-white/30">Completa los requisitos para activar tu cuenta.</p>
        </div>
      )}

      {/* Profile */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/25">
          <UserCircle2 className="h-4 w-4" /> Perfil
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { label: "Username", value: `@${me?.user?.username || "—"}` },
            { label: "Nombre público", value: me?.user?.displayName || "Sin definir" },
            { label: "Email", value: me?.user?.email || "—" },
            { label: "Estado creadora", value: creator?.status || "No activa", isStatus: true },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-white/[0.03] p-3">
              <p className="text-[11px] text-white/25">{item.label}</p>
              <p className={`mt-1 text-sm font-semibold ${
                "isStatus" in item && item.isStatus
                  ? creator?.status === "ACTIVE" ? "text-emerald-400" : "text-amber-400"
                  : "text-white/80"
              }`}>{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Subscription */}
      {subscription && (
        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/25">
            <CreditCard className="h-4 w-4" /> Tu suscripción
          </h2>
          {subscription.active ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">{subscription.plan?.name || "Plan activo"}</p>
                  <p className="text-xs text-white/30">
                    {subscription.slotsUsed}/{subscription.slotsTotal} cupos usados · Vence {subscription.cycleEnd ? new Date(subscription.cycleEnd).toLocaleDateString("es-CL") : "—"}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-400">Activo</span>
              </div>
              {subscription.subscribedCreators && subscription.subscribedCreators.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {subscription.subscribedCreators.map((c) => (
                    <span key={c.username} className="rounded-full bg-white/[0.04] px-2.5 py-0.5 text-[10px] text-white/40">
                      @{c.username}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400/60 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
              >
                {cancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                Cancelar suscripción
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-white/30">No tienes un plan activo.</p>
              <Link href="/umate/plans" className="mt-2 inline-block rounded-full bg-[#00aff0] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#00aff0]/90">
                Ver planes
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Legal */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/25">
          <ShieldCheck className="h-4 w-4" /> Legal y cumplimiento
        </h2>
        <div className="mt-4 space-y-2">
          {checks.map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-lg border border-white/[0.04] p-3 transition hover:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                {item.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
                <div>
                  <p className="text-sm font-medium text-white/60">{item.label}</p>
                  <p className="text-[10px] text-white/20">{item.ok ? "Completado" : "Pendiente"}</p>
                </div>
              </div>
              {!item.ok && (
                <Link href={item.href} className="rounded-lg bg-[#00aff0]/10 px-3 py-1.5 text-xs font-semibold text-[#00aff0] transition hover:bg-[#00aff0]/20">
                  Completar
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Links */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Términos", href: "/umate/terms" },
          { label: "Reglas", href: "/umate/rules" },
          { label: "Volver a UZEED", href: "/" },
        ].map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] px-3 py-2 text-xs font-medium text-white/30 transition hover:border-white/[0.12] hover:text-white/50"
          >
            {link.label} <ExternalLink className="h-3 w-3" />
          </Link>
        ))}
      </div>
    </div>
  );
}
