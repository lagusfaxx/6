"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Loader2, Shield, ShieldCheck, ShieldAlert, Smartphone } from "lucide-react";
import { apiFetch, friendlyErrorMessage } from "../../../lib/api";

// ─────────────────────────────────────────────────────────────────────────
// /cuenta/seguridad — manage Google Authenticator (TOTP) for the current user.
// Server-side endpoints:
//   GET    /auth/2fa/status
//   POST   /auth/2fa/setup     → { secret, otpauthUri, ... }
//   POST   /auth/2fa/enable    → { ok, backupCodes[] }
//   POST   /auth/2fa/verify    → step-up
//   POST   /auth/2fa/disable   → requires { code, password }
//   POST   /auth/2fa/backup-codes/regenerate
// ─────────────────────────────────────────────────────────────────────────

type Status = {
  enabled: boolean;
  enabledAt: string | null;
  backupCodesRemaining: number;
  pendingLoginVerification: boolean;
  stepUpVerifiedAt: string | null;
  stepUpFresh: boolean;
  recommendedForRole: boolean;
};

type SetupResponse = {
  secret: string;
  otpauthUri: string;
  issuer: string;
  digits: number;
  period: number;
};

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // fallthrough — clipboard API blocked in some webviews
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10 transition"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copiado" : label || "Copiar"}
    </button>
  );
}

export default function SecurityPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Setup flow
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [enableCode, setEnableCode] = useState("");
  const [enableLoading, setEnableLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  // Disable flow
  const [showDisable, setShowDisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);

  // Step-up + regenerate
  const [stepUpCode, setStepUpCode] = useState("");
  const [stepUpLoading, setStepUpLoading] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);

  const reloadStatus = useCallback(async () => {
    try {
      setLoadingStatus(true);
      const s = await apiFetch<Status>("/auth/2fa/status");
      setStatus(s);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    reloadStatus();
  }, [reloadStatus]);

  const startSetup = useCallback(async () => {
    setError(null);
    setSetupLoading(true);
    try {
      const s = await apiFetch<SetupResponse>("/auth/2fa/setup", { method: "POST" });
      setSetup(s);
      setEnableCode("");
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setSetupLoading(false);
    }
  }, []);

  const enableTotp = useCallback(async () => {
    setError(null);
    setEnableLoading(true);
    try {
      const r = await apiFetch<{ ok: boolean; backupCodes: string[] }>("/auth/2fa/enable", {
        method: "POST",
        body: JSON.stringify({ code: enableCode.trim() }),
      });
      setBackupCodes(r.backupCodes);
      setSetup(null);
      setEnableCode("");
      await reloadStatus();
    } catch (err: any) {
      if (err?.body?.error === "CODE_INVALID") {
        setError("Código incorrecto. Verifica que tu reloj esté sincronizado y vuelve a intentar.");
      } else {
        setError(friendlyErrorMessage(err));
      }
    } finally {
      setEnableLoading(false);
    }
  }, [enableCode, reloadStatus]);

  const disableTotp = useCallback(async () => {
    setError(null);
    setDisableLoading(true);
    try {
      await apiFetch("/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ code: disableCode.trim(), password: disablePassword }),
      });
      setShowDisable(false);
      setDisableCode("");
      setDisablePassword("");
      setBackupCodes(null);
      await reloadStatus();
    } catch (err: any) {
      if (err?.body?.error === "INVALID_PASSWORD") setError("Contraseña incorrecta.");
      else if (err?.body?.error === "CODE_INVALID") setError("Código incorrecto.");
      else setError(friendlyErrorMessage(err));
    } finally {
      setDisableLoading(false);
    }
  }, [disableCode, disablePassword, reloadStatus]);

  const stepUp = useCallback(async () => {
    setError(null);
    setStepUpLoading(true);
    try {
      await apiFetch("/auth/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ code: stepUpCode.trim() }),
      });
      setStepUpCode("");
      await reloadStatus();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setStepUpLoading(false);
    }
  }, [stepUpCode, reloadStatus]);

  const regenerateBackupCodes = useCallback(async () => {
    setError(null);
    setRegenLoading(true);
    try {
      const r = await apiFetch<{ ok: boolean; backupCodes: string[] }>(
        "/auth/2fa/backup-codes/regenerate",
        { method: "POST" },
      );
      setBackupCodes(r.backupCodes);
      await reloadStatus();
    } catch (err: any) {
      if (err?.body?.error === "STEP_UP_REQUIRED") {
        setError("Verifica tu segundo factor antes de regenerar los códigos.");
      } else {
        setError(friendlyErrorMessage(err));
      }
    } finally {
      setRegenLoading(false);
    }
  }, [reloadStatus]);

  const stepUpFreshUntil = useMemo(() => {
    if (!status?.stepUpVerifiedAt) return null;
    return new Date(new Date(status.stepUpVerifiedAt).getTime() + 5 * 60 * 1000);
  }, [status]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-12 pt-6">
      <Link
        href="/cuenta"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white/80 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a mi cuenta
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 border border-emerald-400/20">
          <Shield className="h-5 w-5 text-emerald-200" />
        </div>
        <div>
          <h1 className="text-xl font-semibold leading-tight">Seguridad de la cuenta</h1>
          <p className="text-xs text-white/50">
            Activa la verificación en dos pasos para proteger tu cuenta y las acciones críticas.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* ── Status card ── */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              {status?.enabled ? (
                <>
                  <ShieldCheck className="h-4 w-4 text-emerald-300" /> Verificación en dos pasos activa
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4 text-amber-300" /> Verificación en dos pasos desactivada
                </>
              )}
            </h2>
            {status?.enabled && status.enabledAt && (
              <p className="mt-1 text-xs text-white/50">
                Activada el {new Date(status.enabledAt).toLocaleString()}
              </p>
            )}
            {status?.recommendedForRole && !status.enabled && (
              <p className="mt-2 text-xs text-amber-200/80">
                Tu cuenta es de administrador. Activar 2FA es <strong>obligatorio</strong> para
                aprobar pagos, eliminar perfiles o cambiar permisos.
              </p>
            )}
          </div>
          {loadingStatus && <Loader2 className="h-4 w-4 animate-spin text-white/40" />}
        </div>

        {/* Backup codes remaining */}
        {status?.enabled && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-xs">
              <span className="text-white/50">Códigos de respaldo:</span>{" "}
              <span className="text-white font-medium">{status.backupCodesRemaining} disponibles</span>
            </div>
            <div className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-xs">
              <span className="text-white/50">Step-up vigente:</span>{" "}
              {status.stepUpFresh && stepUpFreshUntil ? (
                <span className="text-emerald-300">hasta {stepUpFreshUntil.toLocaleTimeString()}</span>
              ) : (
                <span className="text-white/60">no</span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Setup flow (not enabled, not started) ── */}
      {!status?.enabled && !setup && !backupCodes && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="text-sm font-semibold text-white">Activar Google Authenticator</h3>
          <ol className="mt-3 grid gap-2 text-xs text-white/60 list-decimal pl-5">
            <li>Instala una app TOTP: Google Authenticator, Authy, 1Password, o tu gestor de contraseñas.</li>
            <li>Pulsa &ldquo;Generar clave&rdquo; aquí abajo.</li>
            <li>Escanea el código <code>otpauth://</code> o pega el secret en tu app.</li>
            <li>Ingresa el código de 6 dígitos para confirmar y guarda los códigos de respaldo.</li>
          </ol>
          <button
            onClick={startSetup}
            disabled={setupLoading}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
          >
            {setupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
            Generar clave
          </button>
        </section>
      )}

      {/* ── Setup in progress ── */}
      {setup && (
        <section className="mt-6 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/[0.06] p-5">
          <h3 className="text-sm font-semibold text-white">Vincula tu app de autenticación</h3>
          <p className="mt-1 text-xs text-white/60">
            Si abres este enlace en tu teléfono, tu app de autenticación lo capturará
            automáticamente. En escritorio, copia el secret y pégalo en tu app.
          </p>

          <div className="mt-4 grid gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-white/40">Enlace otpauth://</label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-white/80">
                  {setup.otpauthUri}
                </code>
                <CopyButton value={setup.otpauthUri} label="Copiar" />
              </div>
              <a
                href={setup.otpauthUri}
                className="mt-2 inline-block text-xs text-fuchsia-300 underline underline-offset-2"
              >
                Abrir en mi app de autenticación →
              </a>
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wide text-white/40">Clave (entrada manual)</label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 select-all rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm font-mono tracking-widest text-white">
                  {setup.secret}
                </code>
                <CopyButton value={setup.secret} label="Copiar" />
              </div>
              <p className="mt-1 text-[11px] text-white/40">
                Tipo: TOTP &bull; SHA1 &bull; {setup.digits} dígitos &bull; cada {setup.period}s
              </p>
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wide text-white/40">
                Código de verificación
              </label>
              <input
                value={enableCode}
                onChange={(e) => setEnableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="123456"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-center font-mono text-lg tracking-widest text-white"
                maxLength={6}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={enableTotp}
                disabled={enableLoading || enableCode.length !== 6}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
              >
                {enableLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Confirmar y activar
              </button>
              <button
                onClick={() => {
                  setSetup(null);
                  setEnableCode("");
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70"
              >
                Cancelar
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Backup codes (after enable or regen) ── */}
      {backupCodes && (
        <section className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/[0.07] p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-100">
            <ShieldAlert className="h-4 w-4" /> Guarda estos códigos de respaldo
          </h3>
          <p className="mt-1 text-xs text-amber-100/80">
            Cada código sirve <strong>una sola vez</strong>. Te permitirán entrar si pierdes acceso a
            tu app de autenticación. Guárdalos en un lugar seguro (gestor de contraseñas, papel) —
            no los volverás a ver.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {backupCodes.map((code) => (
              <code key={code} className="rounded-md bg-black/30 px-3 py-2 font-mono text-sm text-amber-50">
                {code}
              </code>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <CopyButton value={backupCodes.join("\n")} label="Copiar todos" />
            <button
              onClick={() => setBackupCodes(null)}
              className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70"
            >
              Ya los guardé
            </button>
          </div>
        </section>
      )}

      {/* ── Enabled: step-up + regenerate + disable ── */}
      {status?.enabled && (
        <section className="mt-6 grid gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-sm font-semibold text-white">Verificar para acciones críticas</h3>
            <p className="mt-1 text-xs text-white/50">
              Algunas acciones (eliminar perfiles, aprobar pagos, cambiar permisos) requieren un
              código fresco. Verifica aquí para extender la ventana de step-up por 5 minutos.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={stepUpCode}
                onChange={(e) => setStepUpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="123456"
                maxLength={6}
                className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-center font-mono text-lg tracking-widest text-white"
              />
              <button
                onClick={stepUp}
                disabled={stepUpLoading || stepUpCode.length !== 6}
                className="rounded-lg bg-emerald-500/20 border border-emerald-400/30 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-50"
              >
                {stepUpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-sm font-semibold text-white">Regenerar códigos de respaldo</h3>
            <p className="mt-1 text-xs text-white/50">
              Invalida los códigos anteriores y genera 8 nuevos. Requiere step-up vigente.
            </p>
            <button
              onClick={regenerateBackupCodes}
              disabled={regenLoading || !status.stepUpFresh}
              className="mt-3 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 disabled:opacity-50"
            >
              {regenLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Regenerar"}
            </button>
            {!status.stepUpFresh && (
              <p className="mt-2 text-[11px] text-white/40">Verifica un código arriba para habilitar.</p>
            )}
          </div>

          <div className="rounded-2xl border border-red-400/20 bg-red-500/[0.05] p-5">
            <h3 className="text-sm font-semibold text-red-100">Desactivar 2FA</h3>
            <p className="mt-1 text-xs text-red-100/70">
              Tu cuenta volverá a depender solo de tu contraseña. Requerimos contraseña + código
              actual para confirmarlo.
            </p>
            {!showDisable ? (
              <button
                onClick={() => setShowDisable(true)}
                className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-100"
              >
                Desactivar
              </button>
            ) : (
              <div className="mt-3 grid gap-2">
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                />
                <input
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  placeholder="Código actual"
                  maxLength={6}
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-center font-mono text-lg tracking-widest text-white"
                />
                <div className="flex gap-2">
                  <button
                    onClick={disableTotp}
                    disabled={disableLoading || !disablePassword || disableCode.length !== 6}
                    className="rounded-lg bg-red-500/20 border border-red-400/30 px-4 py-2 text-sm font-semibold text-red-100 disabled:opacity-50"
                  >
                    {disableLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar desactivación"}
                  </button>
                  <button
                    onClick={() => {
                      setShowDisable(false);
                      setDisableCode("");
                      setDisablePassword("");
                    }}
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
