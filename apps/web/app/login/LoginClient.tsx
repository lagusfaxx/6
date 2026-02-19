"use client";

import AuthForm from "../../components/AuthForm";
import Link from "next/link";

export default function LoginClient() {
  return (
    <div className="max-w-md mx-auto card p-8 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-400/60 via-sky-400/60 to-transparent" />
      <h1 className="text-2xl font-semibold">Ingresar</h1>
      <p className="mt-2 text-sm text-white/60">Accede a tu cuenta para continuar.</p>

      <div className="mt-6">
        <AuthForm mode="login" />
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-white/60">
        <Link href="/forgot-password" className="text-white underline">
          ¿Olvidaste tu contraseña?
        </Link>
        <Link href="/register" className="text-white/80 underline">
          Crear cuenta
        </Link>
      </div>

      <div className="mt-6 text-xs text-white/50">
        Si tienes problemas para ingresar, contáctanos en{" "}
        <a className="text-white underline" href="mailto:soporte@uzeed.cl">
          soporte@uzeed.cl
        </a>
        .
      </div>
    </div>
  );
}
