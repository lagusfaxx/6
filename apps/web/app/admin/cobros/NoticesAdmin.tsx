"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, MessageCircle, Send } from "lucide-react";
import { apiFetch, friendlyErrorMessage } from "../../../lib/api";

/**
 * Avisos de "tu perfil está apagado" (correo, WhatsApp y app). El worker los
 * manda solo cada hora; acá se ven los números y se pueden mandar al tiro.
 */

type Stats = {
  activo: boolean;
  motivo: string | null;
  correoConfigurado: boolean;
  whatsappConfigurado: boolean;
  perfilesApagados: number;
  avisos: { primero: number; segundo: number; tercero: number };
  correos: { ok: number; fallidos: number };
  whatsapp: { ok: number; fallidos: number };
  correosPendientes: number;
};

type Summary = {
  ran: boolean;
  reason?: string;
  avisos: number;
  correos: { ok: number; fallidos: number };
  whatsapp: { ok: number; fallidos: number };
  sinCorreo: number;
  sinWhatsapp: number;
  eligePrueba: number;
};

function summaryText(s: Summary, kind: "run" | "emails"): string {
  if (!s.ran) return s.reason || "No se envió nada.";
  if (!s.avisos && !s.eligePrueba) {
    return kind === "run"
      ? "No había avisos pendientes: a todas ya les llegó el que les toca. El siguiente sale solo cuando corresponda."
      : "No había correos pendientes.";
  }
  const parts = [
    kind === "run" ? `${s.avisos} aviso${s.avisos === 1 ? "" : "s"}` : `${s.avisos} correo${s.avisos === 1 ? "" : "s"} reenviado${s.avisos === 1 ? "" : "s"}`,
    `correos: ${s.correos.ok} enviados${s.correos.fallidos ? `, ${s.correos.fallidos} fallidos` : ""}`,
  ];
  if (kind === "run") parts.push(`WhatsApp: ${s.whatsapp.ok} enviados${s.whatsapp.fallidos ? `, ${s.whatsapp.fallidos} fallidos` : ""}`);
  if (s.eligePrueba) parts.push(`${s.eligePrueba} recordatorio${s.eligePrueba === 1 ? "" : "s"} de elegir prueba`);
  return `Listo: ${parts.join(" · ")}.`;
}

export default function NoticesAdmin() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<null | "run" | "emails">(null);
  const [confirm, setConfirm] = useState<null | "run" | "emails">(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () =>
    apiFetch<Stats>("/admin/billing/notices")
      .then((s) => {
        setStats(s);
        setError("");
      })
      .catch((e) => setError(friendlyErrorMessage(e)));

  useEffect(() => {
    load();
  }, []);

  const run = async (kind: "run" | "emails") => {
    setBusy(kind);
    setConfirm(null);
    setResult(null);
    try {
      const r = await apiFetch<{ summary: Summary; stats: Stats }>(
        kind === "run" ? "/admin/billing/notices/run" : "/admin/billing/notices/resend-emails",
        { method: "POST", body: JSON.stringify({}) },
      );
      setStats(r.stats);
      const failed = r.summary.correos.fallidos + r.summary.whatsapp.fallidos;
      setResult({ ok: r.summary.ran && !failed, text: summaryText(r.summary, kind) });
    } catch (e) {
      setResult({ ok: false, text: friendlyErrorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Send className="h-4 w-4 text-fuchsia-300" /> Avisos de perfil apagado
      </h2>
      <p className="mt-1 text-xs text-white/45">
        A cada perfil apagado por falta de pago le llegan 3 avisos: al apagarse (correo, WhatsApp y app), 3 días después
        (correo y app) y 7 días después (correo, WhatsApp y app). Salen solos cada hora; con el botón salen ahora.
      </p>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {stats && (
        <>
          {!stats.activo && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-200">
              Ahora no se envían avisos ({stats.motivo}).
            </p>
          )}
          {!stats.correoConfigurado && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-200">
              El correo no está configurado en el servidor (falta RESEND_API_KEY): sólo salen WhatsApp y avisos en la app.
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Box label="Perfiles apagados ahora" value={stats.perfilesApagados} />
            <Box label="1.er aviso enviado" value={stats.avisos.primero} />
            <Box label="2.º aviso enviado" value={stats.avisos.segundo} />
            <Box label="3.er aviso (último)" value={stats.avisos.tercero} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Box
              icon={<Mail className="h-3.5 w-3.5" />}
              label="Correos (60 días)"
              value={stats.correos.ok}
              extra={stats.correos.fallidos ? `${stats.correos.fallidos} fallidos` : undefined}
            />
            <Box
              icon={<MessageCircle className="h-3.5 w-3.5" />}
              label="WhatsApp (60 días)"
              value={stats.whatsapp.ok}
              extra={stats.whatsapp.fallidos ? `${stats.whatsapp.fallidos} fallidos` : undefined}
            />
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={!stats.activo || busy !== null}
              onClick={() => setConfirm("run")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-40"
            >
              {busy === "run" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar avisos pendientes ahora
            </button>
            <button
              type="button"
              disabled={!stats.activo || !stats.correoConfigurado || !stats.correosPendientes || busy !== null}
              onClick={() => setConfirm("emails")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/[0.08] disabled:opacity-40"
            >
              {busy === "emails" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Reenviar correos que no salieron ({stats.correosPendientes})
            </button>
          </div>

          {confirm && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4 text-sm">
              <p className="font-semibold text-amber-200">
                {confirm === "run" ? "¿Enviar los avisos pendientes ahora?" : `¿Reenviar ${stats.correosPendientes} correos?`}
              </p>
              <p className="mt-1 text-white/65">
                {confirm === "run"
                  ? "A cada perfil apagado le llega el aviso que le toca (correo, WhatsApp y app). A quien ya recibió el suyo no se le repite."
                  : "Les llega por correo el último aviso que recibieron por WhatsApp o en la app, a quienes siguen con el perfil apagado."}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => run(confirm)}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black"
                >
                  Sí, enviar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {result && (
            <p className={`mt-3 text-sm ${result.ok ? "text-emerald-300" : "text-amber-300"}`}>{result.text}</p>
          )}
        </>
      )}

      {!stats && !error && <div className="mt-4 h-24 animate-pulse rounded-xl bg-white/[0.04]" />}
    </section>
  );
}

function Box({ label, value, extra, icon }: { label: string; value: number; extra?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="flex items-center gap-1.5 text-xl font-bold">
        {icon}
        {value}
      </p>
      <p className="text-[11px] text-white/45">{label}</p>
      {extra && <p className="text-[11px] text-red-300">{extra}</p>}
    </div>
  );
}
