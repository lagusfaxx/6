"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import useMe from "../../hooks/useMe";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import {
  Wallet, Upload, ArrowDownCircle, ArrowUpCircle, History,
  Coins, CheckCircle2, Clock, Send, TrendingUp, TrendingDown,
  CreditCard, Eye, EyeOff, Copy, ChevronRight, Video,
  ArrowRight, RefreshCw, AlertCircle, Shield, Banknote,
  Zap, Building2,
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

const txTypeIcons: Record<string, { icon: typeof Coins; color: string }> = {
  DEPOSIT: { icon: ArrowDownCircle, color: "text-emerald-400 bg-emerald-500/15" },
  VIDEOCALL_HOLD: { icon: Clock, color: "text-amber-400 bg-amber-500/15" },
  VIDEOCALL_RELEASE: { icon: Video, color: "text-violet-400 bg-violet-500/15" },
  VIDEOCALL_REFUND: { icon: RefreshCw, color: "text-blue-400 bg-blue-500/15" },
  VIDEOCALL_COMMISSION: { icon: Shield, color: "text-fuchsia-400 bg-fuchsia-500/15" },
  WITHDRAWAL: { icon: ArrowUpCircle, color: "text-orange-400 bg-orange-500/15" },
  PENALTY: { icon: AlertCircle, color: "text-red-400 bg-red-500/15" },
  ADJUSTMENT: { icon: Coins, color: "text-white/50 bg-white/10" },
};

export default function WalletPage() {
  const { me } = useMe();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [tab, setTab] = useState<"overview" | "deposit" | "withdraw" | "history">("overview");
  const [balanceVisible, setBalanceVisible] = useState(true);

  // Deposit form
  const [depositTokens, setDepositTokens] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositMsg, setDepositMsg] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"flow" | "transfer">("flow");
  const [flowLoading, setFlowLoading] = useState(false);

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

  // Handle Flow return redirect (user comes back from Flow with ?ref=intentId)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ref")) {
      setTab("deposit");
      setDepositMsg("Pago procesado. Tus tokens han sido acreditados.");
      window.history.replaceState({}, "", "/wallet");
    }
  }, []);

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

  const handleFlowDeposit = async () => {
    if (!depositTokens) return;
    setFlowLoading(true);
    setDepositMsg("");
    try {
      const res = await apiFetch<{ url: string; token: string; intentId: string }>("/wallet/deposit/flow", {
        method: "POST",
        body: JSON.stringify({ tokens: parseInt(depositTokens, 10) }),
      });
      // Redirect to Flow payment page
      window.location.href = res.url;
    } catch (e: any) {
      const msg = e?.message || "Error al procesar pago";
      if (msg.includes("email") || msg.includes("EMAIL")) {
        setDepositMsg("Flow no acepta tu email. Prueba con transferencia bancaria o actualiza tu email en tu perfil.");
        setPaymentMethod("transfer");
      } else {
        setDepositMsg(msg);
      }
      setFlowLoading(false);
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

  const tokenPackages = [
    { tokens: 5, popular: false },
    { tokens: 10, popular: false },
    { tokens: 25, popular: true },
    { tokens: 50, popular: false },
    { tokens: 100, popular: true },
    { tokens: 200, popular: false },
  ];

  const recentTx = transactions.slice(0, 5);

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      <div className="mx-auto max-w-lg px-4 py-6 pb-28">

        {/* ── Main Balance Card ── */}
        {wallet && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 overflow-hidden rounded-3xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-600/15 via-violet-600/10 to-transparent p-6"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                  <Wallet className="h-5 w-5 text-fuchsia-300" />
                </div>
                <span className="text-sm font-medium text-white/60">Mi Billetera</span>
              </div>
              <button
                onClick={() => setBalanceVisible(!balanceVisible)}
                className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 transition"
              >
                {balanceVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>

            <div className="mt-2">
              <p className="text-4xl font-bold tracking-tight">
                {balanceVisible ? wallet.balance.toLocaleString() : "•••••"}
              </p>
              <p className="text-sm text-white/40 mt-0.5">
                {balanceVisible
                  ? `$${(wallet.balance * rate).toLocaleString("es-CL")} CLP`
                  : "••••• CLP"
                }
              </p>
              <p className="text-[10px] text-white/25 mt-1">1 token = ${rate.toLocaleString("es-CL")} CLP</p>
            </div>

            {/* Mini stats row */}
            <div className={`mt-4 grid gap-2 ${isProfessional ? "grid-cols-3" : "grid-cols-2"}`}>
              <div className="rounded-xl bg-white/[0.06] px-3 py-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Clock className="h-3 w-3 text-amber-300/70" />
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-300/60">Retenido</span>
                </div>
                <p className="text-sm font-bold text-amber-300">
                  {balanceVisible ? wallet.heldBalance.toLocaleString() : "•••"}
                </p>
              </div>
              {isProfessional && (
                <div className="rounded-xl bg-white/[0.06] px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <TrendingUp className="h-3 w-3 text-emerald-300/70" />
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-300/60">Ganado</span>
                  </div>
                  <p className="text-sm font-bold text-emerald-300">
                    {balanceVisible ? wallet.totalEarned.toLocaleString() : "•••"}
                  </p>
                </div>
              )}
              <div className="rounded-xl bg-white/[0.06] px-3 py-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <TrendingDown className="h-3 w-3 text-violet-300/70" />
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-violet-300/60">Gastado</span>
                </div>
                <p className="text-sm font-bold text-violet-300">
                  {balanceVisible ? wallet.totalSpent.toLocaleString() : "•••"}
                </p>
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setTab("deposit")}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-sm font-semibold transition hover:opacity-90"
              >
                <ArrowDownCircle className="h-4 w-4" />
                Comprar
              </button>
              {isProfessional && (
                <button
                  onClick={() => setTab("withdraw")}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/15"
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  Retirar
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Tabs ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-5 flex gap-1.5 overflow-x-auto scrollbar-none rounded-2xl bg-white/[0.04] p-1"
        >
          {(["overview", "deposit", ...(isProfessional ? ["withdraw" as const] : []), "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-medium transition ${
                tab === t
                  ? "bg-white/[0.1] text-white shadow-sm"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {t === "overview" && <><Coins className="h-3.5 w-3.5" /> Resumen</>}
              {t === "deposit" && <><ArrowDownCircle className="h-3.5 w-3.5" /> Comprar</>}
              {t === "withdraw" && <><Banknote className="h-3.5 w-3.5" /> Retirar</>}
              {t === "history" && <><History className="h-3.5 w-3.5" /> Historial</>}
            </button>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ── Overview Tab ── */}
          {tab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Quick links */}
              <div className="grid grid-cols-2 gap-3">
                <Link href="/videocall" className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition hover:bg-white/[0.06]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15">
                    <Video className="h-5 w-5 text-violet-300" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Videollamadas</p>
                    <p className="text-[10px] text-white/30">Agendar llamada</p>
                  </div>
                </Link>
                <button
                  onClick={() => setTab("deposit")}
                  className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition hover:bg-white/[0.06] text-left"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/15">
                    <CreditCard className="h-5 w-5 text-fuchsia-300" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">Recargar</p>
                    <p className="text-[10px] text-white/30">Comprar tokens</p>
                  </div>
                </button>
              </div>

              {/* Recent activity */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">Actividad reciente</h3>
                  <button
                    onClick={() => setTab("history")}
                    className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300"
                  >
                    Ver todo <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
                {recentTx.length > 0 ? (
                  <div className="space-y-2">
                    {recentTx.map((tx) => {
                      const txMeta = txTypeIcons[tx.type] || txTypeIcons.ADJUSTMENT;
                      const Icon = txMeta.icon;
                      return (
                        <div key={tx.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${txMeta.color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs text-white/80">{tx.description}</p>
                            <p className="text-[10px] text-white/25">{new Date(tx.createdAt).toLocaleString("es-CL")}</p>
                          </div>
                          <span className={`ml-2 text-sm font-bold tabular-nums ${tx.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {tx.amount >= 0 ? "+" : ""}{tx.amount}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/[0.08] py-12 text-center">
                    <Coins className="mx-auto mb-3 h-8 w-8 text-white/10" />
                    <p className="text-sm text-white/30">Sin movimientos aún</p>
                    <p className="text-[10px] text-white/15 mt-1">Tus transacciones aparecerán aquí</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Deposit Tab ── */}
          {tab === "deposit" && (
            <motion.div key="deposit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/15">
                    <CreditCard className="h-5 w-5 text-fuchsia-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Comprar Tokens</h3>
                    <p className="text-[10px] text-white/40">Selecciona un paquete y método de pago</p>
                  </div>
                </div>

                {/* ── Token packages grid ── */}
                <label className="mb-2 block text-xs text-white/50">Selecciona un paquete</label>
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {tokenPackages.map((pkg) => (
                    <button
                      key={pkg.tokens}
                      onClick={() => setDepositTokens(String(pkg.tokens))}
                      className={`relative rounded-xl border px-3 py-3 text-center transition ${
                        depositTokens === String(pkg.tokens)
                          ? "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-300"
                          : "border-white/[0.08] bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
                      }`}
                    >
                      {pkg.popular && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-fuchsia-500 px-2 py-0.5 text-[8px] font-bold text-white">
                          Popular
                        </span>
                      )}
                      <p className="text-lg font-bold">{pkg.tokens}</p>
                      <p className="text-[10px] text-white/40">${(pkg.tokens * rate).toLocaleString("es-CL")}</p>
                    </button>
                  ))}
                </div>

                {/* Manual input */}
                <input
                  type="number"
                  min="1"
                  value={depositTokens}
                  onChange={(e) => setDepositTokens(e.target.value)}
                  placeholder="O ingresa otra cantidad"
                  className="mb-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-fuchsia-500/30 transition"
                />
                {depositTokens && (
                  <p className="mb-4 text-xs text-white/40">
                    Total: ${(parseInt(depositTokens || "0", 10) * rate).toLocaleString("es-CL")} CLP
                  </p>
                )}

                {/* ── Payment method selector ── */}
                <label className="mb-2 block text-xs text-white/50">Método de pago</label>
                <div className="mb-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod("flow")}
                    className={`flex items-center gap-2 rounded-xl border p-3 transition ${
                      paymentMethod === "flow"
                        ? "border-fuchsia-500/40 bg-fuchsia-500/10"
                        : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${paymentMethod === "flow" ? "bg-fuchsia-500/20" : "bg-white/10"}`}>
                      <Zap className={`h-4 w-4 ${paymentMethod === "flow" ? "text-fuchsia-300" : "text-white/40"}`} />
                    </div>
                    <div className="text-left">
                      <p className={`text-xs font-semibold ${paymentMethod === "flow" ? "text-fuchsia-300" : "text-white/60"}`}>Flow</p>
                      <p className="text-[9px] text-white/30">Pago inmediato</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("transfer")}
                    className={`flex items-center gap-2 rounded-xl border p-3 transition ${
                      paymentMethod === "transfer"
                        ? "border-violet-500/40 bg-violet-500/10"
                        : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${paymentMethod === "transfer" ? "bg-violet-500/20" : "bg-white/10"}`}>
                      <Building2 className={`h-4 w-4 ${paymentMethod === "transfer" ? "text-violet-300" : "text-white/40"}`} />
                    </div>
                    <div className="text-left">
                      <p className={`text-xs font-semibold ${paymentMethod === "transfer" ? "text-violet-300" : "text-white/60"}`}>Transferencia</p>
                      <p className="text-[9px] text-white/30">Revisión 24h</p>
                    </div>
                  </button>
                </div>

                {/* ── Flow payment section ── */}
                {paymentMethod === "flow" && (
                  <div>
                    <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <p className="text-xs text-emerald-300 font-medium">Tokens entregados al instante</p>
                      </div>
                      <p className="mt-1 text-[10px] text-white/40 ml-6">Al confirmar el pago con Flow, los tokens se acreditan automáticamente en tu billetera.</p>
                    </div>
                    <button
                      onClick={handleFlowDeposit}
                      disabled={flowLoading || !depositTokens || parseInt(depositTokens || "0", 10) < 1}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3.5 text-sm font-semibold disabled:opacity-40 transition hover:opacity-90"
                    >
                      <Zap className="h-4 w-4" />
                      {flowLoading ? "Redirigiendo a Flow..." : "Pagar con Flow"}
                    </button>
                  </div>
                )}

                {/* ── Transfer payment section ── */}
                {paymentMethod === "transfer" && (
                  <div>
                    <div className="mb-4 rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/60">Datos Bancarios UZEED</p>
                        <button
                          onClick={() => navigator.clipboard?.writeText("Banco Estado · Cuenta Corriente · UZEED SpA · 000-000-000")}
                          className="rounded-lg p-1 text-white/30 hover:bg-white/10 hover:text-white/50 transition"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-white/70">Banco Estado · Cuenta Corriente</p>
                        <p className="text-xs text-white/70">UZEED SpA · RUT: 77.xxx.xxx-x</p>
                        <p className="text-xs text-white/70">N° Cuenta: 000-000-000</p>
                      </div>
                    </div>

                    <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-400" />
                        <p className="text-xs text-amber-300 font-medium">Requiere validación</p>
                      </div>
                      <p className="mt-1 text-[10px] text-white/40 ml-6">Los tokens se acreditarán cuando el admin apruebe tu comprobante (máximo 24 horas hábiles).</p>
                    </div>

                    <label className="mb-1.5 block text-xs text-white/50">Comprobante de transferencia</label>
                    <div className="mb-5 rounded-xl border-2 border-dashed border-white/[0.1] bg-white/[0.02] p-4 text-center transition hover:border-fuchsia-500/20 hover:bg-white/[0.04]">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                        className="w-full text-xs text-white/50 file:mr-3 file:rounded-full file:border-0 file:bg-fuchsia-500/20 file:px-4 file:py-2 file:text-xs file:text-fuchsia-300 file:cursor-pointer"
                      />
                      {receiptFile && (
                        <p className="mt-2 text-[10px] text-emerald-400 flex items-center justify-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> {receiptFile.name}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={handleDeposit}
                      disabled={depositLoading || !depositTokens || !receiptFile}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 text-sm font-semibold disabled:opacity-40 transition hover:opacity-90"
                    >
                      <Upload className="h-4 w-4" />
                      {depositLoading ? "Enviando..." : "Enviar Comprobante"}
                    </button>
                  </div>
                )}

                {depositMsg && (
                  <p className={`mt-3 text-center text-xs ${depositMsg.includes("Error") ? "text-red-400" : "text-emerald-400"}`}>
                    {depositMsg}
                  </p>
                )}
              </div>

              {/* Recent deposits */}
              {deposits.length > 0 && (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <h4 className="mb-3 text-xs font-semibold text-white/50">Mis depósitos</h4>
                  <div className="space-y-2">
                    {deposits.map((d) => (
                      <div key={d.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fuchsia-500/10">
                            <ArrowDownCircle className="h-4 w-4 text-fuchsia-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{d.amount} tokens</p>
                            <p className="text-[10px] text-white/30">${d.clpAmount.toLocaleString("es-CL")} · {new Date(d.createdAt).toLocaleDateString("es-CL")}</p>
                          </div>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusColors[d.status] || ""}`}>
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
            <motion.div key="withdraw" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
                    <Banknote className="h-5 w-5 text-emerald-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Solicitar Retiro</h3>
                    <p className="text-[10px] text-white/40">Disponible: {wallet?.balance.toLocaleString() || 0} tokens</p>
                  </div>
                </div>

                <label className="mb-1.5 block text-xs text-white/50">Tokens a retirar</label>
                <input
                  type="number"
                  min="1"
                  max={wallet?.balance || 0}
                  value={withdrawTokens}
                  onChange={(e) => setWithdrawTokens(e.target.value)}
                  placeholder="Ej: 50"
                  className="mb-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-emerald-500/30 transition"
                />
                {withdrawTokens && (
                  <p className="mb-4 text-xs text-white/40">
                    = ${(parseInt(withdrawTokens || "0", 10) * rate).toLocaleString("es-CL")} CLP
                  </p>
                )}

                <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Datos bancarios</p>

                  <div>
                    <label className="mb-1 block text-xs text-white/50">Banco</label>
                    <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Ej: Banco Estado" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm outline-none focus:border-emerald-500/30 transition" />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-white/50">Tipo de cuenta</label>
                    <select value={accountType} onChange={(e) => setAccountType(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm outline-none focus:border-emerald-500/30">
                      <option value="corriente">Corriente</option>
                      <option value="vista">Vista / RUT</option>
                      <option value="ahorro">Ahorro</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-white/50">N° de cuenta</label>
                    <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="000-000-000" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm outline-none focus:border-emerald-500/30 transition" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-white/50">Nombre titular</label>
                      <input value={holderName} onChange={(e) => setHolderName(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm outline-none focus:border-emerald-500/30 transition" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-white/50">RUT titular</label>
                      <input value={holderRut} onChange={(e) => setHolderRut(e.target.value)} placeholder="12.345.678-9" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm outline-none focus:border-emerald-500/30 transition" />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleWithdraw}
                  disabled={withdrawLoading || !withdrawTokens || !bankName || !accountNumber || !holderName || !holderRut}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3.5 text-sm font-semibold disabled:opacity-40 transition hover:opacity-90"
                >
                  <Send className="h-4 w-4" />
                  {withdrawLoading ? "Enviando..." : "Solicitar Retiro"}
                </button>
                {withdrawMsg && (
                  <p className={`mt-3 text-center text-xs ${withdrawMsg.includes("Error") ? "text-red-400" : "text-emerald-400"}`}>
                    {withdrawMsg}
                  </p>
                )}
              </div>

              {withdrawals.length > 0 && (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <h4 className="mb-3 text-xs font-semibold text-white/50">Mis retiros</h4>
                  <div className="space-y-2">
                    {withdrawals.map((w) => (
                      <div key={w.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                            <ArrowUpCircle className="h-4 w-4 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{w.amount} tokens</p>
                            <p className="text-[10px] text-white/30">${w.clpAmount.toLocaleString("es-CL")} · {w.bankName} · {new Date(w.createdAt).toLocaleDateString("es-CL")}</p>
                          </div>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusColors[w.status] || ""}`}>
                          {statusLabels[w.status] || w.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── History Tab ── */}
          {tab === "history" && (
            <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
              {transactions.length > 0 ? (
                transactions.map((tx) => {
                  const txMeta = txTypeIcons[tx.type] || txTypeIcons.ADJUSTMENT;
                  const Icon = txMeta.icon;
                  return (
                    <div key={tx.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${txMeta.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-white/70">{tx.description}</p>
                        <p className="text-[10px] text-white/25">
                          {new Date(tx.createdAt).toLocaleString("es-CL")} · Saldo: {tx.balance}
                        </p>
                      </div>
                      <span className={`ml-2 text-xs font-bold tabular-nums ${tx.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {tx.amount >= 0 ? "+" : ""}{tx.amount}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-white/[0.08] py-12 text-center">
                  <History className="mx-auto mb-3 h-8 w-8 text-white/10" />
                  <p className="text-sm text-white/30">Sin transacciones</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
