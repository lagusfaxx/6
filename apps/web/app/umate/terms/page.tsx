"use client";

import Link from "next/link";
import { ChevronLeft, FileText } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl py-8 space-y-6">
      <Link href="/umate/account" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition">
        <ChevronLeft className="h-3.5 w-3.5" /> Volver
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00aff0]/10">
          <FileText className="h-5 w-5 text-[#00aff0]" />
        </div>
        <h1 className="text-xl font-extrabold tracking-tight">Terminos y condiciones de U-Mate</h1>
      </div>

      <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-7 space-y-6 text-sm text-white/45 leading-relaxed">
        {[
          { title: "1. Definiciones", text: "U-Mate es un servicio de suscripción de contenido dentro de la plataforma UZEED. \"Creadora\" refiere a la persona que publica contenido. \"Suscriptor\" refiere al usuario que paga un plan para acceder a contenido." },
          { title: "2. Planes y pagos", text: "Los planes son de renovación mensual automática. Los precios están en pesos chilenos (CLP) e incluyen IVA. El pago se procesa a través de Flow.cl." },
          { title: "3. Cupos de suscripción", text: "Cada plan otorga un número fijo de cupos para suscribirse a creadoras. Los cupos se reinician al inicio de cada ciclo de pago. Los cupos utilizados no son transferibles ni reembolsables dentro del mismo ciclo." },
          { title: "4. Pagos a creadoras", text: "Las creadoras reciben un payout por cada suscripción activa recibida. El monto base es configurable por la plataforma. Los pagos se acumulan y pueden ser retirados según los términos de liquidación vigentes." },
          { title: "5. Cancelación", text: "Los suscriptores pueden cancelar su plan en cualquier momento. El acceso se mantiene hasta el fin del ciclo pagado. No hay reembolsos por ciclos parciales." },
          { title: "6. Responsabilidad", text: "U-Mate actúa como intermediario. No se responsabiliza por el contenido publicado por las creadoras, pero se compromete a moderar activamente la plataforma." },
          { title: "7. Privacidad", text: "Los datos personales se manejan según la Política de Privacidad de UZEED. La información bancaria de las creadoras se almacena de forma segura y solo se usa para procesar pagos." },
        ].map((section) => (
          <section key={section.title}>
            <h2 className="text-white font-bold mb-2">{section.title}</h2>
            <p>{section.text}</p>
          </section>
        ))}
      </div>

      <div className="rounded-2xl border border-[#00aff0]/15 bg-[#00aff0]/[0.04] p-5 text-center space-y-3">
        <p className="text-sm text-white/50">¿Necesitas aceptar los términos para activar tu cuenta de creadora?</p>
        <Link
          href="/umate/onboarding"
          className="inline-flex items-center gap-2 rounded-full bg-[#00aff0] px-6 py-2.5 text-sm font-bold text-white shadow-[0_2px_16px_rgba(0,175,240,0.2)] transition hover:bg-[#00aff0]/90"
        >
          Ir al onboarding <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
        </Link>
      </div>
    </div>
  );
}
