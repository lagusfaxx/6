"use client";

import Link from "next/link";
import { FileText } from "lucide-react";

export default function TerminosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 border border-white/10">
          <FileText className="h-5 w-5 text-fuchsia-300" />
        </div>
        <h1 className="text-2xl font-bold text-white">Términos y Condiciones</h1>
      </div>

      <div className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8 text-sm text-white/60 leading-relaxed">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">1. Aceptación de los Términos</h2>
          <p>
            Al acceder y utilizar la plataforma UZEED, aceptas estos términos y condiciones en su totalidad.
            Si no estás de acuerdo con alguno de estos términos, no debes utilizar el servicio.
            El uso de UZEED está restringido exclusivamente a personas mayores de 18 años.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">2. Descripción del Servicio</h2>
          <p>
            UZEED es una plataforma de directorio y conexión entre usuarios y profesionales de servicios para adultos en Chile.
            UZEED actúa únicamente como intermediario tecnológico y no es parte de ningún acuerdo entre usuarios y profesionales.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">3. Registro y Cuenta</h2>
          <p>
            Para utilizar ciertas funciones, debes crear una cuenta con información veraz y actualizada.
            Eres responsable de mantener la confidencialidad de tus credenciales de acceso.
            UZEED se reserva el derecho de suspender o eliminar cuentas que violen estos términos.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">4. Conducta del Usuario</h2>
          <p>Te comprometes a no:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Publicar contenido ilegal, fraudulento o que infrinja derechos de terceros.</li>
            <li>Utilizar la plataforma para actividades ilegales.</li>
            <li>Suplantar la identidad de otra persona.</li>
            <li>Enviar spam o contenido no solicitado a otros usuarios.</li>
            <li>Intentar vulnerar la seguridad de la plataforma.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">5. Pagos y Suscripciones</h2>
          <p>
            Los profesionales pueden adquirir planes de suscripción para visibilidad en la plataforma.
            Los pagos se procesan a través de proveedores de pago seguros.
            Las condiciones de reembolso se evalúan caso a caso.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">6. Propiedad Intelectual</h2>
          <p>
            Todo el contenido de la plataforma (diseño, código, marca) es propiedad de UZEED.
            Los usuarios conservan la propiedad de su contenido publicado, pero otorgan a UZEED una licencia
            para mostrarlo en la plataforma.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">7. Limitación de Responsabilidad</h2>
          <p>
            UZEED no es responsable de las interacciones entre usuarios y profesionales fuera de la plataforma.
            No garantizamos la veracidad de los perfiles publicados, aunque tomamos medidas de verificación.
            El uso de la plataforma es bajo tu propia responsabilidad.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">8. Modificaciones</h2>
          <p>
            UZEED se reserva el derecho de modificar estos términos en cualquier momento.
            Los cambios serán notificados a través de la plataforma.
            El uso continuado del servicio implica la aceptación de los términos modificados.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">9. Documentos Completos</h2>
          <p>Puedes consultar los términos completos en formato PDF:</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <a
              href="/terms/terminos-cliente.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/10 px-4 py-2 text-xs font-medium text-fuchsia-300 transition hover:bg-fuchsia-500/20"
            >
              <FileText className="h-3.5 w-3.5" />
              Términos — Usuario Final
            </a>
            <a
              href="/terms/terminos-oferente.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-2 text-xs font-medium text-violet-300 transition hover:bg-violet-500/20"
            >
              <FileText className="h-3.5 w-3.5" />
              Términos — Usuario Oferente
            </a>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">10. Contacto</h2>
          <p>
            Para consultas sobre estos términos, visita nuestra{" "}
            <Link href="/contacto" className="text-fuchsia-400 underline hover:text-fuchsia-300">
              página de contacto
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
