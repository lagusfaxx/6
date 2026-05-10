import type { Metadata } from "next";
import Link from "next/link";
import DeletionForm from "./DeletionForm";

export const metadata: Metadata = {
  title: "Política de Privacidad | UZEED",
  description:
    "Política de privacidad de UZEED Chile: cómo recopilamos, usamos y protegemos tus datos personales. Solicita eliminación de cuenta o datos.",
  alternates: { canonical: "/privacidad" },
  openGraph: {
    title: "Política de Privacidad | UZEED",
    description:
      "Política de privacidad y solicitudes de eliminación de datos en UZEED Chile.",
    url: "/privacidad",
    type: "article",
    images: [
      {
        url: "/brand/isotipo-new.png",
        width: 720,
        height: 720,
        alt: "UZEED - Política de Privacidad",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Política de Privacidad | UZEED",
    description: "Cómo protegemos tus datos en UZEED Chile.",
    images: ["/brand/isotipo-new.png"],
  },
  robots: { index: true, follow: true },
};

export default function PrivacidadPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-white">
      <h1 className="text-3xl font-bold">Política de Privacidad</h1>
      <p className="mt-2 text-sm text-white/60">
        Última actualización: marzo 2026
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-white/80">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">1. Información que recopilamos</h2>
          <p>
            Al registrarte en UZEED recopilamos tu correo electrónico, nombre de usuario y,
            opcionalmente, datos de perfil como ubicación aproximada, fotos de perfil y
            preferencias de servicio. No almacenamos tu dirección exacta.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">2. Uso de la información</h2>
          <p>
            Usamos tu información para operar la plataforma, verificar perfiles,
            facilitar la comunicación entre usuarios y mejorar nuestros servicios.
            No vendemos tus datos personales a terceros.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">3. Protección de datos</h2>
          <p>
            Implementamos medidas de seguridad técnicas y organizativas para proteger
            tu información. Las sesiones están cifradas y los datos sensibles se
            almacenan de forma segura.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">4. Cookies y sesiones</h2>
          <p>
            Utilizamos cookies de sesión para mantener tu autenticación. Estas cookies
            son estrictamente necesarias para el funcionamiento de la plataforma y no
            se utilizan para rastreo publicitario.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">5. Tus derechos</h2>
          <p>
            Tienes derecho a acceder, rectificar y eliminar tus datos personales.
            Puedes solicitar la eliminación de tu cuenta o de tus datos utilizando
            los formularios a continuación. Procesaremos tu solicitud y nos pondremos
            en contacto contigo para confirmar.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-white">6. Contacto</h2>
          <p>
            Para consultas sobre privacidad puedes escribirnos a través de la página
            de{" "}
            <Link href="/contacto" className="text-fuchsia-400 underline hover:text-fuchsia-300">
              contacto
            </Link>{" "}
            o utilizar los formularios de este apartado.
          </p>
        </section>
      </div>

      {/* ─── Formularios de solicitud ─── */}
      <div className="mt-12 space-y-6">
        <h2 className="text-xl font-bold text-white">Solicitudes de eliminación</h2>
        <p className="text-sm text-white/60">
          Completa el formulario correspondiente y nuestro equipo revisará tu solicitud.
          Te contactaremos al correo proporcionado para proceder.
        </p>

        <DeletionForm
          type="account"
          title="Solicitar eliminación de cuenta"
          description="Solicita que eliminemos tu cuenta y todos los datos asociados de forma permanente."
        />

        <DeletionForm
          type="data"
          title="Solicitar eliminación de datos"
          description="Solicita que eliminemos tus datos personales manteniendo tu cuenta activa."
        />
      </div>

      <div className="mt-10 border-t border-white/10 pt-6 text-center">
        <Link
          href="/"
          className="text-sm text-white/50 transition hover:text-white/70"
        >
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}
