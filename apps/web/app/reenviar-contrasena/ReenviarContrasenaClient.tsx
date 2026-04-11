"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, ArrowLeft, CheckCircle2, RefreshCw, KeyRound } from "lucide-react";
import { apiFetch } from "../../lib/api";

export default function ReenviarContrasenaClient() {
  const params = useSearchParams();
  const [email, setEmail] = useState(() => params.get("email") || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval>>();

  const startCooldown = useCallback((seconds = 120) => {
    setCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || cooldown > 0) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/auth/verification/resend-set-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setSent(true);
      startCooldown(120);
    } catch (err: any) {
      const waitSeconds = err?.body?.waitSeconds;
      if (typeof waitSeconds === "number") {
        startCooldown(waitSeconds);
      }
      setError(err?.body?.message || "No se pudo enviar el correo. Intenta nuevamente.");
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
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center">
              {sent ? (
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              ) : (
                <KeyRound className="h-10 w-10 text-fuchsia-300" />
              )}
            </div>
          </div>
          <h1 className="mt-5 text-3xl font-bold bg-gradient-to-r from-white via-fuchsia-200 to-violet-200 bg-clip-text text-transparent text-center">
            {sent ? "Correo enviado" : "Reenviar correo"}
          </h1>
          <p className="mt-2 text-sm text-white/50 text-center">
            {sent ? (
              <>Si existe una cuenta pendiente con ese correo, enviamos un nuevo enlace para crear tu contraseña. Revisa tu bandeja de entrada y la carpeta de spam.</>
            ) : (
              <>Ingresa el correo que usaste al publicarte. Te enviaremos un nuevo enlace para crear tu contraseña.</>
            )}
          </p>
        </div>

        {/* Card */}
        <div className="relative rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />

          <div className="p-8">
            {!sent && (
              <form onSubmit={handleSubmit} className="grid gap-5">
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

                {error && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || cooldown > 0}
                  className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : cooldown > 0 ? (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Reenviar en {formatTime(cooldown)}
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Enviar enlace
                    </>
                  )}
                </button>
              </form>
            )}

            {sent && (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30">
                  <Mail className="h-8 w-8 text-emerald-300" />
                </div>
                <p className="text-sm text-white/60 leading-relaxed">
                  El enlace expira en 72 horas. Si ya creaste tu contraseña antes,
                  usa la opción{" "}
                  <Link href="/forgot-password" className="text-fuchsia-300 hover:text-fuchsia-200">
                    Recuperar contraseña
                  </Link>{" "}
                  en su lugar.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (cooldown === 0) {
                      setSent(false);
                      setError(null);
                    }
                  }}
                  disabled={cooldown > 0}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="h-4 w-4" />
                  {cooldown > 0 ? `Reenviar en ${formatTime(cooldown)}` : "Reenviar otra vez"}
                </button>
              </div>
            )}

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
