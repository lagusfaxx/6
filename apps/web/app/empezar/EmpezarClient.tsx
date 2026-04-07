"use client";

import Link from "next/link";
import { ArrowLeft, UserPlus, Zap } from "lucide-react";

export default function EmpezarClient() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10">
      {/* Back link */}
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-xs text-white/40 transition-colors hover:text-white/70"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver al inicio
      </Link>

      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Elige cómo quieres empezar
        </h1>
        <p className="mt-2 text-sm text-white/50">
          Puedes crear un perfil completo o publicar rápido y completar después.
        </p>
      </div>

      {/* Options */}
      <div className="flex flex-col gap-4">
        {/* Card 1 — Registro normal (recommended) */}
        <Link
          href="/register"
          className="group relative overflow-hidden rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/[0.08] to-violet-500/[0.06] p-5 transition-all duration-300 hover:border-fuchsia-500/50 hover:shadow-[0_0_24px_rgba(217,70,239,0.12)]"
        >
          <span className="absolute right-4 top-4 rounded-full bg-fuchsia-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-fuchsia-300">
            Recomendado
          </span>
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/10">
              <UserPlus className="h-5 w-5 text-fuchsia-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-white">Registro normal</h2>
              <p className="mt-1 text-sm text-white/50">
                Perfil más completo y mejor presentación
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center rounded-xl bg-fuchsia-500/15 py-2.5 text-sm font-semibold text-fuchsia-300 transition-colors group-hover:bg-fuchsia-500/25">
            Crear perfil completo
          </div>
        </Link>

        {/* Card 2 — Registro rápido (secondary) */}
        <Link
          href="/publicate"
          className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.06]"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
              <Zap className="h-5 w-5 text-white/60" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-white/80">Registro rápido</h2>
              <p className="mt-1 text-sm text-white/40">
                Publica en minutos y completa después
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-semibold text-white/60 transition-colors group-hover:bg-white/[0.08] group-hover:text-white/80">
            Publicar rápido
          </div>
        </Link>
      </div>
    </div>
  );
}
