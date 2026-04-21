"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LogIn, ArrowLeft } from "lucide-react";
import { apiFetch, friendlyErrorMessage, getApiBase, safeRedirect } from "../../lib/api";

const GOOGLE_OAUTH_ERRORS: Record<string, string> = {
  access_denied: "Cancelaste el inicio de sesión con Google.",
  email_not_verified: "Tu cuenta de Google no tiene email verificado.",
  invalid_state: "La sesión de Google expiró. Intenta de nuevo.",
  token_exchange_failed: "No pudimos validar tu cuenta de Google. Intenta de nuevo.",
  userinfo_failed: "No pudimos obtener tus datos de Google. Intenta de nuevo.",
  no_access_token: "Google no devolvió un token válido. Intenta de nuevo.",
  create_failed: "No pudimos crear tu cuenta. Intenta de nuevo.",
  google_unavailable: "El inicio con Google no está disponible por ahora.",
};

export default function LoginClient() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const oauthError = searchParams.get("oauth_error");
    if (oauthError) {
      setError(GOOGLE_OAUTH_ERRORS[oauthError] || "No pudimos iniciar sesión con Google.");
    }
  }, [searchParams]);

  function onGoogleClick() {
    setGoogleLoading(true);
    setError(null);
    const next = safeRedirect(searchParams.get("next"));
    const url = `${getApiBase()}/auth/google/start?next=${encodeURIComponent(next)}`;
    window.location.href = url;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const next = searchParams.get("next");
      window.location.replace(safeRedirect(next));
    } catch (err: any) {
      if (err?.status === 401) {
        setError("Correo o contraseña incorrectos.");
      } else {
        setError(friendlyErrorMessage(err) || "Error al iniciar sesión");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 blur-2xl scale-150" />
            <img
              src="/brand/isotipo-new.png"
              alt="UZEED"
              className="relative w-20 h-20 rounded-2xl shadow-2xl"
            />
          </div>
          <h1 className="mt-5 text-3xl font-bold bg-gradient-to-r from-white via-fuchsia-200 to-violet-200 bg-clip-text text-transparent">
            Bienvenido
          </h1>
          <p className="mt-2 text-sm text-white/50">Accede a tu cuenta para continuar</p>
        </div>

        {/* Card */}
        <div className="relative rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />

          {/* Google sign-in */}
          <div className="px-8 pt-8">
            <button
              type="button"
              onClick={onGoogleClick}
              disabled={googleLoading || loading}
              className="w-full flex items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/95 hover:bg-white text-gray-800 font-medium py-3 transition disabled:opacity-60"
            >
              {googleLoading ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
                  </svg>
                  Continuar con Google
                </>
              )}
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 text-xs text-white/40 bg-[#0d0e1a]">o con correo</span>
              </div>
            </div>
          </div>

          <form onSubmit={onSubmit} className="px-8 pb-8 grid gap-5">
            {/* Email */}
            <div className="grid gap-2">
              <label className="text-sm font-medium text-white/70">Email</label>
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                type="email"
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="grid gap-2">
              <label className="text-sm font-medium text-white/70">Contraseña</label>
              <div className="relative">
                <input
                  className="input pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="current-password"
                  placeholder="Tu contraseña"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-xs text-fuchsia-300/70 hover:text-fuchsia-300 transition"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              disabled={loading}
              className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Ingresar
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="px-8 pb-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 text-xs text-white/40 bg-[#0d0e1a]">¿No tienes cuenta?</span>
              </div>
            </div>
            <Link
              href="/register"
              className="mt-4 block w-full text-center rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white transition"
            >
              Crear cuenta
            </Link>
          </div>
        </div>

        {/* Back to home */}
        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white/70 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al inicio
          </Link>
        </div>

        {/* Support */}
        <p className="mt-4 text-center text-xs text-white/30">
          ¿Problemas para ingresar?{" "}
          <a href="mailto:soporte@uzeed.cl" className="text-white/50 hover:text-white/70 underline transition">
            soporte@uzeed.cl
          </a>
        </p>
      </div>
    </div>
  );
}
