"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Settings,
  ShieldCheck,
  UserCircle2,
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

export default function UmateAccountPage() {
  const { me } = useMe();
  const [creator, setCreator] = useState<CreatorInfo>(null);
  const [creatorStats, setCreatorStats] = useState<CreatorStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ creator: CreatorInfo }>("/umate/creator/me").catch(() => null),
      apiFetch<CreatorStats>("/umate/creator/stats").catch(() => null),
    ]).then(([c, st]) => {
      setCreator(c?.creator || null);
      setCreatorStats(st);
      setLoading(false);
    });
  }, []);

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" />
      </div>
    );

  const checks = [
    { label: "Términos de servicio", ok: creatorStats?.termsAccepted, href: "/umate/terms" },
    { label: "Reglas de la plataforma", ok: creatorStats?.rulesAccepted, href: "/umate/rules" },
    { label: "Contrato de creadora", ok: creatorStats?.contractAccepted, href: "#" },
    { label: "Datos bancarios", ok: creatorStats?.bankConfigured, href: "#" },
  ];

  const pendingCount = checks.filter((c) => !c.ok).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-slate-600 to-slate-700 shadow-lg">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Cuenta y ajustes</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">Perfil público, datos legales y configuración del studio.</p>
      </div>

      {/* Pending alert */}
      {pendingCount > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
            <AlertCircle className="h-4 w-4" /> {pendingCount} elemento{pendingCount > 1 ? "s" : ""} pendiente{pendingCount > 1 ? "s" : ""}
          </div>
          <p className="mt-1 text-xs text-amber-700">Completa los requisitos para activar completamente tu cuenta de creadora.</p>
        </div>
      )}

      {/* Profile section */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <UserCircle2 className="h-4 w-4" /> Perfil
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Username</p>
            <p className="mt-1 text-sm font-bold text-slate-900">@{me?.user?.username || "—"}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Nombre público</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{me?.user?.displayName || "Sin definir"}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Email</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{me?.user?.email || "—"}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Estado creadora</p>
            <p className={`mt-1 text-sm font-bold ${creator?.status === "ACTIVE" ? "text-emerald-700" : "text-amber-700"}`}>
              {creator?.status || "No activa"}
            </p>
          </div>
        </div>
      </section>

      {/* Legal & compliance */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <ShieldCheck className="h-4 w-4" /> Legal y cumplimiento
        </h2>
        <div className="mt-4 space-y-2">
          {checks.map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-100 p-3.5 transition hover:bg-slate-50">
              <div className="flex items-center gap-3">
                {item.ok ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                  <p className="text-[11px] text-slate-500">{item.ok ? "Completado" : "Pendiente de aceptación"}</p>
                </div>
              </div>
              {!item.ok && (
                <Link href={item.href} className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-50 px-3 py-1.5 text-xs font-bold text-fuchsia-700 transition hover:bg-fuchsia-100">
                  Completar <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Recommended actions */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <Building2 className="h-4 w-4" /> Ajustes recomendados
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { label: "Actualizar bio y portada", desc: "Mejora tu perfil público con contenido visual atractivo." },
            { label: "Completar cuenta bancaria", desc: "Configura tus datos para poder solicitar retiros." },
            { label: "Definir frecuencia de posts", desc: "Establece una rutina de publicación consistente." },
            { label: "Revisar términos y políticas", desc: "Mantente al día con las reglas de la plataforma." },
          ].map((task) => (
            <div key={task.label} className="rounded-xl border border-slate-100 p-4 transition hover:border-fuchsia-100 hover:bg-fuchsia-50/20">
              <p className="text-sm font-semibold text-slate-700">{task.label}</p>
              <p className="mt-1 text-xs text-slate-500">{task.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Links */}
      <section className="flex flex-wrap gap-2">
        <Link href="/umate/terms" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-fuchsia-200 hover:text-fuchsia-700">
          Términos de servicio <ExternalLink className="h-3 w-3" />
        </Link>
        <Link href="/umate/rules" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-fuchsia-200 hover:text-fuchsia-700">
          Reglas de la plataforma <ExternalLink className="h-3 w-3" />
        </Link>
        <Link href="/" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-fuchsia-200 hover:text-fuchsia-700">
          Volver a UZEED <ExternalLink className="h-3 w-3" />
        </Link>
      </section>
    </div>
  );
}
