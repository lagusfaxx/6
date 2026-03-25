"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, CheckCircle, Clock, Loader2, Receipt, Wallet, XCircle } from "lucide-react";
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

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" /></div>;
  if (!stats) return <div className="py-20 text-center text-slate-500">No eres creadora aún.</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <header className="rounded-3xl border border-emerald-200 bg-gradient-to-r from-white via-emerald-50 to-teal-50 p-6 shadow-sm">
        <h1 className="text-3xl font-black text-slate-900">Finanzas e ingresos</h1>
        <p className="mt-1 text-sm text-slate-600">Controla saldos, retiros y cada movimiento de tu negocio.</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-semibold text-emerald-700">Disponible</p><p className="mt-1 text-2xl font-black text-emerald-800">${stats.availableBalance.toLocaleString("es-CL")}</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-700">Retenido</p><p className="mt-1 text-2xl font-black text-amber-800">${stats.pendingBalance.toLocaleString("es-CL")}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">Total histórico</p><p className="mt-1 text-2xl font-black text-slate-900">${stats.totalEarned.toLocaleString("es-CL")}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">Retiros</p><p className="mt-1 text-2xl font-black text-slate-900">{withdrawals.length}</p></div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Movimientos</p>
            <span className="text-xs text-slate-500">{stats.ledger.length} registros</span>
          </div>
          <div className="mt-4 space-y-2">
            {stats.ledger.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-700">{entry.description || entry.type}</p>
                  <p className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleDateString("es-CL")}</p>
                </div>
                <span className={entry.creatorPayout >= 0 ? "font-bold text-emerald-700" : "font-bold text-red-600"}>
                  {entry.creatorPayout >= 0 ? "+" : "-"}${Math.abs(entry.creatorPayout).toLocaleString("es-CL")}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Acción principal</p>
            <button onClick={handleWithdraw} disabled={withdrawing || stats.availableBalance <= 0} className="mt-3 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50">
              {withdrawing ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : <span className="inline-flex items-center gap-2"><ArrowDown className="h-4 w-4" />Solicitar retiro</span>}
            </button>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">Ingresos</p><p className="font-bold text-slate-900">${totals.income.toLocaleString("es-CL")}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">Ajustes</p><p className="font-bold text-slate-900">${totals.expenses.toLocaleString("es-CL")}</p></div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Receipt className="h-3.5 w-3.5" /> Historial de retiros</p>
            <div className="space-y-2">
              {withdrawals.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    {w.status === "APPROVED" && <CheckCircle className="h-4 w-4 text-emerald-600" />}
                    {w.status === "PENDING" && <Clock className="h-4 w-4 text-amber-600" />}
                    {w.status === "REJECTED" && <XCircle className="h-4 w-4 text-red-600" />}
                    <span className="text-slate-700">${w.amount.toLocaleString("es-CL")} · {w.bankName}</span>
                  </div>
                  <span className="text-xs text-slate-500">{new Date(w.createdAt).toLocaleDateString("es-CL")}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
