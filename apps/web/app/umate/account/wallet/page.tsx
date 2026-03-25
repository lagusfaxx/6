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
  Wallet,
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

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" /></div>;
  if (!stats) return <div className="py-24 text-center text-slate-500">No eres creadora aún.</div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-200/30">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Ingresos</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">Balance, retiros y detalle de cada movimiento financiero.</p>
      </div>

      {/* Balance cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-700" />
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Disponible</p>
          </div>
          <p className="mt-2 text-3xl font-black text-emerald-800">${stats.availableBalance.toLocaleString("es-CL")}</p>
          <p className="mt-1 text-xs text-emerald-600">Listo para retirar</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-700" />
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Retenido</p>
          </div>
          <p className="mt-2 text-3xl font-black text-amber-800">${stats.pendingBalance.toLocaleString("es-CL")}</p>
          <p className="mt-1 text-xs text-amber-600">En período de retención</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-slate-600" />
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Total histórico</p>
          </div>
          <p className="mt-2 text-3xl font-black text-slate-900">${stats.totalEarned.toLocaleString("es-CL")}</p>
          <p className="mt-1 text-xs text-slate-500">Acumulado total</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-slate-600" />
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Retiros</p>
          </div>
          <p className="mt-2 text-3xl font-black text-slate-900">{withdrawals.length}</p>
          <p className="mt-1 text-xs text-slate-500">Solicitudes realizadas</p>
        </div>
      </section>

      {/* Withdraw action + Summary */}
      <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Ledger */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Movimientos</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">{stats.ledger.length} registros</span>
          </div>

          {stats.ledger.length === 0 && (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
              Aún no hay movimientos registrados.
            </div>
          )}

          <div className="mt-4 space-y-1.5">
            {stats.ledger.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-lg border border-slate-50 p-3 transition hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${entry.creatorPayout >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                    {entry.creatorPayout >= 0 ? <ArrowUpRight className="h-4 w-4 text-emerald-600" /> : <ArrowDownRight className="h-4 w-4 text-red-600" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{entry.description || entry.type}</p>
                    <p className="text-[11px] text-slate-500">{new Date(entry.createdAt).toLocaleDateString("es-CL")}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${entry.creatorPayout >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {entry.creatorPayout >= 0 ? "+" : "-"}${Math.abs(entry.creatorPayout).toLocaleString("es-CL")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Withdraw */}
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-700">Solicitar retiro</h2>
            <p className="mt-2 text-2xl font-black text-emerald-800">${stats.availableBalance.toLocaleString("es-CL")}</p>
            <p className="text-xs text-emerald-600">Saldo disponible</p>
            <button
              onClick={handleWithdraw}
              disabled={withdrawing || stats.availableBalance <= 0}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200/50 transition hover:brightness-105 disabled:opacity-50"
            >
              {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowDown className="h-4 w-4" /> Retirar fondos</>}
            </button>
          </div>

          {/* Income vs expenses */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Resumen</h2>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-3">
                <span className="text-xs font-semibold text-emerald-700">Ingresos</span>
                <span className="font-bold text-emerald-800">${totals.income.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-red-50 p-3">
                <span className="text-xs font-semibold text-red-700">Ajustes/Comisiones</span>
                <span className="font-bold text-red-800">${totals.expenses.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <span className="text-xs font-semibold text-slate-600">Neto</span>
                <span className="font-bold text-slate-900">${(totals.income - totals.expenses).toLocaleString("es-CL")}</span>
              </div>
            </div>
          </div>

          {/* Withdrawal history */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              <Receipt className="h-3.5 w-3.5" /> Historial de retiros
            </h2>
            {withdrawals.length === 0 && (
              <p className="mt-3 text-xs text-slate-500">Sin retiros aún.</p>
            )}
            <div className="mt-3 space-y-1.5">
              {withdrawals.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-lg border border-slate-50 p-2.5">
                  <div className="flex items-center gap-2">
                    {w.status === "APPROVED" && <CheckCircle className="h-4 w-4 text-emerald-600" />}
                    {w.status === "PENDING" && <Clock className="h-4 w-4 text-amber-600" />}
                    {w.status === "REJECTED" && <XCircle className="h-4 w-4 text-red-600" />}
                    <div>
                      <p className="text-sm font-semibold text-slate-700">${w.amount.toLocaleString("es-CL")}</p>
                      <p className="text-[10px] text-slate-500">{w.bankName}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400">{new Date(w.createdAt).toLocaleDateString("es-CL")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
