"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "../../../../lib/api";

type CreatorStats = {
  termsAccepted: boolean;
  rulesAccepted: boolean;
  contractAccepted: boolean;
  bankConfigured: boolean;
};

export default function UmateLegalPage() {
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<CreatorStats>("/umate/creator/stats")
      .then((s) => setStats(s))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const checks = [
    {
      label: "Términos de servicio",
      ok: stats?.termsAccepted,
      href: "/umate/onboarding",
      desc: "Acepta los términos en el onboarding",
    },
    {
      label: "Reglas de la plataforma",
      ok: stats?.rulesAccepted,
      href: "/umate/onboarding",
      desc: "Acepta las reglas en el onboarding",
    },
    {
      label: "Contrato de creadora",
      ok: stats?.contractAccepted,
      href: "/umate/onboarding",
      desc: "Completa en el onboarding",
    },
    {
      label: "Datos bancarios",
      ok: stats?.bankConfigured,
      href: "/umate/onboarding",
      desc: "Configura en el onboarding",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
          Legal y cumplimiento
        </h1>
        <p className="mt-1 text-sm text-white/30">Requisitos para activar tu cuenta.</p>
      </div>

      <section className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/30">
          <ShieldCheck className="h-4 w-4" /> Checklist
        </h2>
        <div className="mt-4 space-y-2">
          {checks.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-xl border border-white/[0.04] p-3.5 transition hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-3">
                {item.ok ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white/70">{item.label}</p>
                  <p className="text-[11px] text-white/30">
                    {loading ? "…" : item.ok ? "Completado" : item.desc}
                  </p>
                </div>
              </div>
              {!loading && !item.ok && (
                <Link
                  href={item.href}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-[#00aff0]/[0.08] px-3 py-1.5 text-xs font-semibold text-[#00aff0] transition hover:bg-[#00aff0]/15"
                >
                  Completar <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white/30">
          Documentos
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { label: "Términos de servicio", href: "/umate/terms" },
            { label: "Reglas de la plataforma", href: "/umate/rules" },
            { label: "Contrato de prestación de servicios", href: "/umate/contrato" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.04] px-3 py-2 text-xs font-medium text-white/50 transition hover:border-white/[0.08] hover:text-white/70"
            >
              {link.label} <ExternalLink className="h-3 w-3" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
