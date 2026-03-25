"use client";

import Link from "next/link";
import { ChevronLeft, ShieldCheck } from "lucide-react";

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-2xl py-8 space-y-6">
      <Link href="/umate/account" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70">
        <ChevronLeft className="h-3.5 w-3.5" /> Volver
      </Link>

      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-rose-400" />
        <h1 className="text-xl font-bold">Reglas de U-Mate</h1>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 space-y-4 text-sm text-white/60 leading-relaxed">
        <section>
          <h2 className="text-white font-semibold mb-2">1. Contenido permitido</h2>
          <p>Las creadoras pueden publicar fotos, videos y textos originales. Todo el contenido debe ser propio o contar con autorización expresa.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold mb-2">2. Contenido prohibido</h2>
          <p>Está prohibido el contenido que involucre menores de edad, violencia extrema, explotación, o cualquier material que viole la legislación chilena.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold mb-2">3. Verificación de identidad</h2>
          <p>Las creadoras deben ser mayores de 18 años y pueden ser requeridas a verificar su identidad antes de activar su cuenta.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold mb-2">4. Comportamiento</h2>
          <p>Se espera un trato respetuoso entre creadoras y suscriptores. El acoso, spam o comportamiento abusivo resultará en suspensión de la cuenta.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold mb-2">5. Propiedad intelectual</h2>
          <p>Las creadoras mantienen la propiedad de su contenido. U-Mate obtiene licencia para mostrar y distribuir el contenido dentro de la plataforma.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold mb-2">6. Suspensión</h2>
          <p>U-Mate se reserva el derecho de suspender o eliminar cuentas que infrinjan estas reglas, sin previo aviso en casos graves.</p>
        </section>
      </div>
    </div>
  );
}
