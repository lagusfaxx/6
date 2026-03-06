"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import { CheckCircle2, XCircle, Clock, Image, ChevronDown } from "lucide-react";

type Deposit = {
  id: string;
  amount: number;
  clpAmount: number;
  status: string;
  receiptUrl: string;
  rejectReason?: string;
  createdAt: string;
  wallet: {
    user: { id: string; email: string; displayName: string; username: string; profileType: string };
  };
};

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [filter, setFilter] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ deposits: Deposit[] }>(`/admin/deposits?status=${filter}`);
      setDeposits(res.deposits || []);
    } catch {} finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    setActionId(id);
    try {
      await apiFetch(`/admin/deposits/${id}/approve`, { method: "PUT" });
      load();
    } catch {} finally { setActionId(null); }
  };

  const reject = async (id: string) => {
    setActionId(id);
    try {
      await apiFetch(`/admin/deposits/${id}/reject`, {
        method: "PUT",
        body: JSON.stringify({ reason: rejectReason }),
      });
      setShowReject(null);
      setRejectReason("");
      load();
    } catch {} finally { setActionId(null); }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Depósitos de Tokens</h1>

        <div className="mb-4 flex gap-2">
          {["PENDING", "APPROVED", "REJECTED", "ALL"].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${filter === s ? "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-300" : "border-white/10 text-white/50"}`}>
              {s === "PENDING" ? "Pendientes" : s === "APPROVED" ? "Aprobados" : s === "REJECTED" ? "Rechazados" : "Todos"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-white/30">Cargando...</div>
        ) : deposits.length === 0 ? (
          <div className="py-20 text-center text-white/30">Sin depósitos</div>
        ) : (
          <div className="space-y-3">
            {deposits.map((d) => (
              <div key={d.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{d.wallet.user.displayName || d.wallet.user.username}</p>
                    <p className="text-[10px] text-white/40">{d.wallet.user.email} · {d.wallet.user.profileType}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-lg font-bold text-fuchsia-300">{d.amount} tokens</span>
                      <span className="text-xs text-white/40">${d.clpAmount.toLocaleString("es-CL")} CLP</span>
                    </div>
                    <p className="mt-1 text-[10px] text-white/30">{new Date(d.createdAt).toLocaleString("es-CL")}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {d.receiptUrl && (
                      <a href={resolveMediaUrl(d.receiptUrl) || "#"} target="_blank" rel="noopener" className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.08]">
                        <Image className="h-3.5 w-3.5" /> Ver comprobante
                      </a>
                    )}
                    {d.status === "PENDING" && (
                      <div className="flex gap-2">
                        <button onClick={() => approve(d.id)} disabled={actionId === d.id} className="flex items-center gap-1 rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs font-medium hover:bg-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
                        </button>
                        <button onClick={() => setShowReject(d.id)} className="flex items-center gap-1 rounded-lg bg-red-600/80 px-3 py-1.5 text-xs font-medium hover:bg-red-600">
                          <XCircle className="h-3.5 w-3.5" /> Rechazar
                        </button>
                      </div>
                    )}
                    {d.status !== "PENDING" && (
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${d.status === "APPROVED" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
                        {d.status === "APPROVED" ? "Aprobado" : "Rechazado"}
                      </span>
                    )}
                  </div>
                </div>
                {showReject === d.id && (
                  <div className="mt-3 flex gap-2">
                    <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Motivo de rechazo (opcional)" className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs outline-none" />
                    <button onClick={() => reject(d.id)} disabled={actionId === d.id} className="rounded-lg bg-red-600 px-4 py-2 text-xs font-medium">Confirmar</button>
                    <button onClick={() => setShowReject(null)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50">Cancelar</button>
                  </div>
                )}
                {d.rejectReason && <p className="mt-2 text-xs text-red-400/70">Motivo: {d.rejectReason}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
