"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Copy, Check, KeyRound, AlertTriangle, ExternalLink } from "lucide-react";
import useMe from "../../../../hooks/useMe";
import { apiFetch, friendlyErrorMessage } from "../../../../lib/api";

type SetupResponse = { secret: string; otpauthUrl: string };

export default function TwoFactorSetupPage() {
  const { me, loading: meLoading, refresh } = useMe();
  const user = me?.user ?? null;
  const isAdmin = (user?.role ?? "").toUpperCase() === "ADMIN";
  const already = Boolean(user?.twoFactorEnabled);

  const [stage, setStage] = useState<"intro" | "show-secret" | "confirm" | "done">("intro");
  const [data, setData] = useState<SetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<"secret" | "url" | null>(null);

  useEffect(() => {
    if (already) setStage("done");
  }, [already]);

  async function startSetup() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<SetupResponse>("/auth/2fa/setup", { method: "POST" });
      setData(res);
      setStage("show-secret");
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/auth/2fa/enable", {
        method: "POST",
        body: JSON.stringify({ code: code.replace(/\s+/g, "") }),
      });
      setStage("done");
      await refresh();
    } catch (err: any) {
      setError(friendlyErrorMessage(err) || "Código incorrecto");
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string, kind: "secret" | "url") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  }

  if (meLoading) {
    return <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center text-white/50">Cargando...</div>;
  }
  if (!user) {
    return <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center text-white/50">Inicia sesión.</div>;
  }
  if (!isAdmin) {
    return <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center text-white/50">Solo administradores.</div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600 to-violet-600">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Doble factor (Google Authenticator)</h1>
            <p className="text-xs text-white/40">
              Protección obligatoria para cuentas administradoras.
            </p>
          </div>
        </div>

        {stage === "intro" && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4">
            <p className="text-sm text-white/70 leading-relaxed">
              Vamos a vincular tu cuenta con una app de códigos temporales (Google
              Authenticator, Authy, 1Password, etc.). A partir de ese momento, cada inicio
              de sesión y cada acción crítica (eliminar perfiles, banners, listados, etc.)
              te pedirá el código de 6 dígitos que aparece en tu app.
            </p>
            <ol className="text-sm text-white/60 space-y-2 list-decimal list-inside">
              <li>Abre Google Authenticator en tu teléfono.</li>
              <li>Toca <span className="text-white/85 font-medium">+</span> → <span className="text-white/85 font-medium">Introducir una clave de configuración</span>.</li>
              <li>Pega o ingresa la clave que te mostraremos en el siguiente paso.</li>
              <li>Ingresa el código que genera la app para confirmar.</li>
            </ol>
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error}
              </div>
            )}
            <button
              onClick={startSetup}
              disabled={loading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? "Generando..." : "Empezar configuración"}
            </button>
          </div>
        )}

        {stage === "show-secret" && data && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-5">
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-300" />
              <p className="text-xs text-amber-100/80">
                Guarda esta clave en un lugar seguro. Si pierdes el acceso a la app de
                códigos, necesitarás reconfigurar el doble factor desde otro dispositivo
                con sesión iniciada.
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-widest text-white/30 mb-2">Clave secreta</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2.5 text-sm font-mono text-fuchsia-200 select-all">
                  {data.secret}
                </code>
                <button
                  type="button"
                  onClick={() => copy(data.secret, "secret")}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-xs text-white/70 hover:bg-white/[0.08] transition flex items-center gap-1.5"
                >
                  {copied === "secret" ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                  Copiar
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-widest text-white/30 mb-2">URL de aprovisionamiento</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2.5 text-[11px] font-mono text-white/55">
                  {data.otpauthUrl}
                </code>
                <button
                  type="button"
                  onClick={() => copy(data.otpauthUrl, "url")}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-xs text-white/70 hover:bg-white/[0.08] transition flex items-center gap-1.5"
                >
                  {copied === "url" ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                  Copiar
                </button>
              </div>
              <p className="mt-2 text-[11px] text-white/35">
                Si tu app permite escanear, puedes generar un QR a partir de esta URL en un
                generador de tu confianza. La mayoría de admins prefieren ingresar la clave
                manualmente arriba.
              </p>
            </div>

            <button
              onClick={() => setStage("confirm")}
              className="btn-primary w-full py-3"
            >
              Ya la agregué a mi app
            </button>
          </div>
        )}

        {stage === "confirm" && (
          <form
            onSubmit={confirm}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-5"
          >
            <div className="flex flex-col items-center text-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-fuchsia-500/15">
                <KeyRound className="h-6 w-6 text-fuchsia-300" />
              </div>
              <h2 className="text-base font-semibold">Confirma con el código generado</h2>
              <p className="text-xs text-white/55">
                Ingresa el código de 6 dígitos que muestra Google Authenticator ahora mismo.
              </p>
            </div>
            <input
              className="input text-center tracking-[0.4em] text-lg"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={6}
              autoFocus
              required
            />
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error}
              </div>
            )}
            <button
              disabled={loading || code.length !== 6}
              className="btn-primary w-full py-3 disabled:opacity-60"
            >
              {loading ? "Activando..." : "Activar doble factor"}
            </button>
          </form>
        )}

        {stage === "done" && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-6 text-center space-y-4">
            <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-emerald-500/15">
              <ShieldCheck className="h-7 w-7 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Doble factor activado</h2>
              <p className="text-xs text-white/55 mt-1">
                A partir de ahora se te pedirá el código en cada inicio de sesión y en
                cada acción crítica del panel.
              </p>
            </div>
            <a
              href="/admin"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 px-5 py-2.5 text-sm font-medium text-white transition"
            >
              Ir al dashboard
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
