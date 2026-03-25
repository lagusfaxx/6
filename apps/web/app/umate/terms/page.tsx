"use client";

import Link from "next/link";
import { ChevronLeft, FileText } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl py-8 space-y-6">
      <Link href="/umate/account" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70">
        <ChevronLeft className="h-3.5 w-3.5" /> Volver
      </Link>

      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-rose-400" />
        <h1 className="text-xl font-bold">Términos y condiciones de U-Mate</h1>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 space-y-4 text-sm text-white/60 leading-relaxed">
        <section>
          <h2 className="text-white font-semibold mb-2">1. Definiciones</h2>
          <p>U-Mate es un servicio de suscripción de contenido dentro de la plataforma UZEED. "Creadora" refiere a la persona que publica contenido. "Suscriptor" refiere al usuario que paga un plan para acceder a contenido.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold mb-2">2. Planes y pagos</h2>
          <p>Los planes son de renovación mensual automática. Los precios están en pesos chilenos (CLP) e incluyen IVA. El pago se procesa a través de Flow.cl.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold mb-2">3. Cupos de suscripción</h2>
          <p>Cada plan otorga un número fijo de cupos para suscribirse a creadoras. Los cupos se reinician al inicio de cada ciclo de pago. Los cupos utilizados no son transferibles ni reembolsables dentro del mismo ciclo.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold mb-2">4. Pagos a creadoras</h2>
          <p>Las creadoras reciben un payout por cada suscripción activa recibida. El monto base es configurable por la plataforma. Los pagos se acumulan y pueden ser retirados según los términos de liquidación vigentes.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold mb-2">5. Cancelación</h2>
          <p>Los suscriptores pueden cancelar su plan en cualquier momento. El acceso se mantiene hasta el fin del ciclo pagado. No hay reembolsos por ciclos parciales.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold mb-2">6. Responsabilidad</h2>
          <p>U-Mate actúa como intermediario. No se responsabiliza por el contenido publicado por las creadoras, pero se compromete a moderar activamente la plataforma.</p>
        </section>
        <section>
          <h2 className="text-white font-semibold mb-2">7. Privacidad</h2>
          <p>Los datos personales se manejan según la Política de Privacidad de UZEED. La información bancaria de las creadoras se almacena de forma segura y solo se usa para procesar pagos.</p>
        </section>
      </div>
    </div>
  );
}
