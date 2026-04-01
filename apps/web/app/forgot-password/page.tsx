"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { KeyRound, Mail, ArrowLeft, Eye, EyeOff, RefreshCw, CheckCircle2, Lock } from "lucide-react";
import { apiFetch } from "../../lib/api";

type Step = "email" | "code" | "newPassword" | "success";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [expiresIn, setExpiresIn] = useState(600);
  const [codeExpired, setCodeExpired] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval>>();
  const expiryRef = useRef<ReturnType<typeof setInterval>>();
  const verifiedCode = useRef("");

  const startCooldown = useCallback(() => {
    setCooldown(120);
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

  function startExpiryTimer() {
    setExpiresIn(600);
    setCodeExpired(false);
    if (expiryRef.current) clearInterval(expiryRef.current);
    expiryRef.current = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          if (expiryRef.current) clearInterval(expiryRef.current);
          setCodeExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      if (expiryRef.current) clearInterval(expiryRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  async function sendResetCode() {
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/auth/verification/send-reset-code", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      startCooldown();
      startExpiryTimer();
      setStep("code");
    } catch (err: any) {
      const msg = err?.body?.message || "Error al enviar el código.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/auth/verification/send-reset-code", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      startCooldown();
      startExpiryTimer();
      setCode(["", "", "", "", "", ""]);
    } catch (err: any) {
      setError(err?.body?.message || "Error al reenviar el código.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(fullCode: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{ resetToken?: string }>("/auth/verification/verify-reset-code", {
        method: "POST",
        body: JSON.stringify({ email, code: fullCode }),
      });
      verifiedCode.current = result.resetToken || fullCode;
      setStep("newPassword");
    } catch (err: any) {
      setError(err?.body?.message || "Código incorrecto.");
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/auth/verification/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, resetToken: verifiedCode.current, newPassword }),
      });
      setStep("success");
    } catch (err: any) {
      setError(err?.body?.message || "Error al cambiar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  function handleCodeChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    const fullCode = newCode.join("");
    if (fullCode.length === 6) {
      verifyCode(fullCode);
    }
  }

  function handleCodeKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleCodePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const newCode = [...code];
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }
    setCode(newCode);
    if (pasted.length === 6) {
      verifyCode(pasted);
    } else {
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
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
              {step === "success" ? (
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              ) : step === "newPassword" ? (
                <Lock className="h-10 w-10 text-fuchsia-300" />
              ) : step === "code" ? (
                <Mail className="h-10 w-10 text-fuchsia-300" />
              ) : (
                <KeyRound className="h-10 w-10 text-fuchsia-300" />
              )}
            </div>
          </div>
          <h1 className="mt-5 text-3xl font-bold bg-gradient-to-r from-white via-fuchsia-200 to-violet-200 bg-clip-text text-transparent">
            {step === "success"
              ? "Contraseña actualizada"
              : step === "newPassword"
                ? "Nueva contraseña"
                : step === "code"
                  ? "Verifica tu email"
                  : "Recuperar contraseña"}
          </h1>
          <p className="mt-2 text-sm text-white/50 text-center">
            {step === "success"
              ? "Ya puedes ingresar con tu nueva contraseña."
              : step === "newPassword"
                ? "Ingresa tu nueva contraseña."
                : step === "code"
                  ? <>Enviamos un código de 6 dígitos a <span className="text-fuchsia-300 font-medium">{email}</span></>
                  : "Ingresa tu email para recibir un código de recuperación."}
          </p>
        </div>

        {/* Card */}
        <div className="relative rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />

          <div className="p-8">
            {step === "email" && (
              <form onSubmit={(e) => { e.preventDefault(); sendResetCode(); }} className="grid gap-5">
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
                  disabled={loading}
                  className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Enviar código
                    </>
                  )}
                </button>
              </form>
            )}

            {step === "code" && (
              <>
                {/* Code inputs */}
                <div className="flex justify-center gap-3" onPaste={handleCodePaste}>
                  {code.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(i, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(i, e)}
                      disabled={loading || codeExpired}
                      className={`w-12 h-14 text-center text-xl font-bold rounded-xl border transition-all duration-200 outline-none bg-white/5 ${
                        digit
                          ? "border-fuchsia-400/50 text-white shadow-[0_0_15px_rgba(232,121,249,0.15)]"
                          : "border-white/10 text-white/80"
                      } focus:border-fuchsia-400/60 focus:ring-2 focus:ring-fuchsia-500/20`}
                    />
                  ))}
                </div>

                {/* Timer */}
                <div className="mt-4 flex justify-center">
                  {codeExpired ? (
                    <span className="text-xs font-medium text-red-400">
                      El código ha expirado. Solicita uno nuevo.
                    </span>
                  ) : (
                    <span className={`text-xs font-mono ${expiresIn < 60 ? "text-red-400" : "text-white/40"}`}>
                      Expira en {formatTime(expiresIn)}
                    </span>
                  )}
                </div>

                {error && (
                  <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 text-center">
                    {error}
                  </div>
                )}

                {loading && (
                  <div className="mt-4 flex justify-center">
                    <div className="w-6 h-6 border-2 border-fuchsia-400/30 border-t-fuchsia-400 rounded-full animate-spin" />
                  </div>
                )}

                {/* Resend */}
                <div className="mt-6 flex flex-col items-center gap-3">
                  <button
                    onClick={resendCode}
                    disabled={cooldown > 0 || loading}
                    className="flex items-center gap-2 text-sm text-fuchsia-300/70 hover:text-fuchsia-300 disabled:text-white/30 disabled:cursor-not-allowed transition"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    {cooldown > 0
                      ? `Reenviar en ${formatTime(cooldown)}`
                      : "Reenviar código"}
                  </button>
                </div>
              </>
            )}

            {step === "newPassword" && (
              <form onSubmit={(e) => { e.preventDefault(); resetPassword(); }} className="grid gap-5">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-white/70">Nueva contraseña</label>
                  <div className="relative">
                    <input
                      className="input pr-12"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
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

                <div className="grid gap-2">
                  <label className="text-sm font-medium text-white/70">Confirmar contraseña</label>
                  <input
                    className="input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    placeholder="Repite tu nueva contraseña"
                    autoComplete="new-password"
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                <button
                  disabled={loading}
                  className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Cambiar contraseña
                    </>
                  )}
                </button>
              </form>
            )}

            {step === "success" && (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <p className="text-sm text-white/60 leading-relaxed">
                  Tu contraseña ha sido actualizada correctamente. Ya puedes ingresar con tu nueva contraseña.
                </p>
                <Link
                  href="/login"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 btn-primary py-3.5 text-base"
                >
                  Ir a ingresar
                </Link>
              </div>
            )}

            {step !== "success" && (
              <Link
                href={step === "email" ? "/login" : "#"}
                onClick={step !== "email" ? (e) => {
                  e.preventDefault();
                  if (step === "code") {
                    setStep("email");
                    setCodeExpired(false);
                  }
                  if (step === "newPassword") {
                    verifiedCode.current = "";
                    setStep("code");
                  }
                  setError(null);
                  setCode(["", "", "", "", "", ""]);
                } : undefined}
                className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white transition"
              >
                <ArrowLeft className="h-4 w-4" />
                {step === "email" ? "Volver a ingresar" : "Volver"}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
