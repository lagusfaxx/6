"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { canOpenAdmin } from "../../../lib/adminAccess";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch } from "../../../lib/api";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  LogOut,
  MessageCircle,
  Phone,
  QrCode,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";

type WaStatus = {
  configured: boolean;
  provider: "baileys" | "cloud" | null;
  baileys: {
    enabled: boolean;
    status: "off" | "starting" | "waiting_qr" | "connected" | "logged_out" | "error";
    connectedAs: string | null;
    hasPendingQr: boolean;
    lastError: string | null;
    sessionDir?: string;
  };
  sms?: { configured: boolean; mode: "primary" | "fallback" | null };
};

type ChannelStats = { last24h: number; last7d: number; last30d: number; failed30d: number };
type WaStats = {
  sms: ChannelStats & { balance: number | null };
  whatsapp: ChannelStats;
  byType: { channel: string; type: string; count: number }[];
  recent: {
    id: string;
    userName: string | null;
    channel: "SMS" | "WHATSAPP";
    type: string;
    ok: boolean;
    error: string | null;
    createdAt: string;
  }[];
};

const TYPE_LABELS: Record<string, string> = {
  MESSAGE_RECEIVED: "Mensaje nuevo",
  SERVICE_REQUEST_NEW: "Solicitud",
  VIDEOCALL_BOOKED: "Videollamada",
  BOOKING_UPDATE: "Reserva",
  MARKET_NEW_ORDER: "Venta marketplace",
  SERVICE_PUBLISHED: "Solicitud de servicio",
  TEST: "Prueba",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function humanError(error?: string): string {
  if (!error) return "error desconocido";
  if (error === "NUMERO_SIN_WHATSAPP") return "ese número no tiene WhatsApp (revisa que esté bien escrito)";
  if (error === "INVALID_PHONE") return "número inválido — usa formato +56 9 XXXX XXXX";
  if (error.startsWith("NOT_CONNECTED")) return "el bot no está conectado — escanea el QR primero";
  if (error.startsWith("TIMEOUT")) return error;
  if (error === "Failed to fetch") return "se perdió la conexión con el servidor (¿se está reiniciando?). Espera unos segundos y reintenta";
  return error;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  connected: { label: "Conectado", color: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" },
  waiting_qr: { label: "Esperando QR", color: "text-amber-300 border-amber-500/30 bg-amber-500/10" },
  starting: { label: "Conectando...", color: "text-sky-300 border-sky-500/30 bg-sky-500/10" },
  logged_out: { label: "Desvinculado", color: "text-rose-300 border-rose-500/30 bg-rose-500/10" },
  error: { label: "Error", color: "text-rose-300 border-rose-500/30 bg-rose-500/10" },
  off: { label: "Apagado", color: "text-white/50 border-white/10 bg-white/5" },
};

export default function AdminWhatsAppPage() {
  const { me, loading } = useMe();
  const isAdmin = canOpenAdmin(me?.user);

  const [status, setStatus] = useState<WaStatus | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string; channel?: "sms" } | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [stats, setStats] = useState<WaStats | null>(null);

  const loadStats = useCallback(async () => {
    const s = await apiFetch<WaStats>("/notifications/whatsapp/stats").catch(() => null);
    setStats(s ?? null);
  }, []);

  const loadStatus = useCallback(async () => {
    setRefreshing(true);
    loadStats();
    try {
      const s = await apiFetch<WaStatus>("/notifications/whatsapp/status");
      setStatus(s);
      if (s?.baileys?.hasPendingQr) {
        const q = await apiFetch<{ dataUrl: string }>("/notifications/whatsapp/qr?format=json").catch(() => null);
        setQr(q?.dataUrl ?? null);
      } else {
        setQr(null);
      }
    } catch {
      setStatus(null);
    } finally {
      setRefreshing(false);
    }
  }, [loadStats]);

  useEffect(() => {
    if (!isAdmin) return;
    loadStatus();
  }, [isAdmin, loadStatus]);

  /* Mientras espera QR o está conectando, refrescar solo cada 5s para
     detectar el escaneo al instante */
  useEffect(() => {
    const st = status?.baileys?.status;
    const shouldPoll = st === "waiting_qr" || st === "starting";
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (shouldPoll && isAdmin) {
      pollRef.current = setInterval(loadStatus, 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status?.baileys?.status, isAdmin, loadStatus]);

  const sendTest = async (channel?: "sms") => {
    setTestSending(true);
    setTestResult(null);
    try {
      const r = await apiFetch<{ ok: boolean; error?: string }>("/notifications/whatsapp/test", {
        method: "POST",
        body: JSON.stringify({ ...(testPhone.trim() ? { phone: testPhone.trim() } : {}), ...(channel ? { channel } : {}) }),
      });
      setTestResult({ ...(r ?? { ok: false, error: "SIN_RESPUESTA" }), channel });
    } catch (err: any) {
      setTestResult({ ok: false, error: err?.message || "Error al enviar", channel });
    } finally {
      setTestSending(false);
      loadStats();
    }
  };

  const doLogout = async () => {
    if (!window.confirm("¿Desvincular el número actual? Tendrás que escanear el QR de nuevo (sirve para cambiar de chip).")) return;
    setLoggingOut(true);
    try {
      await apiFetch("/notifications/whatsapp/logout", { method: "POST", body: JSON.stringify({}) });
      await loadStatus();
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center text-white/60">
        Acceso restringido.
      </div>
    );
  }

  const b = status?.baileys;
  // Con la Cloud API no hay conexión que mantener: el estado de Baileys no aplica.
  const st =
    status?.provider === "cloud"
      ? { label: "Activo", color: STATUS_LABELS.connected.color }
      : STATUS_LABELS[b?.status || "off"] || STATUS_LABELS.off;

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-400" /> Bot de WhatsApp
          </h1>
          <p className="text-xs text-white/40">Avisos automáticos a las profesionales</p>
        </div>
      </div>

      {/* ── Estado ── */}
      <section className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Estado</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${st.color}`}>
                {b?.status === "connected" || status?.provider === "cloud" ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                {st.label}
              </span>
              <span className="text-xs text-white/40">
                Proveedor: <strong className="text-white/70">{status?.provider === "baileys" ? "Baileys (gratis)" : status?.provider === "cloud" ? "Meta Cloud API" : "no configurado"}</strong>
              </span>
              <span className="text-xs text-white/40">
                SMS:{" "}
                <strong className="text-white/70">
                  {status?.sms?.configured ? (status.sms.mode === "primary" ? "principal" : "respaldo") : "no configurado"}
                </strong>
              </span>
              {b?.connectedAs && (
                <span className="text-xs text-white/40">
                  Número: <strong className="text-white/70">+{b.connectedAs}</strong>
                </span>
              )}
            </div>
            {b?.lastError && b.status !== "connected" && (
              <p className="mt-2 text-[11px] text-rose-300/80">Último error: {b.lastError}</p>
            )}
          </div>
          <button
            type="button"
            onClick={loadStatus}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10"
            title="Refrescar"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {!status?.configured && (
          <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] p-3 text-xs text-amber-200/90">
            El bot está apagado. Configura <code className="text-amber-100">WHATSAPP_PROVIDER=baileys</code> en el servidor del API y reinícialo. Guía completa en <code className="text-amber-100">docs/WHATSAPP_BOT.md</code>.
          </p>
        )}

        {status?.provider === "baileys" && b?.sessionDir && (
          <p className="mt-3 rounded-xl border border-sky-500/15 bg-sky-500/[0.05] p-3 text-[11px] leading-relaxed text-sky-200/80">
            La sesión se guarda en <code className="text-sky-100">{b.sessionDir}</code>. Si esa carpeta no está en un
            <strong className="text-sky-100"> volumen persistente</strong>, cada deploy/reinicio del API borra la sesión y
            habrá que escanear el QR de nuevo. Solución: monta un volumen (ej. <code className="text-sky-100">/data</code>) y
            configura <code className="text-sky-100">WHATSAPP_SESSION_DIR=/data/wa-session</code>.
          </p>
        )}
      </section>

      {/* ── QR de vinculación ── */}
      {qr && (
        <section className="mb-5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5 text-center">
          <p className="mb-1 flex items-center justify-center gap-2 text-sm font-bold">
            <QrCode className="h-4 w-4 text-amber-300" /> Vincular el número del bot
          </p>
          <p className="mx-auto mb-4 max-w-sm text-xs text-white/45">
            En el teléfono del chip del bot: WhatsApp → Ajustes → <strong className="text-white/70">Dispositivos vinculados</strong> → Vincular dispositivo → escanea este código.
          </p>
          <img src={qr} alt="QR de vinculación de WhatsApp" className="mx-auto h-64 w-64 rounded-xl bg-white p-2" />
          <p className="mt-3 text-[11px] text-white/30">El código se renueva solo; esta página se actualiza cada 5 segundos.</p>
        </section>
      )}

      {/* ── Prueba ── */}
      <section className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Enviar prueba</p>
        <p className="mt-1 text-xs text-white/45">
          Escribe tu número y te llega el mismo aviso que reciben las profesionales. Si lo dejas vacío, usa el teléfono de tu cuenta admin.
        </p>
        <div className="mt-3 flex gap-2">
          <label className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <Phone className="h-4 w-4 shrink-0 text-white/30" />
            <input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+56 9 1234 5678"
              className="w-full bg-transparent text-sm outline-none placeholder:text-white/25"
            />
          </label>
          <button
            type="button"
            onClick={() => sendTest()}
            disabled={testSending || !status?.configured || (status?.provider === "baileys" && b?.status !== "connected")}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {testSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar prueba
          </button>
          {status?.sms?.configured && (
            <button
              type="button"
              onClick={() => sendTest("sms")}
              disabled={testSending}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <MessageCircle className="h-4 w-4" />
              Probar SMS
            </button>
          )}
        </div>
        {testResult && (
          <p className={`mt-3 flex items-center gap-1.5 text-xs ${testResult.ok ? "text-emerald-300" : "text-rose-300"}`}>
            {testResult.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            {testResult.ok
              ? testResult.channel === "sms"
                ? "SMS enviado — revisa los mensajes de ese número."
                : "Enviado — revisa el WhatsApp de ese número."
              : `No se pudo enviar: ${humanError(testResult.error)}`}
          </p>
        )}
      </section>

      {/* ── Estadísticas ── */}
      {stats && (
        <section className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Avisos enviados</p>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "SMS hoy (24 h)", value: stats.sms.last24h },
              { label: "SMS 7 días", value: stats.sms.last7d },
              { label: "SMS 30 días", value: stats.sms.last30d },
              {
                label: "Saldo LabsMobile",
                value: stats.sms.balance === null ? "—" : stats.sms.balance.toLocaleString("es-CL"),
                hint: "créditos",
              },
            ].map((t) => (
              <div key={t.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[11px] text-white/45">{t.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-white">{t.value}</p>
                {"hint" in t && t.hint ? <p className="text-[10px] text-white/30">{t.hint}</p> : null}
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/45">
            <span>
              WhatsApp 30 días: <strong className="tabular-nums text-white/75">{stats.whatsapp.last30d}</strong>
            </span>
            {stats.sms.failed30d > 0 && (
              <span className="inline-flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5 text-rose-300" />
                SMS fallidos 30 días: <strong className="tabular-nums text-white/75">{stats.sms.failed30d}</strong>
              </span>
            )}
            {stats.whatsapp.failed30d > 0 && (
              <span className="inline-flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5 text-amber-300" />
                WhatsApp fallidos 30 días: <strong className="tabular-nums text-white/75">{stats.whatsapp.failed30d}</strong>
                <span className="text-white/30">(salen por SMS de respaldo)</span>
              </span>
            )}
          </div>

          {stats.byType.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] text-white/40">Por tipo (enviados, 30 días)</p>
              <div className="flex flex-wrap gap-1.5">
                {stats.byType.map((r) => (
                  <span
                    key={`${r.channel}-${r.type}`}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60"
                  >
                    {r.channel === "SMS" ? "SMS" : "WhatsApp"} · {TYPE_LABELS[r.type] || r.type}:{" "}
                    <strong className="tabular-nums text-white/85">{r.count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <p className="mb-1.5 text-[11px] text-white/40">Últimos envíos</p>
            {stats.recent.length === 0 ? (
              <p className="text-xs text-white/35">Todavía no se ha enviado ningún aviso.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#1a1024] text-[10px] uppercase tracking-wider text-white/35">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Fecha</th>
                      <th className="px-3 py-2 font-semibold">Canal</th>
                      <th className="px-3 py-2 font-semibold">Tipo</th>
                      <th className="px-3 py-2 font-semibold">Profesional</th>
                      <th className="px-3 py-2 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent.map((r) => (
                      <tr key={r.id} className="border-t border-white/5 text-white/70">
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-white/50">{formatWhen(r.createdAt)}</td>
                        <td className="px-3 py-2">{r.channel === "SMS" ? "SMS" : "WhatsApp"}</td>
                        <td className="px-3 py-2">{TYPE_LABELS[r.type] || r.type}</td>
                        <td className="max-w-[10rem] truncate px-3 py-2">{r.userName || "—"}</td>
                        <td className="px-3 py-2">
                          {r.ok ? (
                            <span className="inline-flex items-center gap-1 text-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Enviado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-300" title={r.error || ""}>
                              <XCircle className="h-3.5 w-3.5" /> Falló
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Desvincular ── */}
      {status?.provider === "baileys" && (b?.status === "connected" || b?.connectedAs) && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Cambiar de número</p>
          <p className="mt-1 text-xs text-white/45">Desvincula el chip actual para conectar otro (vuelve a aparecer el QR).</p>
          <button
            type="button"
            onClick={doLogout}
            disabled={loggingOut}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
          >
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Desvincular número
          </button>
        </section>
      )}
    </div>
  );
}
