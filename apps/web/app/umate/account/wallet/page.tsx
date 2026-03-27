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

type Stats = {
  pendingBalance: number;
  availableBalance: number;
  totalEarned: number;
  ledger: { id: string; type: string; creatorPayout: number; createdAt: string; description: string | null }[];
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
        if (entry.creatorPayout >= 0) acc.income += entry.creatorPayout;
        else acc.expenses += Math.abs(entry.creatorPayout);
        return acc;
      },
      { income: 0, expenses: 0 },
    );
  }, [stats?.ledger]);

  const handleWithdraw = async () => {
    if (!stats?.availableBalance) return;
    setWithdrawing(true);
    await apiFetch("/umate/creator/withdraw", { method: "POST" }).catch(() => {});
    setWithdrawing(false);
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-white/20" /></div>;
  if (!stats) return <div className="py-24 text-center text-white/30">No eres creadora aún.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Ingresos</h1>
        <p className="mt-1 text-sm text-white/30">Balance, retiros y movimientos.</p>
      </div>

      {/* Balance cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
          <DollarSign className="h-4 w-4 text-emerald-400" />
          <p className="mt-2 text-2xl font-extrabold text-emerald-400">${stats.availableBalance.toLocaleString("es-CL")}</p>
          <p className="text-xs text-white/20">Disponible</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
          <Clock className="h-4 w-4 text-amber-400" />
          <p className="mt-2 text-2xl font-extrabold text-amber-400">${stats.pendingBalance.toLocaleString("es-CL")}</p>
          <p className="text-xs text-white/20">Retenido</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <TrendingUp className="h-4 w-4 text-white/30" />
          <p className="mt-2 text-2xl font-extrabold text-white">${stats.totalEarned.toLocaleString("es-CL")}</p>
          <p className="text-xs text-white/20">Total histórico</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <Receipt className="h-4 w-4 text-white/30" />
          <p className="mt-2 text-2xl font-extrabold text-white">{withdrawals.length}</p>
          <p className="text-xs text-white/20">Retiros</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Ledger */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/25">Movimientos</h2>
            <span className="text-[11px] text-white/15">{stats.ledger.length} registros</span>
          </div>

          {stats.ledger.length === 0 && (
            <p className="mt-6 text-center text-sm text-white/20">Sin movimientos aún.</p>
          )}

          <div className="mt-4 space-y-1">
            {stats.ledger.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-lg border border-white/[0.03] p-3 transition hover:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  {entry.creatorPayout >= 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-red-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-white/60">{entry.description || entry.type}</p>
                    <p className="text-[10px] text-white/20">{new Date(entry.createdAt).toLocaleDateString("es-CL")}</p>
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
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
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

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/25">Resumen</h2>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-emerald-500/[0.06] p-2.5 text-sm">
                <span className="text-emerald-400/70">Ingresos</span>
                <span className="font-semibold text-emerald-400">${totals.income.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-red-500/[0.06] p-2.5 text-sm">
                <span className="text-red-400/70">Comisiones</span>
                <span className="font-semibold text-red-400">${totals.expenses.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/[0.03] p-2.5 text-sm">
                <span className="text-white/30">Neto</span>
                <span className="font-semibold text-white">${(totals.income - totals.expenses).toLocaleString("es-CL")}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/25">Historial de retiros</h2>
            {withdrawals.length === 0 && <p className="mt-3 text-xs text-white/20">Sin retiros aún.</p>}
            <div className="mt-3 space-y-1.5">
              {withdrawals.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-lg border border-white/[0.03] p-2.5">
                  <div className="flex items-center gap-2">
                    {w.status === "APPROVED" && <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />}
                    {w.status === "PENDING" && <Clock className="h-3.5 w-3.5 text-amber-400" />}
                    {w.status === "REJECTED" && <XCircle className="h-3.5 w-3.5 text-red-400" />}
                    <div>
                      <p className="text-sm font-medium text-white/60">${w.amount.toLocaleString("es-CL")}</p>
                      <p className="text-[10px] text-white/15">{w.bankName}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-white/15">{new Date(w.createdAt).toLocaleDateString("es-CL")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
