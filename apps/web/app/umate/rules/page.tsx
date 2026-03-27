"use client";

import Link from "next/link";
import { ChevronLeft, ShieldCheck } from "lucide-react";

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-2xl py-8 space-y-6">
      <Link href="/umate/account" className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition">
        <ChevronLeft className="h-3.5 w-3.5" /> Volver
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00aff0]/10">
          <ShieldCheck className="h-5 w-5 text-[#00aff0]" />
        </div>
        <h1 className="text-xl font-extrabold tracking-tight">Reglas de U-Mate</h1>
      </div>

      <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-7 space-y-6 text-sm text-white/45 leading-relaxed">
        {[
          { title: "1. Contenido permitido", text: "Las creadoras pueden publicar fotos, videos y textos originales. Todo el contenido debe ser propio o contar con autorización expresa." },
          { title: "2. Contenido prohibido", text: "Está prohibido el contenido que involucre menores de edad, violencia extrema, explotación, o cualquier material que viole la legislación chilena." },
          { title: "3. Verificación de identidad", text: "Las creadoras deben ser mayores de 18 años y pueden ser requeridas a verificar su identidad antes de activar su cuenta." },
          { title: "4. Comportamiento", text: "Se espera un trato respetuoso entre creadoras y suscriptores. El acoso, spam o comportamiento abusivo resultará en suspensión de la cuenta." },
          { title: "5. Propiedad intelectual", text: "Las creadoras mantienen la propiedad de su contenido. U-Mate obtiene licencia para mostrar y distribuir el contenido dentro de la plataforma." },
          { title: "6. Suspensión", text: "U-Mate se reserva el derecho de suspender o eliminar cuentas que infrinjan estas reglas, sin previo aviso en casos graves." },
        ].map((section) => (
          <section key={section.title}>
            <h2 className="text-white font-bold mb-2">{section.title}</h2>
            <p>{section.text}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
