"use client";

import Link from "next/link";

export default function EmpezarClient() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10">
      {/* Back link */}
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-xs text-white/40 transition-colors hover:text-white/70"
      >
        &larr; Volver al inicio
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
          <div>
              <h2 className="text-base font-bold text-white">Registro normal</h2>
              <p className="mt-1 text-sm text-white/50">
                Perfil más completo y mejor presentación
              </p>
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
          <div>
              <h2 className="text-base font-bold text-white/80">Registro rápido</h2>
              <p className="mt-1 text-sm text-white/40">
                Publica en minutos y completa después
              </p>
          </div>
          <div className="mt-4 flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-semibold text-white/60 transition-colors group-hover:bg-white/[0.08] group-hover:text-white/80">
            Publicar rápido
          </div>
        </Link>
      </div>
    </div>
  );
}
