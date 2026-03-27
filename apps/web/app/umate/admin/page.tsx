"use client";

import { useEffect, useState } from "react";
import {
  Users, TrendingUp, FileText, DollarSign, Settings, Loader2, Check, X,
  CreditCard, ArrowDown, Clock, CheckCircle, XCircle, Eye, Search,
  Edit3, ToggleLeft, ToggleRight, Wallet, AlertTriangle, RefreshCw
} from "lucide-react";
import { apiFetch } from "../../../lib/api";

// ═══ Types ═══
type Dashboard = {
  totalCreators: number;
  activeCreators: number;
  pendingReview: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  newSubsThisMonth: number;
  totalPosts: number;
  totalRevenue: number;
  config: { payoutPerSlot: number; platformCommPct: number };
};

type Creator = {
  id: string;
  displayName: string;
  status: string;
  subscriberCount: number;
  totalPosts: number;
  totalEarned: number;
  pendingBalance: number;
  availableBalance: number;
  avatarUrl: string | null;
  createdAt: string;
  user: { username: string; email: string; isVerified: boolean };
};

type Plan = { id: string; tier: string; name: string; priceCLP: number; maxSlots: number; isActive: boolean };

type Withdrawal = {
  id: string;
  amount: number;
  status: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  holderName: string;
  holderRut: string;
  createdAt: string;
  creatorId: string;
};

type LedgerEntry = {
  id: string;
  type: string;
  grossAmount: number;
  platformFee: number;
  creatorPayout: number;
  netAmount: number;
  description: string | null;
  createdAt: string;
  creator: { displayName: string; user: { username: string } };
};

// ═══ Helpers ═══
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING_TERMS: "Pendiente términos",
  PENDING_BANK: "Pendiente banco",
  PENDING_REVIEW: "En revisión",
  ACTIVE: "Activa",
  SUSPENDED: "Suspendida",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-300",
  PENDING_REVIEW: "bg-amber-500/15 text-amber-300",
  SUSPENDED: "bg-red-500/15 text-red-300",
  DRAFT: "bg-white/10 text-white/40",
  PENDING_TERMS: "bg-blue-500/15 text-blue-300",
  PENDING_BANK: "bg-blue-500/15 text-blue-300",
};

const inputClass = "w-full rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-2.5 text-sm text-white placeholder:text-white/15 focus:border-[#00aff0]/25 focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,175,240,0.05)] transition-all duration-200";

export default function UmateAdminPage() {
  const [tab, setTab] = useState<"dashboard" | "creators" | "plans" | "withdrawals" | "ledger" | "config">("dashboard");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [wdFilter, setWdFilter] = useState("");
  const [ledgerType, setLedgerType] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Config state
  const [payoutPerSlot, setPayoutPerSlot] = useState(5000);
  const [platformCommPct, setPlatformCommPct] = useState(0);
  const [saving, setSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  // Plan editing
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState(0);
  const [editSlots, setEditSlots] = useState(0);

  // Rejection reason
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    loadTab();
  }, [tab, statusFilter, wdFilter, ledgerType]);

  const loadTab = () => {
    setLoading(true);
    if (tab === "dashboard") {
      apiFetch<Dashboard>("/admin/umate/dashboard").then((d) => {
        setDashboard(d);
        if (d?.config) {
          setPayoutPerSlot(d.config.payoutPerSlot);
          setPlatformCommPct(d.config.platformCommPct);
        }
      }).catch(() => {}).finally(() => setLoading(false));
    } else if (tab === "creators") {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      apiFetch<{ creators: Creator[]; total: number }>(`/admin/umate/creators${params}`).then((d) => {
        setCreators(d?.creators || []);
      }).catch(() => {}).finally(() => setLoading(false));
    } else if (tab === "plans") {
      apiFetch<{ plans: Plan[] }>("/admin/umate/plans").then((d) => {
        setPlans(d?.plans || []);
      }).catch(() => {}).finally(() => setLoading(false));
    } else if (tab === "withdrawals") {
      const params = wdFilter ? `?status=${wdFilter}` : "";
      apiFetch<{ withdrawals: Withdrawal[] }>(`/admin/umate/withdrawals${params}`).then((d) => {
        setWithdrawals(d?.withdrawals || []);
      }).catch(() => {}).finally(() => setLoading(false));
    } else if (tab === "ledger") {
      const params = new URLSearchParams();
      if (ledgerType) params.set("type", ledgerType);
      params.set("limit", "50");
      apiFetch<{ entries: LedgerEntry[]; total: number }>(`/admin/umate/ledger?${params}`).then((d) => {
        setLedger(d?.entries || []);
        setLedgerTotal(d?.total || 0);
      }).catch(() => {}).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  };

  // ═══ Actions ═══
  const updateCreatorStatus = async (id: string, status: string) => {
    setActionLoading(id);
    await apiFetch(`/admin/umate/creators/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) });
    setCreators((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    setActionLoading(null);
  };

  const togglePlanActive = async (plan: Plan) => {
    setActionLoading(plan.id);
    await apiFetch(`/admin/umate/plans/${plan.id}`, { method: "PUT", body: JSON.stringify({ isActive: !plan.isActive }) });
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, isActive: !plan.isActive } : p)));
    setActionLoading(null);
  };

  const savePlanEdit = async (plan: Plan) => {
    setActionLoading(plan.id);
    await apiFetch(`/admin/umate/plans/${plan.id}`, {
      method: "PUT",
      body: JSON.stringify({ name: editName, priceCLP: editPrice, maxSlots: editSlots }),
    });
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, name: editName, priceCLP: editPrice, maxSlots: editSlots } : p)));
    setEditingPlan(null);
    setActionLoading(null);
  };

  const approveWithdrawal = async (id: string) => {
    setActionLoading(id);
    await apiFetch(`/admin/umate/withdrawals/${id}/approve`, { method: "PUT" });
    setWithdrawals((prev) => prev.map((w) => (w.id === id ? { ...w, status: "APPROVED" } : w)));
    setActionLoading(null);
  };

  const rejectWithdrawal = async (id: string) => {
    setActionLoading(id);
    await apiFetch(`/admin/umate/withdrawals/${id}/reject`, { method: "PUT", body: JSON.stringify({ reason: rejectReason }) });
    setWithdrawals((prev) => prev.map((w) => (w.id === id ? { ...w, status: "REJECTED" } : w)));
    setRejectId(null);
    setRejectReason("");
    setActionLoading(null);
  };

  const saveConfig = async () => {
    setSaving(true);
    setConfigSaved(false);
    await apiFetch("/admin/umate/config", { method: "PUT", body: JSON.stringify({ payoutPerSlot, platformCommPct }) });
    setSaving(false);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 3000);
  };

  const tabs = [
    { key: "dashboard", label: "Dashboard", icon: TrendingUp },
    { key: "creators", label: "Creadoras", icon: Users },
    { key: "plans", label: "Planes", icon: CreditCard },
    { key: "withdrawals", label: "Retiros", icon: ArrowDown },
    { key: "ledger", label: "Movimientos", icon: DollarSign },
    { key: "config", label: "Configuración", icon: Settings },
  ];

  return (
    <div className="py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight text-white">Admin U-Mate</h1>
        <button onClick={loadTab} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] text-white/30 transition hover:bg-white/[0.04] hover:text-white/50">
          <RefreshCw className="h-3.5 w-3.5" /> Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 overflow-x-auto border-b border-white/[0.05] pb-px scrollbar-hide">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-1.5 shrink-0 border-b-2 px-4 py-2.5 text-xs font-semibold transition-all duration-200 ${
              tab === t.key ? "border-[#00aff0] text-white" : "border-transparent text-white/25 hover:text-white/50"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
            {t.key === "withdrawals" && withdrawals.filter((w) => w.status === "PENDING").length > 0 && (
              <span className="ml-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500/25 px-1 text-[9px] font-bold text-amber-300">
                {withdrawals.filter((w) => w.status === "PENDING").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-[#00aff0]/60" /></div>}

      {/* ═══════════════════════════════════════════════════════════════
           DASHBOARD
         ═══════════════════════════════════════════════════════════════ */}
      {!loading && tab === "dashboard" && dashboard && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Creadoras activas", value: dashboard.activeCreators, color: "text-[#00aff0]", border: "border-[#00aff0]/15" },
              { label: "En revisión", value: dashboard.pendingReview, color: "text-amber-400", border: "border-amber-500/15" },
              { label: "Suscripciones activas", value: dashboard.activeSubscriptions, color: "text-emerald-400", border: "border-emerald-500/15" },
              { label: "Nuevas este mes", value: dashboard.newSubsThisMonth, color: "text-blue-400", border: "border-blue-500/15" },
            ].map((m) => (
              <div key={m.label} className={`rounded-2xl border ${m.border} bg-white/[0.02] p-4`}>
                <p className={`text-2xl font-extrabold ${m.color}`}>{m.value}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 text-center">
              <p className="text-2xl font-extrabold text-emerald-300">${dashboard.totalRevenue.toLocaleString("es-CL")}</p>
              <p className="text-[10px] text-white/30 mt-1">Ingresos totales</p>
            </div>
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 text-center">
              <p className="text-2xl font-extrabold">{dashboard.totalPosts}</p>
              <p className="text-[10px] text-white/30 mt-1">Posts totales</p>
            </div>
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 text-center">
              <p className="text-2xl font-extrabold">{dashboard.totalCreators}</p>
              <p className="text-[10px] text-white/30 mt-1">Creadoras registradas</p>
            </div>
          </div>
          {/* Quick config overview */}
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
            <h2 className="text-sm font-bold mb-3">Configuración activa</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-white/30 text-xs">Payout por cupo</p>
                <p className="font-bold">${dashboard.config.payoutPerSlot.toLocaleString("es-CL")} CLP</p>
              </div>
              <div>
                <p className="text-white/30 text-xs">Comisión plataforma</p>
                <p className="font-bold">{dashboard.config.platformCommPct}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           CREATORS
         ═══════════════════════════════════════════════════════════════ */}
      {!loading && tab === "creators" && (
        <div className="space-y-4">
          <div className="flex gap-1.5 flex-wrap">
            {["", "PENDING_REVIEW", "ACTIVE", "SUSPENDED", "DRAFT"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                  statusFilter === s ? "bg-[#00aff0]/15 text-[#00aff0] border border-[#00aff0]/25" : "text-white/25 hover:text-white/50"
                }`}
              >
                {STATUS_LABELS[s] || "Todos"}
              </button>
            ))}
          </div>

          {creators.length === 0 && (
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-12 text-center">
              <Users className="mx-auto mb-2 h-6 w-6 text-white/10" />
              <p className="text-sm text-white/30">No hay creadoras con este filtro</p>
            </div>
          )}

          <div className="space-y-2">
            {creators.map((c) => (
              <div key={c.id} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
                    {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" /> : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white/20">{(c.displayName || "?")[0]}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold truncate">{c.displayName}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${STATUS_COLORS[c.status] || STATUS_COLORS.DRAFT}`}>
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/30">@{c.user.username} · {c.user.email}</p>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {c.status === "PENDING_REVIEW" && (
                      <>
                        <button
                          onClick={() => updateCreatorStatus(c.id, "ACTIVE")}
                          disabled={actionLoading === c.id}
                          className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/25 transition disabled:opacity-50"
                        >
                          {actionLoading === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Aprobar
                        </button>
                        <button
                          onClick={() => updateCreatorStatus(c.id, "SUSPENDED")}
                          disabled={actionLoading === c.id}
                          className="flex items-center gap-1 rounded-lg bg-red-500/15 px-3 py-1.5 text-[11px] font-medium text-red-300 hover:bg-red-500/25 transition disabled:opacity-50"
                        >
                          <X className="h-3 w-3" /> Rechazar
                        </button>
                      </>
                    )}
                    {c.status === "ACTIVE" && (
                      <button
                        onClick={() => updateCreatorStatus(c.id, "SUSPENDED")}
                        disabled={actionLoading === c.id}
                        className="flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-300/60 hover:text-red-300 transition disabled:opacity-50"
                      >
                        <X className="h-3 w-3" /> Suspender
                      </button>
                    )}
                    {c.status === "SUSPENDED" && (
                      <button
                        onClick={() => updateCreatorStatus(c.id, "ACTIVE")}
                        disabled={actionLoading === c.id}
                        className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300/60 hover:text-emerald-300 transition disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" /> Reactivar
                      </button>
                    )}
                  </div>
                </div>
                {/* Stats row */}
                <div className="mt-3 flex items-center gap-4 text-[10px] text-white/25 border-t border-white/[0.04] pt-2.5">
                  <span>{c.subscriberCount} suscriptores</span>
                  <span>{c.totalPosts} posts</span>
                  <span className="text-emerald-400/60">${c.totalEarned.toLocaleString("es-CL")} ganado</span>
                  <span>Balance: ${(c.availableBalance || 0).toLocaleString("es-CL")}</span>
                  <span className="ml-auto">{new Date(c.createdAt).toLocaleDateString("es-CL")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           PLANS (with full CRUD)
         ═══════════════════════════════════════════════════════════════ */}
      {!loading && tab === "plans" && (
        <div className="space-y-4">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
              {editingPlan === plan.id ? (
                /* Edit mode */
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-white/50">Editando: {plan.tier}</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-medium text-white/30 mb-1">Nombre</label>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-white/30 mb-1">Precio CLP</label>
                      <input type="number" value={editPrice} onChange={(e) => setEditPrice(parseInt(e.target.value) || 0)} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-white/30 mb-1">Cupos</label>
                      <input type="number" value={editSlots} onChange={(e) => setEditSlots(parseInt(e.target.value) || 0)} className={inputClass} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => savePlanEdit(plan)}
                      disabled={actionLoading === plan.id}
                      className="rounded-lg bg-emerald-500/15 px-4 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 transition disabled:opacity-50"
                    >
                      {actionLoading === plan.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
                    </button>
                    <button
                      onClick={() => setEditingPlan(null)}
                      className="rounded-lg bg-white/[0.04] px-4 py-2 text-xs text-white/40 hover:text-white/60 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold">{plan.name}</h3>
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] font-bold text-white/40">{plan.tier}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${plan.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                        {plan.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-white/35">
                      ${plan.priceCLP.toLocaleString("es-CL")} /mes — {plan.maxSlots} {plan.maxSlots === 1 ? "cupo" : "cupos"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingPlan(plan.id);
                        setEditName(plan.name);
                        setEditPrice(plan.priceCLP);
                        setEditSlots(plan.maxSlots);
                      }}
                      className="flex items-center gap-1 rounded-lg bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/35 hover:text-white/60 transition"
                    >
                      <Edit3 className="h-3 w-3" /> Editar
                    </button>
                    <button
                      onClick={() => togglePlanActive(plan)}
                      disabled={actionLoading === plan.id}
                      className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-medium transition disabled:opacity-50 ${
                        plan.isActive
                          ? "bg-red-500/10 text-red-300/60 hover:text-red-300"
                          : "bg-emerald-500/10 text-emerald-300/60 hover:text-emerald-300"
                      }`}
                    >
                      {actionLoading === plan.id ? <Loader2 className="h-3 w-3 animate-spin" /> : plan.isActive ? (
                        <><ToggleRight className="h-3 w-3" /> Desactivar</>
                      ) : (
                        <><ToggleLeft className="h-3 w-3" /> Activar</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           WITHDRAWALS (full management)
         ═══════════════════════════════════════════════════════════════ */}
      {!loading && tab === "withdrawals" && (
        <div className="space-y-4">
          <div className="flex gap-1.5 flex-wrap">
            {["", "PENDING", "APPROVED", "REJECTED"].map((s) => (
              <button
                key={s}
                onClick={() => setWdFilter(s)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                  wdFilter === s ? "bg-[#00aff0]/15 text-[#00aff0] border border-[#00aff0]/25" : "text-white/25 hover:text-white/50"
                }`}
              >
                {s === "" ? "Todos" : s === "PENDING" ? "Pendientes" : s === "APPROVED" ? "Aprobados" : "Rechazados"}
              </button>
            ))}
          </div>

          {withdrawals.length === 0 && (
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-12 text-center">
              <Wallet className="mx-auto mb-2 h-6 w-6 text-white/10" />
              <p className="text-sm text-white/30">No hay retiros con este filtro</p>
            </div>
          )}

          <div className="space-y-3">
            {withdrawals.map((w) => (
              <div key={w.id} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-base font-extrabold">${w.amount.toLocaleString("es-CL")} CLP</p>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                        w.status === "APPROVED" ? "bg-emerald-500/15 text-emerald-300" :
                        w.status === "PENDING" ? "bg-amber-500/15 text-amber-300" :
                        "bg-red-500/15 text-red-300"
                      }`}>
                        {w.status === "APPROVED" ? "Aprobado" : w.status === "PENDING" ? "Pendiente" : "Rechazado"}
                      </span>
                    </div>
                    <div className="mt-2 space-y-0.5 text-xs text-white/35">
                      <p><span className="text-white/20">Banco:</span> {w.bankName} — Cta. {w.accountType}</p>
                      <p><span className="text-white/20">Nro:</span> {w.accountNumber}</p>
                      <p><span className="text-white/20">Titular:</span> {w.holderName} · RUT: {w.holderRut}</p>
                      <p><span className="text-white/20">Fecha:</span> {new Date(w.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}</p>
                    </div>
                  </div>

                  {w.status === "PENDING" && (
                    <div className="flex flex-col gap-2 shrink-0 ml-4">
                      <button
                        onClick={() => approveWithdrawal(w.id)}
                        disabled={actionLoading === w.id}
                        className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 px-4 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 transition disabled:opacity-50"
                      >
                        {actionLoading === w.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle className="h-3.5 w-3.5" /> Aprobar</>}
                      </button>
                      <button
                        onClick={() => setRejectId(w.id)}
                        className="flex items-center justify-center gap-1.5 rounded-lg bg-red-500/10 px-4 py-2 text-xs font-medium text-red-300/60 hover:text-red-300 transition"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Rechazar
                      </button>
                    </div>
                  )}
                </div>

                {/* Rejection reason modal */}
                {rejectId === w.id && (
                  <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-4 space-y-3">
                    <p className="text-xs font-bold text-red-300">Motivo del rechazo</p>
                    <input
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Escribe el motivo..."
                      className={inputClass}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => rejectWithdrawal(w.id)}
                        disabled={actionLoading === w.id || !rejectReason.trim()}
                        className="rounded-lg bg-red-500/20 px-4 py-2 text-xs font-medium text-red-300 hover:bg-red-500/30 transition disabled:opacity-50"
                      >
                        {actionLoading === w.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmar rechazo"}
                      </button>
                      <button
                        onClick={() => { setRejectId(null); setRejectReason(""); }}
                        className="rounded-lg bg-white/[0.04] px-4 py-2 text-xs text-white/40 transition hover:text-white/60"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           LEDGER (financial reports)
         ═══════════════════════════════════════════════════════════════ */}
      {!loading && tab === "ledger" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5 flex-wrap">
              {["", "PLAN_PURCHASE", "SLOT_ACTIVATION", "WITHDRAWAL"].map((t) => (
                <button
                  key={t}
                  onClick={() => setLedgerType(t)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                    ledgerType === t ? "bg-[#00aff0]/15 text-[#00aff0] border border-[#00aff0]/25" : "text-white/25 hover:text-white/50"
                  }`}
                >
                  {t === "" ? "Todos" : t === "PLAN_PURCHASE" ? "Compras" : t === "SLOT_ACTIVATION" ? "Activaciones" : "Retiros"}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-white/20">{ledgerTotal} registros</span>
          </div>

          {ledger.length === 0 && (
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-12 text-center">
              <DollarSign className="mx-auto mb-2 h-6 w-6 text-white/10" />
              <p className="text-sm text-white/30">No hay movimientos</p>
            </div>
          )}

          {/* Ledger table */}
          {ledger.length > 0 && (
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 border-b border-white/[0.06] px-5 py-3 text-[10px] font-bold text-white/25 uppercase tracking-wider">
                <span>Descripción</span>
                <span className="text-right">Bruto</span>
                <span className="text-right">Comisión</span>
                <span className="text-right">Creadora</span>
                <span className="text-right">Fecha</span>
              </div>
              {/* Rows */}
              {ledger.map((entry) => (
                <div key={entry.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 border-b border-white/[0.04] px-5 py-3 text-xs last:border-0">
                  <div className="min-w-0">
                    <p className="text-white/50 truncate">{entry.description || entry.type}</p>
                    <p className="text-[10px] text-white/20 truncate">
                      {entry.creator?.displayName} (@{entry.creator?.user?.username})
                    </p>
                  </div>
                  <span className="text-right text-white/50 font-medium tabular-nums">${entry.grossAmount.toLocaleString("es-CL")}</span>
                  <span className="text-right text-red-300/50 tabular-nums">${(entry.platformFee || 0).toLocaleString("es-CL")}</span>
                  <span className="text-right text-emerald-300 font-medium tabular-nums">${entry.creatorPayout.toLocaleString("es-CL")}</span>
                  <span className="text-right text-white/20 tabular-nums">{new Date(entry.createdAt).toLocaleDateString("es-CL")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           CONFIG
         ═══════════════════════════════════════════════════════════════ */}
      {!loading && tab === "config" && (
        <div className="mx-auto max-w-lg space-y-4">
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold">Configuración económica</h2>
              <p className="mt-1 text-xs text-white/30">Parámetros que afectan los pagos a creadoras</p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-white/40 mb-1.5">Payout por cupo (CLP)</label>
              <input
                type="number"
                value={payoutPerSlot}
                onChange={(e) => setPayoutPerSlot(parseInt(e.target.value) || 0)}
                className={inputClass}
              />
              <p className="mt-1 text-[10px] text-white/20">Monto que recibe la creadora por cada suscripción activa recibida</p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-white/40 mb-1.5">Comisión plataforma (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={platformCommPct}
                onChange={(e) => setPlatformCommPct(Math.min(100, parseInt(e.target.value) || 0))}
                className={inputClass}
              />
              <p className="mt-1 text-[10px] text-white/20">Porcentaje que retiene la plataforma. 0% = sin comisión (promoción)</p>
            </div>

            {/* Preview calculation */}
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-4">
              <p className="text-[10px] font-bold text-white/30 mb-2">Vista previa por cada suscripción</p>
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div>
                  <p className="font-bold">${payoutPerSlot.toLocaleString("es-CL")}</p>
                  <p className="text-[10px] text-white/20">Bruto</p>
                </div>
                <div>
                  <p className="font-bold text-red-300/60">${Math.round(payoutPerSlot * platformCommPct / 100).toLocaleString("es-CL")}</p>
                  <p className="text-[10px] text-white/20">Comisión</p>
                </div>
                <div>
                  <p className="font-bold text-emerald-300">${(payoutPerSlot - Math.round(payoutPerSlot * platformCommPct / 100)).toLocaleString("es-CL")}</p>
                  <p className="text-[10px] text-white/20">Creadora recibe</p>
                </div>
              </div>
            </div>

            <button
              onClick={saveConfig}
              disabled={saving}
              className="w-full rounded-xl bg-[#00aff0] py-3 text-sm font-bold text-white shadow-[0_2px_16px_rgba(0,175,240,0.2)] transition-all duration-200 hover:bg-[#00aff0]/90 hover:shadow-[0_4px_24px_rgba(0,175,240,0.3)] disabled:opacity-50"
            >
              {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : configSaved ? (
                <span className="flex items-center justify-center gap-2"><CheckCircle className="h-4 w-4" /> Guardado</span>
              ) : "Guardar configuración"}
            </button>
          </div>

          {/* Danger zone */}
          <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.03] p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400/60" />
              <h3 className="text-sm font-bold text-red-300/80">Zona peligrosa</h3>
            </div>
            <p className="text-xs text-white/30">Los cambios en la configuración afectan inmediatamente todos los nuevos pagos. Las transacciones existentes no se modifican retroactivamente.</p>
          </div>
        </div>
      )}
    </div>
  );
}
