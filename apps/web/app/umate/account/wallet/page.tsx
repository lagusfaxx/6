"use client";

import { useEffect, useState } from "react";
import { DollarSign, ArrowDown, Clock, CheckCircle, XCircle, Loader2, Wallet, TrendingUp } from "lucide-react";
import { apiFetch } from "../../../../lib/api";

type Stats = {
  pendingBalance: number;
  availableBalance: number;
  totalEarned: number;
  ledger: { id: string; type: string; grossAmount: number; creatorPayout: number; createdAt: string; description: string | null }[];
};

type Withdrawal = {
  id: string;
  amount: number;
  status: string;
  bankName: string;
  createdAt: string;
};

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

  const [wdError, setWdError] = useState("");
  const [wdSuccess, setWdSuccess] = useState("");

  const handleWithdraw = async () => {
    if (!confirm(`¿Solicitar retiro de $${stats?.availableBalance?.toLocaleString("es-CL")} CLP?`)) return;
    setWithdrawing(true);
    setWdError("");
    try {
      await apiFetch("/umate/creator/withdraw", { method: "POST" });
      const [s, w] = await Promise.all([
        apiFetch<Stats>("/umate/creator/stats"),
        apiFetch<{ withdrawals: Withdrawal[] }>("/umate/creator/withdrawals"),
      ]);
      setStats(s);
      setWithdrawals(w?.withdrawals || []);
      setWdSuccess("Retiro solicitado exitosamente. El equipo lo revisará pronto.");
      setTimeout(() => setWdSuccess(""), 5000);
    } catch (err: any) {
      const code = err?.body?.error;
      if (code === "BANK_NOT_CONFIGURED") {
        setWdError("Configura tus datos bancarios primero.");
      } else if (code === "NO_BALANCE") {
        setWdError("No tienes saldo disponible para retirar.");
      } else {
        setWdError("Error al solicitar el retiro. Intenta de nuevo.");
      }
      setTimeout(() => setWdError(""), 5000);
    }
    setWithdrawing(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-rose-400/60" /></div>;
  if (!stats) return <div className="py-20 text-center text-white/40">No eres creadora aún.</div>;

  return (
    <div className="mx-auto max-w-2xl py-8 space-y-6">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">Billetera</h1>
        <p className="text-xs text-white/25 mt-0.5">Gestiona tus ingresos y retiros</p>
      </div>

      {/* Feedback */}
      {wdError && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">{wdError}</div>}
      {wdSuccess && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">{wdSuccess}</div>}

      {/* Balance cards — prominent display */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.06] to-transparent p-5 text-center">
          <Wallet className="mx-auto h-5 w-5 text-emerald-400/60 mb-2" />
          <p className="text-2xl font-extrabold text-emerald-300">${stats.availableBalance.toLocaleString("es-CL")}</p>
          <p className="text-[10px] text-white/30 mt-1">Disponible</p>
        </div>
        <div className="rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.06] to-transparent p-5 text-center">
          <Clock className="mx-auto h-5 w-5 text-amber-400/60 mb-2" />
          <p className="text-2xl font-extrabold text-amber-300">${stats.pendingBalance.toLocaleString("es-CL")}</p>
          <p className="text-[10px] text-white/30 mt-1">Retenido</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-center">
          <TrendingUp className="mx-auto h-5 w-5 text-white/20 mb-2" />
          <p className="text-2xl font-extrabold">${stats.totalEarned.toLocaleString("es-CL")}</p>
          <p className="text-[10px] text-white/30 mt-1">Total ganado</p>
        </div>
      </div>

      {/* Withdraw button */}
      {stats.availableBalance > 0 ? (
        <button
          onClick={handleWithdraw}
          disabled={withdrawing}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3.5 text-sm font-bold text-white transition hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] disabled:opacity-50"
        >
          {withdrawing ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : (
            <span className="flex items-center justify-center gap-2"><ArrowDown className="h-4 w-4" /> Solicitar retiro — ${stats.availableBalance.toLocaleString("es-CL")}</span>
          )}
        </button>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-3.5 text-center text-xs text-white/25">
          No tienes saldo disponible para retirar
        </div>
      )}

      {/* Ledger */}
      {stats.ledger.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="mb-3 text-sm font-bold">Movimientos</h2>
          <div className="space-y-2.5">
            {stats.ledger.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-xs border-b border-white/[0.04] pb-2.5 last:border-0">
                <div>
                  <p className="text-white/50">{entry.description || entry.type}</p>
                  <p className="text-[10px] text-white/20">{new Date(entry.createdAt).toLocaleDateString("es-CL")}</p>
                </div>
                <span className={`font-bold ${entry.creatorPayout >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                  {entry.creatorPayout >= 0 ? "+" : ""}${Math.abs(entry.creatorPayout).toLocaleString("es-CL")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Withdrawals history */}
      {withdrawals.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="mb-3 text-sm font-bold">Historial de retiros</h2>
          <div className="space-y-2.5">
            {withdrawals.map((w) => (
              <div key={w.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  {w.status === "APPROVED" && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                  {w.status === "PENDING" && <Clock className="h-4 w-4 text-amber-400" />}
                  {w.status === "REJECTED" && <XCircle className="h-4 w-4 text-red-400" />}
                  <div>
                    <p className="text-white/50 font-medium">${w.amount.toLocaleString("es-CL")} — {w.bankName}</p>
                    <p className="text-[10px] text-white/20">{new Date(w.createdAt).toLocaleDateString("es-CL")}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold ${
                  w.status === "APPROVED" ? "bg-emerald-500/15 text-emerald-300" :
                  w.status === "PENDING" ? "bg-amber-500/15 text-amber-300" :
                  "bg-red-500/15 text-red-300"
                }`}>
                  {w.status === "APPROVED" ? "Aprobado" : w.status === "PENDING" ? "Pendiente" : "Rechazado"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
