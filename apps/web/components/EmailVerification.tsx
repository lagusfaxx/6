"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mail, RefreshCw, CheckCircle2, ArrowLeft, ShieldCheck } from "lucide-react";
import { apiFetch } from "../lib/api";

interface EmailVerificationProps {
  email: string;
  onVerified: () => void | Promise<void>;
  onBack?: () => void;
}

export default function EmailVerification({ email, onVerified, onBack }: EmailVerificationProps) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [expiresIn, setExpiresIn] = useState(600);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval>>();
  const expiryRef = useRef<ReturnType<typeof setInterval>>();

  // Send code on mount
  useEffect(() => {
    sendCode();
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      if (expiryRef.current) clearInterval(expiryRef.current);
    };
  }, []);

  // Start expiry countdown
  useEffect(() => {
    expiryRef.current = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          if (expiryRef.current) clearInterval(expiryRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (expiryRef.current) clearInterval(expiryRef.current);
    };
  }, []);

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

  async function sendCode() {
    setResending(true);
    setError(null);
    try {
      await apiFetch("/auth/verification/send-code", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      startCooldown();
      setExpiresIn(600);
      if (expiryRef.current) clearInterval(expiryRef.current);
      expiryRef.current = setInterval(() => {
        setExpiresIn((prev) => {
          if (prev <= 1) {
            if (expiryRef.current) clearInterval(expiryRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      const msg = err?.body?.message || "Error al enviar el código";
      setError(msg);
    } finally {
      setResending(false);
    }
  }

  async function verifyCode(fullCode: string) {
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/auth/verification/verify-code", {
        method: "POST",
        body: JSON.stringify({ email, code: fullCode }),
      });
      setSuccess(true);
      setCreatingAccount(true);
      await onVerified();
    } catch (err: any) {
      setSuccess(false);
      setCreatingAccount(false);
      const msg = err?.body?.message || "Código incorrecto";
      setError(msg);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
      setCreatingAccount(false);
    }
  }

  function handleChange(index: number, value: string) {
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

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Mask email for display
  const maskedEmail = (() => {
    const [local, domain] = email.split("@");
    if (!domain) return email;
    const visible = local.slice(0, 2);
    return `${visible}${"*".repeat(Math.max(local.length - 2, 2))}@${domain}`;
  })();

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 blur-2xl scale-150" />
          <div
            className={`relative w-20 h-20 rounded-2xl border border-white/10 flex items-center justify-center transition-all duration-500 ${
              success
                ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-400/20"
                : "bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20"
            }`}
          >
            {success ? (
              <CheckCircle2 className="h-10 w-10 text-emerald-400 animate-[scaleIn_0.3s_ease-out]" />
            ) : (
              <Mail className="h-10 w-10 text-fuchsia-300" />
            )}
          </div>
        </div>
        <h1 className="mt-5 text-2xl font-bold text-white">
          {success
            ? creatingAccount
              ? "Creando tu cuenta..."
              : "Verificado"
            : "Verifica tu email"}
        </h1>
        <p className="mt-2 text-sm text-white/50 text-center max-w-xs">
          {success ? (
            creatingAccount
              ? "Email verificado. Estamos creando tu cuenta..."
              : "Tu cuenta ha sido creada correctamente."
          ) : (
            <>
              Enviamos un código de 6 dígitos a{" "}
              <span className="text-fuchsia-300/80 font-medium">{maskedEmail}</span>
            </>
          )}
        </p>
      </div>

      {!success && (
        <div className="relative rounded-3xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />

          <div className="p-6 sm:p-8">
            {/* Security badge */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/[0.08] px-3 py-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-fuchsia-300/70" />
                <span className="text-[11px] text-white/40 font-medium">Verificación segura</span>
              </div>
            </div>

            {/* Code inputs */}
            <div className="flex justify-center gap-2.5 sm:gap-3" onPaste={handlePaste}>
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputRefs.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  disabled={loading}
                  className={`w-11 h-14 sm:w-12 sm:h-15 text-center text-xl font-bold rounded-xl border transition-all duration-200 outline-none bg-white/[0.04] ${
                    digit
                      ? "border-fuchsia-400/40 text-white shadow-[0_0_20px_rgba(232,121,249,0.12)]"
                      : "border-white/[0.08] text-white/80"
                  } focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-500/20 focus:bg-white/[0.06] disabled:opacity-50`}
                />
              ))}
            </div>

            {/* Timer bar */}
            <div className="mt-5 flex flex-col items-center gap-2">
              <div className="w-full max-w-[200px] h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    expiresIn < 60
                      ? "bg-gradient-to-r from-red-500 to-red-400"
                      : "bg-gradient-to-r from-fuchsia-500 to-violet-500"
                  }`}
                  style={{ width: `${(expiresIn / 600) * 100}%` }}
                />
              </div>
              <span
                className={`text-xs font-mono ${
                  expiresIn < 60 ? "text-red-400" : "text-white/35"
                }`}
              >
                {expiresIn === 0 ? "Código expirado" : `Expira en ${formatTime(expiresIn)}`}
              </span>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 text-center flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 shrink-0 text-red-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="mt-5 flex justify-center">
                <div className="w-6 h-6 border-2 border-fuchsia-400/30 border-t-fuchsia-400 rounded-full animate-spin" />
              </div>
            )}

            {/* Resend */}
            <div className="mt-6 flex flex-col items-center gap-3">
              <div className="h-px w-full bg-white/[0.06]" />
              <p className="text-[11px] text-white/30">¿No recibiste el código?</p>
              <button
                onClick={sendCode}
                disabled={cooldown > 0 || resending}
                className={`flex items-center gap-2 text-sm font-medium transition-all ${
                  cooldown > 0 || resending
                    ? "text-white/25 cursor-not-allowed"
                    : "text-fuchsia-300/70 hover:text-fuchsia-300"
                }`}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
                {cooldown > 0
                  ? `Reenviar en ${formatTime(cooldown)}`
                  : resending
                    ? "Enviando..."
                    : "Reenviar código"}
              </button>
            </div>
          </div>

          {/* Back button */}
          {onBack && (
            <div className="border-t border-white/[0.05] px-6 py-4 sm:px-8">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-xs text-white/35 hover:text-white/55 transition"
              >
                <ArrowLeft className="h-3 w-3" />
                Volver al formulario
              </button>
            </div>
          )}
        </div>
      )}

      {success && (
        <div className="flex justify-center animate-[scaleIn_0.3s_ease-out]">
          <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shadow-[0_0_40px_rgba(52,211,153,0.15)]">
            {creatingAccount ? (
              <div className="w-8 h-8 border-2 border-fuchsia-400/30 border-t-fuchsia-400 rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="h-9 w-9 text-emerald-400" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
