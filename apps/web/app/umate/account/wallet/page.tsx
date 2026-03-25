"use client";

import { useEffect, useState } from "react";
import { ArrowDown, Clock, CheckCircle, XCircle, Loader2, Wallet, TrendingUp } from "lucide-react";
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

  const handleWithdraw = async () => {
    if (!stats?.availableBalance) return;
    setWithdrawing(true);
    await apiFetch("/umate/creator/withdraw", { method: "POST" }).catch(() => {});
    setWithdrawing(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" /></div>;
  if (!stats) return <div className="py-20 text-center text-slate-500">No eres creadora aún.</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-6">
      <h1 className="text-2xl font-black text-slate-900">Ingresos</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center"><Wallet className="mx-auto h-4 w-4 text-emerald-700" /><p className="mt-2 text-2xl font-black text-emerald-800">${stats.availableBalance.toLocaleString("es-CL")}</p><p className="text-xs text-emerald-700">Disponible</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center"><Clock className="mx-auto h-4 w-4 text-amber-700" /><p className="mt-2 text-2xl font-black text-amber-800">${stats.pendingBalance.toLocaleString("es-CL")}</p><p className="text-xs text-amber-700">Retenido</p></div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 text-center"><TrendingUp className="mx-auto h-4 w-4 text-fuchsia-600" /><p className="mt-2 text-2xl font-black text-slate-900">${stats.totalEarned.toLocaleString("es-CL")}</p><p className="text-xs text-slate-500">Total ganado</p></div>
      </div>

      <button onClick={handleWithdraw} disabled={withdrawing || stats.availableBalance <= 0} className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50">
        {withdrawing ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : <span className="inline-flex items-center gap-2"><ArrowDown className="h-4 w-4" />Solicitar retiro</span>}
      </button>

      <div className="rounded-2xl border border-slate-100 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold text-slate-900">Movimientos</h2>
        <div className="space-y-2">
          {stats.ledger.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm">
              <div><p className="text-slate-700">{entry.description || entry.type}</p><p className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleDateString("es-CL")}</p></div>
              <span className={entry.creatorPayout >= 0 ? "font-bold text-emerald-700" : "font-bold text-red-600"}>{entry.creatorPayout >= 0 ? "+" : "-"}${Math.abs(entry.creatorPayout).toLocaleString("es-CL")}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold text-slate-900">Historial de retiros</h2>
        {withdrawals.map((w) => (
          <div key={w.id} className="mb-2 flex items-center justify-between text-sm">
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
  );
}
