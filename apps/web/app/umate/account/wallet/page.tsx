"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle,
  Clock,
  DollarSign,
  Loader2,
  Receipt,
  TrendingUp,
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
    return (stats?.ledger || []).reduce(
      (acc, entry) => {
        if (entry.grossAmount > 0) acc.gross += entry.grossAmount;
        acc.commission += entry.platformFee || 0;
        acc.iva += entry.ivaAmount || 0;
        if (entry.creatorPayout >= 0) acc.income += entry.creatorPayout;
        return acc;
      },
      { gross: 0, commission: 0, iva: 0, income: 0 },
    );
  }, [stats?.ledger]);

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
            { id: `wd-${Date.now()}`, type: "WITHDRAWAL", creatorPayout: -res.withdrawn, createdAt: new Date().toISOString(), description: "Retiro solicitado" },
            ...stats.ledger,
          ],
        });
        // Reload withdrawals
        const w = await apiFetch<{ withdrawals: Withdrawal[] }>("/umate/creator/withdrawals").catch(() => null);
        if (w?.withdrawals) setWithdrawals(w.withdrawals);
      }
    } catch { /* silently fail - balance unchanged */ }
    setWithdrawing(false);
  };

  if (loading) return <div className="flex flex-col items-center justify-center py-24 gap-3"><Loader2 className="h-8 w-8 animate-spin text-[#00aff0]/60" /></div>;
  if (!stats) return <div className="py-24 text-center text-white/40">No eres creadora aún.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Ingresos</h1>
        <p className="mt-1 text-sm text-white/30">Balance, retiros y movimientos.</p>
      </div>

      {/* Balance cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4">
          <DollarSign className="h-4 w-4 text-emerald-400" />
          <p className="mt-2 text-2xl font-extrabold text-emerald-400">${stats.availableBalance.toLocaleString("es-CL")}</p>
          <p className="text-xs text-white/45">Disponible</p>
        </div>
        <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-4">
          <Clock className="h-4 w-4 text-amber-400" />
          <p className="mt-2 text-2xl font-extrabold text-amber-400">${stats.pendingBalance.toLocaleString("es-CL")}</p>
          <p className="text-xs text-white/45">Retenido</p>
        </div>
        <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-4">
          <TrendingUp className="h-4 w-4 text-white/40" />
          <p className="mt-2 text-2xl font-extrabold text-white">${stats.totalEarned.toLocaleString("es-CL")}</p>
          <p className="text-xs text-white/45">Total histórico</p>
        </div>
        <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-4">
          <Receipt className="h-4 w-4 text-white/40" />
          <p className="mt-2 text-2xl font-extrabold text-white">{withdrawals.length}</p>
          <p className="text-xs text-white/45">Retiros</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Ledger */}
        <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">Movimientos</h2>
            <span className="text-[11px] text-white/40">{stats.ledger.length} registros</span>
          </div>

          {stats.ledger.length === 0 && (
            <p className="mt-6 text-center text-sm text-white/45">Sin movimientos aún.</p>
          )}

          <div className="mt-4 space-y-1">
            {stats.ledger.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-lg border border-white/[0.03] p-3 transition hover:bg-white/[0.015]">
                <div className="flex items-center gap-3">
                  {entry.creatorPayout >= 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-red-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-white/60">{entry.description || entry.type}</p>
                    <p className="text-[11px] text-white/45">{new Date(entry.createdAt).toLocaleDateString("es-CL")}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${entry.creatorPayout >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {entry.creatorPayout >= 0 ? "+" : "-"}${Math.abs(entry.creatorPayout).toLocaleString("es-CL")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400/70">Solicitar retiro</h2>
            <p className="mt-2 text-2xl font-extrabold text-emerald-400">${stats.availableBalance.toLocaleString("es-CL")}</p>
            <button
              onClick={handleWithdraw}
              disabled={withdrawing || stats.availableBalance <= 0}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500/90 disabled:opacity-40"
            >
              {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowDown className="h-4 w-4" /> Retirar</>}
            </button>
          </div>

          <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">Resumen</h2>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-white/[0.03] p-2.5 text-sm">
                <span className="text-white/50">Bruto</span>
                <span className="font-semibold text-white">${totals.gross.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-red-500/[0.06] p-2.5 text-sm">
                <span className="text-red-400/70">Comisión</span>
                <span className="font-semibold text-red-400">-${totals.commission.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-red-500/[0.06] p-2.5 text-sm">
                <span className="text-red-400/70">IVA</span>
                <span className="font-semibold text-red-400">-${totals.iva.toLocaleString("es-CL")}</span>
              </div>
              <div className="h-px bg-white/[0.06]" />
              <div className="flex items-center justify-between rounded-lg bg-emerald-500/[0.06] p-2.5 text-sm">
                <span className="text-emerald-400/70">Neto recibido</span>
                <span className="font-semibold text-emerald-400">${totals.income.toLocaleString("es-CL")}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">Historial de retiros</h2>
            {withdrawals.length === 0 && <p className="mt-3 text-xs text-white/45">Sin retiros aún.</p>}
            <div className="mt-3 space-y-1.5">
              {withdrawals.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-lg border border-white/[0.03] p-2.5">
                  <div className="flex items-center gap-2">
                    {w.status === "APPROVED" && <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />}
                    {w.status === "PENDING" && <Clock className="h-3.5 w-3.5 text-amber-400" />}
                    {w.status === "REJECTED" && <XCircle className="h-3.5 w-3.5 text-red-400" />}
                    <div>
                      <p className="text-sm font-medium text-white/60">${w.amount.toLocaleString("es-CL")}</p>
                      <p className="text-[11px] text-white/40">{w.bankName}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-white/40">{new Date(w.createdAt).toLocaleDateString("es-CL")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
