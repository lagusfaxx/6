"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch } from "../../../lib/api";
import {
  ArrowLeft,
  Loader2,
  Send,
  Mail,
  CheckCircle,
  AlertTriangle,
  Users,
  Sparkles,
  RefreshCw,
} from "lucide-react";

type CampaignStatus = {
  totalEligible: number;
  totalSent: number;
  remaining: number;
};

type SendResult = {
  ok: boolean;
  mode: "test" | "campaign";
  sentTo?: string;
  batchFetched?: number;
  sent?: number;
  errors?: number;
  alreadySent?: number;
  remainingInBatch?: number;
};

export default function UmatePromoPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const isAdmin = useMemo(
    () => (user?.role ?? "").toUpperCase() === "ADMIN",
    [user?.role],
  );

  const [status, setStatus] = useState<CampaignStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [batchSize, setBatchSize] = useState(50);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await apiFetch<CampaignStatus>(
        "/admin/umate/promotional-campaign/status",
      );
      setStatus(res);
    } catch (err: any) {
      setError(err?.message || "Error al cargar el estado");
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadStatus();
  }, [isAdmin]);

  const sendTest = async () => {
    if (!testEmail.trim()) return;
    setSending(true);
    setError(null);
    setLastResult(null);
    try {
      const res = await apiFetch<SendResult>(
        "/admin/umate/promotional-campaign/send",
        {
          method: "POST",
          body: JSON.stringify({ testEmail: testEmail.trim() }),
        },
      );
      setLastResult(res);
    } catch (err: any) {
      setError(err?.message || "Error al enviar");
    } finally {
      setSending(false);
    }
  };

  const sendBatch = async () => {
    const size = Math.max(1, Math.min(200, Number(batchSize) || 50));
    if (
      !confirm(
        `¿Enviar lote de hasta ${size} correos promocionales de Umate? Esta accion no se puede deshacer.`,
      )
    )
      return;
    setSending(true);
    setError(null);
    setLastResult(null);
    try {
      const res = await apiFetch<SendResult>(
        "/admin/umate/promotional-campaign/send",
        {
          method: "POST",
          body: JSON.stringify({ batchSize: size }),
        },
      );
      setLastResult(res);
      await loadStatus();
    } catch (err: any) {
      setError(err?.message || "Error al enviar");
    } finally {
      setSending(false);
    }
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">
        Cargando...
      </div>
    );
  if (!user || !isAdmin)
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">
        Acceso restringido.
      </div>
    );

  const progressPct =
    status && status.totalEligible > 0
      ? Math.min(
          100,
          Math.round((status.totalSent / status.totalEligible) * 100),
        )
      : 0;

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/[0.06] bg-[#0a0b14]/90 backdrop-blur-xl px-4 sm:px-6 py-3">
        <Link
          href="/admin"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-white/50" />
        </Link>
        <div>
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-fuchsia-400" />
            Promocion Umate
          </h1>
          <p className="text-[11px] text-white/30">
            Campana de invitacion a profesionales registradas
          </p>
        </div>
      </header>

      <div className="px-4 sm:px-6 py-5 max-w-3xl mx-auto space-y-5">
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-300 flex-1">{error}</p>
          </div>
        )}

        {lastResult && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3">
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-300 flex-1">
              {lastResult.mode === "test" ? (
                <>
                  Correo de prueba enviado a{" "}
                  <strong>{lastResult.sentTo}</strong>.
                </>
              ) : (
                <>
                  Lote procesado:{" "}
                  <strong>{lastResult.sent ?? 0}</strong> enviados
                  {typeof lastResult.errors === "number" &&
                    lastResult.errors > 0 && (
                      <>
                        {", "}
                        <span className="text-red-300">
                          {lastResult.errors} fallidos
                        </span>
                      </>
                    )}
                  {typeof lastResult.alreadySent === "number" &&
                    lastResult.alreadySent > 0 && (
                      <>
                        {", "}
                        <span className="text-white/50">
                          {lastResult.alreadySent} ya recibidos
                        </span>
                      </>
                    )}
                  .
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Campaign Status ── */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-fuchsia-400/60" />
              <h2 className="text-sm font-semibold">Estado de la campana</h2>
            </div>
            <button
              onClick={loadStatus}
              disabled={statusLoading}
              className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors disabled:opacity-30"
            >
              {statusLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Refrescar
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard
              label="Elegibles"
              value={status?.totalEligible ?? 0}
              accent="white"
            />
            <StatCard
              label="Ya enviados"
              value={status?.totalSent ?? 0}
              accent="emerald"
            />
            <StatCard
              label="Pendientes"
              value={status?.remaining ?? 0}
              accent="amber"
            />
          </div>

          <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[11px] text-white/30 mt-2">
            {progressPct}% cubierto
          </p>
        </div>

        {/* ── Test send ── */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-2">
            Enviar correo de prueba
          </label>
          <p className="text-[12px] text-white/40 mb-3">
            Recibe una copia del correo para revisar el diseno antes del blast.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="tu@correo.cl"
              className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-fuchsia-500/30 transition-colors"
            />
            <button
              onClick={sendTest}
              disabled={sending || !testEmail.trim()}
              className="flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Prueba
            </button>
          </div>
        </div>

        {/* ── Batch send ── */}
        <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-5">
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-fuchsia-300/70 mb-2">
            Enviar lote real
          </label>
          <p className="text-[12px] text-white/50 mb-4">
            Envia a profesionales activas que aun no son creadoras Umate ACTIVE
            y que todavia no recibieron este correo. Repetir hasta que
            Pendientes = 0.
          </p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-[10px] text-white/40 mb-1">
                Tamano del lote (1-200)
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-500/30 transition-colors"
              />
            </div>
            <button
              onClick={sendBatch}
              disabled={sending || (status?.remaining ?? 0) === 0}
              className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:from-fuchsia-500 hover:to-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar lote
            </button>
          </div>
        </div>

        <div className="text-[11px] text-white/30 leading-relaxed">
          El correo invita a sumarse a Umate. Quienes completen onboarding y
          publiquen su primer post reciben automaticamente Gold por 30 dias y
          mayor visibilidad en la home.
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "white" | "emerald" | "amber";
}) {
  const colors = {
    white: "text-white",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
  };
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <p className={`text-2xl font-bold ${colors[accent]}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-[11px] text-white/40 mt-0.5">{label}</p>
    </div>
  );
}
