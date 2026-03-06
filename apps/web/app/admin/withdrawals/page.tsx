"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { CheckCircle2, XCircle, Banknote } from "lucide-react";

type Withdrawal = {
  id: string;
  amount: number;
  clpAmount: number;
  status: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  holderName: string;
  holderRut: string;
  rejectReason?: string;
  createdAt: string;
  wallet: {
    user: { id: string; email: string; displayName: string; username: string; profileType: string };
  };
};

export default function AdminWithdrawalsPage() {
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [filter, setFilter] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ withdrawals: Withdrawal[] }>(`/admin/withdrawals?status=${filter}`);
      setItems(res.withdrawals || []);
    } catch {} finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    setActionId(id);
    try { await apiFetch(`/admin/withdrawals/${id}/approve`, { method: "PUT" }); load(); } catch {} finally { setActionId(null); }
  };

  const reject = async (id: string) => {
    setActionId(id);
    try {
      await apiFetch(`/admin/withdrawals/${id}/reject`, { method: "PUT", body: JSON.stringify({ reason: rejectReason }) });
      setShowReject(null); setRejectReason(""); load();
    } catch {} finally { setActionId(null); }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold flex items-center gap-2"><Banknote className="h-6 w-6 text-emerald-400" /> Solicitudes de Retiro</h1>

        <div className="mb-4 flex gap-2">
          {["PENDING", "APPROVED", "REJECTED", "ALL"].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${filter === s ? "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-300" : "border-white/10 text-white/50"}`}>
              {s === "PENDING" ? "Pendientes" : s === "APPROVED" ? "Aprobados" : s === "REJECTED" ? "Rechazados" : "Todos"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-white/30">Cargando...</div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center text-white/30">Sin solicitudes</div>
        ) : (
          <div className="space-y-3">
            {items.map((w) => (
              <div key={w.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{w.wallet.user.displayName || w.wallet.user.username}</p>
                    <p className="text-[10px] text-white/40">{w.wallet.user.email}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-lg font-bold text-emerald-300">{w.amount} tokens</span>
                      <span className="text-xs text-white/40">→ ${w.clpAmount.toLocaleString("es-CL")} CLP</span>
                    </div>
                    <div className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-white/50">
                      <p>{w.bankName} · {w.accountType} · {w.accountNumber}</p>
                      <p>{w.holderName} · {w.holderRut}</p>
                    </div>
                    <p className="mt-1 text-[10px] text-white/30">{new Date(w.createdAt).toLocaleString("es-CL")}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {w.status === "PENDING" && (
                      <div className="flex gap-2">
                        <button onClick={() => approve(w.id)} disabled={actionId === w.id} className="flex items-center gap-1 rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs font-medium hover:bg-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
                        </button>
                        <button onClick={() => setShowReject(w.id)} className="flex items-center gap-1 rounded-lg bg-red-600/80 px-3 py-1.5 text-xs font-medium hover:bg-red-600">
                          <XCircle className="h-3.5 w-3.5" /> Rechazar
                        </button>
                      </div>
                    )}
                    {w.status !== "PENDING" && (
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${w.status === "APPROVED" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
                        {w.status === "APPROVED" ? "Aprobado" : "Rechazado"}
                      </span>
                    )}
                  </div>
                </div>
                {showReject === w.id && (
                  <div className="mt-3 flex gap-2">
                    <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Motivo (opcional)" className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs outline-none" />
                    <button onClick={() => reject(w.id)} disabled={actionId === w.id} className="rounded-lg bg-red-600 px-4 py-2 text-xs font-medium">Confirmar</button>
                    <button onClick={() => setShowReject(null)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50">Cancelar</button>
                  </div>
                )}
                {w.rejectReason && <p className="mt-2 text-xs text-red-400/70">Motivo: {w.rejectReason}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
