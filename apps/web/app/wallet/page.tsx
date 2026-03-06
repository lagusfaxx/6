"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useMe from "../../hooks/useMe";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import {
  Wallet, Upload, ArrowDownCircle, ArrowUpCircle, History,
  ChevronRight, Coins, Ban, CheckCircle2, Clock, X, Send,
} from "lucide-react";

type WalletData = {
  balance: number;
  heldBalance: number;
  totalEarned: number;
  totalSpent: number;
  tokenRateClp: number;
};

type Deposit = {
  id: string;
  amount: number;
  clpAmount: number;
  status: string;
  receiptUrl: string;
  rejectReason?: string;
  createdAt: string;
};

type Withdrawal = {
  id: string;
  amount: number;
  clpAmount: number;
  status: string;
  bankName: string;
  accountNumber: string;
  rejectReason?: string;
  createdAt: string;
};

type Tx = {
  id: string;
  type: string;
  amount: number;
  balance: number;
  description: string;
  createdAt: string;
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.3 } }),
};

const statusColors: Record<string, string> = {
  PENDING: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  APPROVED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  REJECTED: "text-red-400 bg-red-500/10 border-red-500/20",
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
};

export default function WalletPage() {
  const { me } = useMe();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [tab, setTab] = useState<"overview" | "deposit" | "withdraw" | "history">("overview");

  // Deposit form
  const [depositTokens, setDepositTokens] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositMsg, setDepositMsg] = useState("");

  // Withdraw form
  const [withdrawTokens, setWithdrawTokens] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountType, setAccountType] = useState("corriente");
  const [accountNumber, setAccountNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [holderRut, setHolderRut] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState("");

  const isProfessional = me?.user?.profileType === "PROFESSIONAL";

  const loadData = useCallback(async () => {
    try {
      const [w, d, wd, tx] = await Promise.all([
        apiFetch<WalletData>("/wallet"),
        apiFetch<{ deposits: Deposit[] }>("/wallet/deposits"),
        apiFetch<{ withdrawals: Withdrawal[] }>("/wallet/withdrawals"),
        apiFetch<{ transactions: Tx[] }>("/wallet/transactions"),
      ]);
      setWallet(w);
      setDeposits(d.deposits || []);
      setWithdrawals(wd.withdrawals || []);
      setTransactions(tx.transactions || []);
    } catch {}
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDeposit = async () => {
    if (!receiptFile || !depositTokens) return;
    setDepositLoading(true);
    setDepositMsg("");
    try {
      const form = new FormData();
      form.append("tokens", depositTokens);
      form.append("receipt", receiptFile);
      await apiFetch("/wallet/deposit", { method: "POST", body: form });
      setDepositMsg("Solicitud enviada. El admin revisará tu comprobante.");
      setDepositTokens("");
      setReceiptFile(null);
      loadData();
    } catch (e: any) {
      setDepositMsg(e?.message || "Error al enviar");
    } finally {
      setDepositLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawTokens || !bankName || !accountNumber || !holderName || !holderRut) return;
    setWithdrawLoading(true);
    setWithdrawMsg("");
    try {
      await apiFetch("/wallet/withdraw", {
        method: "POST",
        body: JSON.stringify({
          amount: parseInt(withdrawTokens, 10),
          bankName, accountType, accountNumber, holderName, holderRut,
        }),
      });
      setWithdrawMsg("Solicitud de retiro enviada.");
      setWithdrawTokens("");
      loadData();
    } catch (e: any) {
      setWithdrawMsg(e?.message || "Error al solicitar retiro");
    } finally {
      setWithdrawLoading(false);
    }
  };

  const rate = wallet?.tokenRateClp || 1000;

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      <div className="mx-auto max-w-2xl px-4 py-8 pb-28">
        {/* Header */}
        <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp} className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-600/20 to-violet-600/20">
              <Wallet className="h-6 w-6 text-fuchsia-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Mi Billetera</h1>
              <p className="text-sm text-white/40">1 token = ${rate.toLocaleString("es-CL")} CLP</p>
            </div>
          </div>
        </motion.div>

        {/* Balance Cards */}
        {wallet && (
          <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp} className="mb-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-600/10 to-transparent p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-300/60">Disponible</p>
              <p className="mt-1 text-2xl font-bold text-fuchsia-300">{wallet.balance.toLocaleString()}</p>
              <p className="text-[10px] text-white/30">${(wallet.balance * rate).toLocaleString("es-CL")} CLP</p>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-600/10 to-transparent p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/60">En retención</p>
              <p className="mt-1 text-2xl font-bold text-amber-300">{wallet.heldBalance.toLocaleString()}</p>
              <p className="text-[10px] text-white/30">${(wallet.heldBalance * rate).toLocaleString("es-CL")} CLP</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-600/10 to-transparent p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/60">Total ganado</p>
              <p className="mt-1 text-lg font-bold text-emerald-300">{wallet.totalEarned.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 to-transparent p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/60">Total gastado</p>
              <p className="mt-1 text-lg font-bold text-violet-300">{wallet.totalSpent.toLocaleString()}</p>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp} className="mb-6 flex gap-2 overflow-x-auto scrollbar-none">
          {(["overview", "deposit", ...(isProfessional ? ["withdraw"] : []), "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as "overview" | "deposit" | "withdraw" | "history")}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-xs font-medium transition ${
                tab === t
                  ? "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-300"
                  : "border-white/[0.08] bg-white/[0.03] text-white/50 hover:bg-white/[0.06]"
              }`}
            >
              {t === "overview" && <><Coins className="h-3.5 w-3.5" /> Resumen</>}
              {t === "deposit" && <><ArrowDownCircle className="h-3.5 w-3.5" /> Comprar Tokens</>}
              {t === "withdraw" && <><ArrowUpCircle className="h-3.5 w-3.5" /> Retirar</>}
              {t === "history" && <><History className="h-3.5 w-3.5" /> Historial</>}
            </button>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ── Deposit Tab ── */}
          {tab === "deposit" && (
            <motion.div key="deposit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <h3 className="mb-4 text-sm font-semibold">Comprar Tokens por Transferencia</h3>
                <p className="mb-4 text-xs text-white/40">
                  Transfiere a la cuenta de UZEED, sube el comprobante y espera aprobación del administrador.
                </p>

                <div className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/60 mb-1">Datos Bancarios UZEED</p>
                  <p className="text-xs text-white/70">Banco Estado · Cuenta Corriente</p>
                  <p className="text-xs text-white/70">UZEED SpA · RUT: 77.xxx.xxx-x</p>
                  <p className="text-xs text-white/70">N° Cuenta: 000-000-000</p>
                </div>

                <label className="mb-1 block text-xs text-white/50">Cantidad de tokens</label>
                <input
                  type="number"
                  min="1"
                  value={depositTokens}
                  onChange={(e) => setDepositTokens(e.target.value)}
                  placeholder="Ej: 10"
                  className="mb-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-fuchsia-500/30"
                />
                {depositTokens && (
                  <p className="mb-3 text-xs text-white/40">
                    = ${(parseInt(depositTokens || "0", 10) * rate).toLocaleString("es-CL")} CLP
                  </p>
                )}

                <label className="mb-1 block text-xs text-white/50">Comprobante de transferencia</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="mb-4 w-full text-xs text-white/50 file:mr-3 file:rounded-full file:border-0 file:bg-fuchsia-500/20 file:px-4 file:py-2 file:text-xs file:text-fuchsia-300"
                />

                <button
                  onClick={handleDeposit}
                  disabled={depositLoading || !depositTokens || !receiptFile}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {depositLoading ? "Enviando..." : "Enviar Solicitud"}
                </button>
                {depositMsg && <p className="mt-2 text-center text-xs text-emerald-400">{depositMsg}</p>}
              </div>

              {/* Recent deposits */}
              {deposits.length > 0 && (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <h4 className="mb-3 text-xs font-semibold text-white/50">Mis depósitos</h4>
                  <div className="space-y-2">
                    {deposits.map((d) => (
                      <div key={d.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">{d.amount} tokens</p>
                          <p className="text-[10px] text-white/30">${d.clpAmount.toLocaleString("es-CL")} CLP · {new Date(d.createdAt).toLocaleDateString("es-CL")}</p>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColors[d.status] || ""}`}>
                          {statusLabels[d.status] || d.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Withdraw Tab ── */}
          {tab === "withdraw" && isProfessional && (
            <motion.div key="withdraw" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <h3 className="mb-4 text-sm font-semibold">Solicitar Retiro</h3>
                <p className="mb-4 text-xs text-white/40">
                  Ingresa tus datos bancarios y la cantidad de tokens a retirar. El admin procesará tu solicitud.
                </p>

                <label className="mb-1 block text-xs text-white/50">Tokens a retirar</label>
                <input type="number" min="1" max={wallet?.balance || 0} value={withdrawTokens} onChange={(e) => setWithdrawTokens(e.target.value)} placeholder="Ej: 50" className="mb-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-fuchsia-500/30" />
                {withdrawTokens && <p className="mb-3 text-xs text-white/40">= ${(parseInt(withdrawTokens || "0", 10) * rate).toLocaleString("es-CL")} CLP</p>}

                <label className="mb-1 block text-xs text-white/50">Banco</label>
                <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Ej: Banco Estado" className="mb-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-fuchsia-500/30" />

                <label className="mb-1 block text-xs text-white/50">Tipo de cuenta</label>
                <select value={accountType} onChange={(e) => setAccountType(e.target.value)} className="mb-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-fuchsia-500/30">
                  <option value="corriente">Corriente</option>
                  <option value="vista">Vista / RUT</option>
                  <option value="ahorro">Ahorro</option>
                </select>

                <label className="mb-1 block text-xs text-white/50">Número de cuenta</label>
                <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="000-000-000" className="mb-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-fuchsia-500/30" />

                <label className="mb-1 block text-xs text-white/50">Nombre titular</label>
                <input value={holderName} onChange={(e) => setHolderName(e.target.value)} className="mb-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-fuchsia-500/30" />

                <label className="mb-1 block text-xs text-white/50">RUT titular</label>
                <input value={holderRut} onChange={(e) => setHolderRut(e.target.value)} placeholder="12.345.678-9" className="mb-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-fuchsia-500/30" />

                <button onClick={handleWithdraw} disabled={withdrawLoading || !withdrawTokens || !bankName || !accountNumber || !holderName || !holderRut} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-semibold disabled:opacity-50">
                  <Send className="h-4 w-4" /> {withdrawLoading ? "Enviando..." : "Solicitar Retiro"}
                </button>
                {withdrawMsg && <p className="mt-2 text-center text-xs text-emerald-400">{withdrawMsg}</p>}
              </div>

              {withdrawals.length > 0 && (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <h4 className="mb-3 text-xs font-semibold text-white/50">Mis retiros</h4>
                  <div className="space-y-2">
                    {withdrawals.map((w) => (
                      <div key={w.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">{w.amount} tokens → ${w.clpAmount.toLocaleString("es-CL")}</p>
                          <p className="text-[10px] text-white/30">{w.bankName} · {new Date(w.createdAt).toLocaleDateString("es-CL")}</p>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColors[w.status] || ""}`}>
                          {statusLabels[w.status] || w.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Overview Tab ── */}
          {tab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              {transactions.slice(0, 10).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white/80">{tx.description}</p>
                    <p className="text-[10px] text-white/30">{new Date(tx.createdAt).toLocaleString("es-CL")}</p>
                  </div>
                  <span className={`ml-3 text-sm font-semibold ${tx.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {tx.amount >= 0 ? "+" : ""}{tx.amount}
                  </span>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="py-12 text-center text-sm text-white/30">Sin movimientos aún</div>
              )}
            </motion.div>
          )}

          {/* ── History Tab ── */}
          {tab === "history" && (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-white/70">{tx.description}</p>
                    <p className="text-[10px] text-white/25">{new Date(tx.createdAt).toLocaleString("es-CL")} · Saldo: {tx.balance}</p>
                  </div>
                  <span className={`ml-3 text-xs font-bold ${tx.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {tx.amount >= 0 ? "+" : ""}{tx.amount}
                  </span>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="py-12 text-center text-sm text-white/30">Sin transacciones</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
