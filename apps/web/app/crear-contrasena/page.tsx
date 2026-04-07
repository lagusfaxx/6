"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { apiFetch } from "../../lib/api";

export default function CrearContrasenaPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const email = params.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isValid =
    password.length >= 8 && password === confirm && token && email;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      await apiFetch("/auth/verification/set-password", {
        method: "POST",
        body: JSON.stringify({ email, token, newPassword: password }),
      });
      setDone(true);
      setTimeout(() => router.push("/cuenta"), 2000);
    } catch (err: any) {
      setError(
        err?.body?.message || "Ocurrió un error. Intenta nuevamente.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!token || !email) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <p className="text-sm text-white/50">
          Enlace inválido. Revisa tu correo electrónico e intenta nuevamente.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
        </div>
        <h1 className="text-xl font-bold text-white">Contraseña creada</h1>
        <p className="mt-2 text-sm text-white/50">
          Redirigiendo a tu cuenta...
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-fuchsia-500/40 focus:bg-white/[0.06]";

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20">
          <Lock className="h-6 w-6 text-fuchsia-400" />
        </div>
        <h1 className="text-xl font-bold text-white">Crea tu contraseña</h1>
        <p className="mt-1 text-xs text-white/40">
          Para acceder a tu cuenta y completar tu perfil
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/60">
            Nueva contraseña
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              className={inputClass + " pr-10"}
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/60">
            Confirmar contraseña
          </label>
          <input
            type="password"
            className={inputClass}
            placeholder="Repite tu contraseña"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {confirm && password !== confirm && (
            <p className="mt-1 text-[11px] text-red-400">
              Las contraseñas no coinciden
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-40"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
            </>
          ) : (
            "Crear contraseña"
          )}
        </button>
      </form>
    </div>
  );
}
