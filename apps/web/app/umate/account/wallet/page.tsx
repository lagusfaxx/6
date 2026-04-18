"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import { apiFetch } from "../../../../lib/api";

type LedgerEntry = {
  id: string;
  type: string;
  grossAmount: number;
  platformFee: number;
  ivaAmount: number;
  creatorPayout: number;
  createdAt: string;
  description: string | null;
};
type Stats = {
  pendingBalance: number;
  availableBalance: number;
  totalEarned: number;
  ledger: LedgerEntry[];
  totals: { gross: number; iva: number; commission: number; net: number };
};
type Withdrawal = { id: string; amount: number; status: string; bankName: string; createdAt: string };

export default function WalletPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<Stats>("/umate/creator/stats").catch(() => null),
      apiFetch<{ withdrawals: Withdrawal[] }>("/umate/creator/withdrawals").catch(() => null),
    ]).then(([s, w]) => {
      setStats(s);
      setWithdrawals(w?.withdrawals || []);
      setLoading(false);
    });
  }, []);

  const totals = useMemo(() => {
    if (!stats?.totals) return { gross: 0, commission: 0, iva: 0, income: 0 };
    return {
      gross: stats.totals.gross,
      commission: stats.totals.commission,
      iva: stats.totals.iva,
      income: stats.totals.net,
    };
  }, [stats?.totals]);

  const handleWithdraw = async () => {
    if (!stats?.availableBalance) return;
    setWithdrawing(true);
    try {
      const res = await apiFetch<{ withdrawn: number }>("/umate/creator/withdraw", { method: "POST" });
      if (res?.withdrawn && stats) {
        setStats({
          ...stats,
          availableBalance: Math.max(0, stats.availableBalance - res.withdrawn),
          ledger: [
            { id: `wd-${Date.now()}`, type: "WITHDRAWAL", grossAmount: 0, platformFee: 0, ivaAmount: 0, creatorPayout: -res.withdrawn, createdAt: new Date().toISOString(), description: "Retiro solicitado" },
            ...stats.ledger,
          ],
        });
        const w = await apiFetch<{ withdrawals: Withdrawal[] }>("/umate/creator/withdrawals").catch(() => null);
        if (w?.withdrawals) setWithdrawals(w.withdrawals);
      }
    } catch { /* silently fail - balance unchanged */ }
    setWithdrawing(false);
  };

  if (loading) return <div className="flex flex-col items-center justify-center py-24 gap-3"><Loader2 className="h-8 w-8 animate-spin text-[#00aff0]/60" /></div>;
  if (!stats) return <div className="py-24 text-center text-white/40">No eres creadora aún.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Ingresos</h1>
        <p className="mt-1 text-sm text-white/30">Balance, retiros y movimientos.</p>
      </div>

      {/* Hero: Available balance + withdraw action */}
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.08] to-emerald-500/[0.01] p-5 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400/80">Disponible para retirar</p>
        <p className="mt-2 text-4xl font-extrabold tracking-tight text-emerald-400 sm:text-5xl">
          ${stats.availableBalance.toLocaleString("es-CL")}
        </p>
        <p className="mt-1 text-xs text-white/40">Neto, ya descontado IVA y comisión.</p>
        <button
          onClick={handleWithdraw}
          disabled={withdrawing || stats.availableBalance <= 0}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500/90 disabled:opacity-40 sm:w-auto"
        >
          {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowDown className="h-4 w-4" /> Solicitar retiro</>}
        </button>
      </div>

      {/* Secondary stats */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-amber-400/80" />
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">Retenido</p>
          </div>
          <p className="mt-1 text-xl font-bold text-white">${stats.pendingBalance.toLocaleString("es-CL")}</p>
        </div>
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">Total histórico</p>
          <p className="mt-1 text-xl font-bold text-white">${stats.totalEarned.toLocaleString("es-CL")}</p>
        </div>
      </div>

      {/* Movimientos */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white/50">Movimientos</h2>
          <span className="text-[11px] text-white/35">{stats.ledger.length} registros</span>
        </div>
        {stats.ledger.length === 0 ? (
          <p className="rounded-xl border border-white/[0.04] bg-white/[0.015] py-8 text-center text-sm text-white/40">Sin movimientos aún.</p>
        ) : (
          <div className="divide-y divide-white/[0.04] overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.015]">
            {stats.ledger.map((entry) => (
              <div key={entry.id} className="px-4 py-3 transition hover:bg-white/[0.02]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {entry.creatorPayout >= 0 ? (
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 shrink-0 text-red-400" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white/75">{entry.description || entry.type}</p>
                      <p className="text-[11px] text-white/40">{new Date(entry.createdAt).toLocaleDateString("es-CL")}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 text-sm font-semibold ${entry.creatorPayout >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {entry.creatorPayout >= 0 ? "+" : "-"}${Math.abs(entry.creatorPayout).toLocaleString("es-CL")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Historial de retiros */}
      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-white/50">Historial de retiros</h2>
        {withdrawals.length === 0 ? (
          <p className="rounded-xl border border-white/[0.04] bg-white/[0.015] py-6 text-center text-sm text-white/40">Sin retiros aún.</p>
        ) : (
          <div className="divide-y divide-white/[0.04] overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.015]">
            {withdrawals.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  {w.status === "APPROVED" && <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />}
                  {w.status === "PENDING" && <Clock className="h-4 w-4 shrink-0 text-amber-400" />}
                  {w.status === "REJECTED" && <XCircle className="h-4 w-4 shrink-0 text-red-400" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white/75">${w.amount.toLocaleString("es-CL")}</p>
                    <p className="truncate text-[11px] text-white/40">{w.bankName}</p>
                  </div>
                </div>
                <span className="shrink-0 text-[11px] text-white/40">{new Date(w.createdAt).toLocaleDateString("es-CL")}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Desglose total */}
      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-white/50">Desglose total</h2>
        <div className="space-y-1.5 rounded-xl border border-white/[0.05] bg-white/[0.015] p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Ingreso bruto</span>
            <span className="font-semibold text-white">${totals.gross.toLocaleString("es-CL")}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">IVA (19%)</span>
            <span className="font-semibold text-red-400">-${totals.iva.toLocaleString("es-CL")}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Comisión plataforma</span>
            <span className="font-semibold text-red-400">-${totals.commission.toLocaleString("es-CL")}</span>
          </div>
          <div className="my-1 h-px bg-white/[0.06]" />
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-emerald-400/80">Neto ganado</span>
            <span className="font-bold text-emerald-400">${totals.income.toLocaleString("es-CL")}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
