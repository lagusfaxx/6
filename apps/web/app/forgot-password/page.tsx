import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="max-w-md mx-auto card p-8 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-400/60 via-sky-400/60 to-transparent" />
      <h1 className="text-2xl font-semibold">Recuperar contraseña</h1>
      <p className="mt-2 text-sm text-white/60">
        Para restablecer tu acceso, escríbenos a{" "}
        <a className="text-white underline" href="mailto:soporte@uzeed.cl">
          soporte@uzeed.cl
        </a>
        .
      </p>

      <div className="mt-6">
        <Link className="btn-secondary" href="/login">
          Volver a ingresar
        </Link>
      </div>
    </div>
  );
}
