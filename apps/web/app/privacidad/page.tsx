"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch, friendlyErrorMessage } from "../../lib/api";

type RequestType = "account" | "data";

function DeletionForm({
  type,
  title,
  description,
}: {
  type: RequestType;
  title: string;
  description: string;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>(
        "/privacy/request-deletion",
        {
          method: "POST",
          body: JSON.stringify({ type, email: email.trim(), message: message.trim() }),
        },
      );
      setFeedback(res.message);
      setStatus("success");
      setEmail("");
      setMessage("");
    } catch (err: any) {
      setFeedback(friendlyErrorMessage(err));
      setStatus("error");
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm text-white/60">{description}</p>

      {status === "success" ? (
        <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {feedback}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-white/70">
              Correo electrónico de contacto *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-fuchsia-400/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/70">
              Mensaje o detalle adicional (opcional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe tu solicitud..."
              rows={3}
              maxLength={1000}
              className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-fuchsia-400/50"
            />
          </div>

          {status === "error" && (
            <p className="text-sm text-red-400">{feedback}</p>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded-xl bg-fuchsia-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-fuchsia-500 disabled:opacity-50"
          >
            {status === "loading" ? "Enviando..." : "Enviar solicitud"}
          </button>
        </form>
      )}
    </div>
  );
}

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
