"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mail, RefreshCw, CheckCircle2, ArrowLeft, MessageCircle, Smartphone } from "lucide-react";
import { apiFetch } from "../lib/api";

type CodeChannel = "email" | "whatsapp" | "sms";

type SendCodeResponse = {
  ok: boolean;
  channel?: CodeChannel;
  destination?: string;
  fallback?: boolean;
};

const CHANNEL_LABEL: Record<CodeChannel, string> = {
  email: "email",
  whatsapp: "WhatsApp",
  sms: "SMS",
};

interface EmailVerificationProps {
  email: string;
  /** Teléfono del formulario: permite recibir el código por WhatsApp o SMS. */
  phone?: string;
  /** Nombre para el saludo del mensaje de WhatsApp. */
  name?: string;
  onVerified: () => void | Promise<void>;
  onBack?: () => void;
}

export default function EmailVerification({ email, phone, name, onVerified, onBack }: EmailVerificationProps) {
  const [channel, setChannel] = useState<CodeChannel>("email");
  const [destination, setDestination] = useState(email);
  const [notice, setNotice] = useState<string | null>(null);
  const [phoneChannels, setPhoneChannels] = useState<Array<"whatsapp" | "sms">>([]);
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
    if (phone) {
      apiFetch<{ phone?: Array<"whatsapp" | "sms"> }>("/auth/verification/channels")
        .then((r) => setPhoneChannels(r.phone ?? []))
        .catch(() => {});
    }
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

  async function sendCode(requested: CodeChannel = "email") {
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      const r = await apiFetch<SendCodeResponse>("/auth/verification/send-code", {
        method: "POST",
        body: JSON.stringify({ email, phone, name, channel: requested }),
      });
      const sentBy = r?.channel ?? requested;
      setChannel(sentBy);
      setDestination(r?.destination ?? (sentBy === "email" ? email : phone ?? ""));
      if (r?.fallback) {
        setNotice(`No pudimos enviarte el email, así que te mandamos el código por ${CHANNEL_LABEL[sentBy]}.`);
      }
      setCode(["", "", "", "", "", ""]);
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
      if (Array.isArray(err?.body?.phoneChannels)) setPhoneChannels(err.body.phoneChannels);
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
      // Call onVerified (which now creates the account) and wait for it
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

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 blur-2xl scale-150" />
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center">
              {success ? (
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              ) : channel === "email" ? (
                <Mail className="h-10 w-10 text-fuchsia-300" />
              ) : channel === "whatsapp" ? (
                <MessageCircle className="h-10 w-10 text-fuchsia-300" />
              ) : (
                <Smartphone className="h-10 w-10 text-fuchsia-300" />
              )}
            </div>
          </div>
          <h1 className="mt-5 text-2xl font-bold text-white">
            {success
              ? creatingAccount
                ? "Creando tu cuenta..."
                : "Verificado"
              : channel === "email"
                ? "Verifica tu email"
                : "Verifica tu cuenta"}
          </h1>
          <p className="mt-2 text-sm text-white/50 text-center max-w-xs">
            {success ? (
              creatingAccount
                ? "Código verificado. Estamos creando tu cuenta..."
                : "Tu cuenta ha sido creada correctamente."
            ) : (
              <>
                Enviamos un código de 6 dígitos{" "}
                {channel === "email" ? "a" : `por ${CHANNEL_LABEL[channel]} al`}{" "}
                <span className="text-fuchsia-300 font-medium">{destination}</span>
              </>
            )}
          </p>
        </div>

        {!success && (
          <div className="relative rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />

            <div className="p-5 sm:p-8">
              {/* Code inputs */}
              {/* En el teléfono las casillas más angostas: con 48px cada una
                  no cabían las seis y se cortaban la primera y la última. */}
              <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    disabled={loading}
                    className={`h-12 w-10 sm:h-14 sm:w-12 text-center text-xl font-bold rounded-xl border transition-all duration-200 outline-none bg-white/5 ${
                      digit
                        ? "border-fuchsia-400/50 text-white shadow-[0_0_15px_rgba(232,121,249,0.15)]"
                        : "border-white/10 text-white/80"
                    } focus:border-fuchsia-400/60 focus:ring-2 focus:ring-fuchsia-500/20`}
                  />
                ))}
              </div>

              {/* Timer */}
              <div className="mt-4 flex justify-center">
                <span className={`text-xs font-mono ${expiresIn < 60 ? "text-red-400" : "text-white/40"}`}>
                  Expira en {formatTime(expiresIn)}
                </span>
              </div>

              {notice && (
                <div className="mt-4 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/10 px-4 py-3 text-sm text-fuchsia-100 text-center">
                  {notice}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 text-center">
                  {error}
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="mt-4 flex justify-center">
                  <div className="w-6 h-6 border-2 border-fuchsia-400/30 border-t-fuchsia-400 rounded-full animate-spin" />
                </div>
              )}

              {/* Resend */}
              <div className="mt-6 flex flex-col items-center gap-3">
                <button
                  onClick={() => sendCode(channel)}
                  disabled={cooldown > 0 || resending}
                  className="flex items-center gap-2 text-sm text-fuchsia-300/70 hover:text-fuchsia-300 disabled:text-white/30 disabled:cursor-not-allowed transition"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
                  {cooldown > 0
                    ? `Reenviar en ${formatTime(cooldown)}`
                    : resending
                      ? "Enviando..."
                      : "Reenviar código"}
                </button>

                {/* Otros canales: cambiar de canal no espera el cooldown. */}
                {phone && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {(["email", ...phoneChannels] as CodeChannel[])
                      .filter((c) => c !== channel)
                      .map((c) => (
                        <button
                          key={c}
                          onClick={() => sendCode(c)}
                          disabled={resending}
                          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50 transition"
                        >
                          {c === "whatsapp" ? (
                            <MessageCircle className="h-3.5 w-3.5" />
                          ) : c === "sms" ? (
                            <Smartphone className="h-3.5 w-3.5" />
                          ) : (
                            <Mail className="h-3.5 w-3.5" />
                          )}
                          Recibir por {CHANNEL_LABEL[c]}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            {onBack && (
              <div className="px-8 pb-6">
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Volver al registro
                </button>
              </div>
            )}
          </div>
        )}

        {success && (
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              {creatingAccount ? (
                <div className="w-8 h-8 border-2 border-fuchsia-400/30 border-t-fuchsia-400 rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
