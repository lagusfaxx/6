"use client";

import Link from "next/link";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import LegalDocViewer from "../_components/LegalDocViewer";
import { RULES_SECTIONS, RULES_VERSION } from "../../../lib/umate-legal";

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <Link
        href="/umate/account"
        className="inline-flex items-center gap-1.5 text-xs text-white/40 transition hover:text-white/60"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Volver
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00aff0]/10">
          <ShieldCheck className="h-5 w-5 text-[#00aff0]" />
        </div>
        <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
          Reglas de U-Mate
        </h1>
      </div>

      <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 sm:p-7">
        <LegalDocViewer sections={RULES_SECTIONS} version={RULES_VERSION} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/umate/terms"
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.06] px-3 py-2 text-xs font-medium text-white/50 transition hover:border-white/[0.12] hover:text-white/70"
        >
          Términos y condiciones
        </Link>
        <Link
          href="/umate/contrato"
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.06] px-3 py-2 text-xs font-medium text-white/50 transition hover:border-white/[0.12] hover:text-white/70"
        >
          Contrato de prestación de servicios
        </Link>
      </div>
    </div>
  );
}
