"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { apiFetch, friendlyErrorMessage } from "../../lib/api";

export default function LoginClient() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      window.location.replace(next || "/");
    } catch (err: any) {
      setError(friendlyErrorMessage(err) || "Error al iniciar sesión");
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

          <form onSubmit={onSubmit} className="p-8 grid gap-5">
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

        {/* Support */}
        <p className="mt-6 text-center text-xs text-white/30">
          ¿Problemas para ingresar?{" "}
          <a href="mailto:soporte@uzeed.cl" className="text-white/50 hover:text-white/70 underline transition">
            soporte@uzeed.cl
          </a>
        </p>
      </div>
    </div>
  );
}
