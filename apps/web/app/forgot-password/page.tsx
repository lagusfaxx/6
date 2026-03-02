import Link from "next/link";
import { KeyRound, Mail, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 blur-2xl scale-150" />
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center">
              <KeyRound className="h-10 w-10 text-fuchsia-300" />
            </div>
          </div>
          <h1 className="mt-5 text-3xl font-bold bg-gradient-to-r from-white via-fuchsia-200 to-violet-200 bg-clip-text text-transparent">
            Recuperar contraseña
          </h1>
          <p className="mt-2 text-sm text-white/50 text-center">
            Te ayudaremos a recuperar el acceso a tu cuenta
          </p>
        </div>

        {/* Card */}
        <div className="relative rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />

          <div className="p-8">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center">
                <Mail className="h-6 w-6 text-fuchsia-300" />
              </div>
              <p className="text-sm text-white/60 leading-relaxed">
                Para restablecer tu acceso, escríbenos a:
              </p>
              <a
                href="mailto:soporte@uzeed.cl"
                className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600/20 to-violet-600/20 border border-fuchsia-400/30 text-fuchsia-200 font-medium text-sm hover:border-fuchsia-400/50 hover:brightness-110 transition"
              >
                <Mail className="h-4 w-4" />
                soporte@uzeed.cl
              </a>
              <p className="mt-4 text-xs text-white/40">
                Nuestro equipo te responderá a la brevedad.
              </p>
            </div>

            <Link
              href="/login"
              className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a ingresar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
