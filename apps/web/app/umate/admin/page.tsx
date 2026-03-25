"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, TrendingUp, FileText, DollarSign, Settings, Eye, ChevronRight, Loader2, Check, X } from "lucide-react";
import { apiFetch } from "../../../lib/api";

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
  createdAt: string;
  user: { username: string; email: string };
};

type Plan = { id: string; tier: string; name: string; priceCLP: number; maxSlots: number; isActive: boolean };

export default function UmateAdminPage() {
  const [tab, setTab] = useState<"dashboard" | "creators" | "plans" | "config">("dashboard");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [payoutPerSlot, setPayoutPerSlot] = useState(5000);
  const [platformCommPct, setPlatformCommPct] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    if (tab === "dashboard") {
      apiFetch<Dashboard>("/admin/umate/dashboard").then((d) => {
        setDashboard(d);
        if (d?.config) {
          setPayoutPerSlot(d.config.payoutPerSlot);
          setPlatformCommPct(d.config.platformCommPct);
        }
        setLoading(false);
      });
    } else if (tab === "creators") {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      apiFetch<{ creators: Creator[] }>(`/admin/umate/creators${params}`).then((d) => {
        setCreators(d?.creators || []);
        setLoading(false);
      });
    } else if (tab === "plans") {
      apiFetch<{ plans: Plan[] }>("/admin/umate/plans").then((d) => {
        setPlans(d?.plans || []);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [tab, statusFilter]);

  const updateCreatorStatus = async (id: string, status: string) => {
    await apiFetch(`/admin/umate/creators/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) });
    setCreators((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  };

  const saveConfig = async () => {
    setSaving(true);
    await apiFetch("/admin/umate/config", { method: "PUT", body: JSON.stringify({ payoutPerSlot, platformCommPct }) });
    setSaving(false);
  };

  const tabs = [
    { key: "dashboard", label: "Dashboard", icon: TrendingUp },
    { key: "creators", label: "Creadoras", icon: Users },
    { key: "plans", label: "Planes", icon: FileText },
    { key: "config", label: "Configuración", icon: Settings },
  ];

  return (
    <div className="py-8 space-y-6">
      <h1 className="text-xl font-bold tracking-tight">Admin U-Mate</h1>

      <div className="flex gap-1 overflow-x-auto border-b border-white/[0.06] pb-px">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-1.5 shrink-0 border-b-2 px-4 py-2.5 text-xs font-medium transition ${
              tab === t.key ? "border-rose-400 text-white" : "border-transparent text-white/40 hover:text-white/60"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-rose-400" /></div>}

      {/* Dashboard */}
      {!loading && tab === "dashboard" && dashboard && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Creadoras activas", value: dashboard.activeCreators, color: "text-rose-400" },
              { label: "En revisión", value: dashboard.pendingReview, color: "text-amber-400" },
              { label: "Suscripciones activas", value: dashboard.activeSubscriptions, color: "text-emerald-400" },
              { label: "Nuevas este mes", value: dashboard.newSubsThisMonth, color: "text-blue-400" },
            ].map((m) => (
              <div key={m.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                <p className="text-[10px] text-white/40">{m.label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="text-xl font-bold">${dashboard.totalRevenue.toLocaleString("es-CL")}</p>
              <p className="text-[10px] text-white/40">Ingresos totales CLP</p>
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="text-xl font-bold">{dashboard.totalPosts}</p>
              <p className="text-[10px] text-white/40">Posts totales</p>
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="text-xl font-bold">{dashboard.totalCreators}</p>
              <p className="text-[10px] text-white/40">Creadoras totales</p>
            </div>
          </div>
        </div>
      )}

      {/* Creators */}
      {!loading && tab === "creators" && (
        <div className="space-y-4">
          <div className="flex gap-1.5 flex-wrap">
            {["", "PENDING_REVIEW", "ACTIVE", "SUSPENDED", "DRAFT"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                  statusFilter === s ? "bg-rose-500/15 text-rose-300" : "text-white/30 hover:text-white/50"
                }`}
              >
                {s || "Todos"}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {creators.map((c) => (
              <div key={c.id} className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{c.displayName}</p>
                  <p className="text-[11px] text-white/40">@{c.user.username} · {c.user.email}</p>
                  <p className="text-[10px] text-white/30">{c.subscriberCount} subs · {c.totalPosts} posts · ${c.totalEarned.toLocaleString("es-CL")} ganado</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                  c.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-300" :
                  c.status === "PENDING_REVIEW" ? "bg-amber-500/15 text-amber-300" :
                  c.status === "SUSPENDED" ? "bg-red-500/15 text-red-300" :
                  "bg-white/10 text-white/40"
                }`}>
                  {c.status}
                </span>
                {c.status === "PENDING_REVIEW" && (
                  <div className="flex gap-1">
                    <button onClick={() => updateCreatorStatus(c.id, "ACTIVE")} className="rounded-lg bg-emerald-500/15 p-2 text-emerald-300 hover:bg-emerald-500/25 transition">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => updateCreatorStatus(c.id, "SUSPENDED")} className="rounded-lg bg-red-500/15 p-2 text-red-300 hover:bg-red-500/25 transition">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {c.status === "ACTIVE" && (
                  <button onClick={() => updateCreatorStatus(c.id, "SUSPENDED")} className="rounded-lg bg-red-500/10 p-2 text-red-300/50 hover:text-red-300 transition">
                    <X className="h-4 w-4" />
                  </button>
                )}
                {c.status === "SUSPENDED" && (
                  <button onClick={() => updateCreatorStatus(c.id, "ACTIVE")} className="rounded-lg bg-emerald-500/10 p-2 text-emerald-300/50 hover:text-emerald-300 transition">
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plans */}
      {!loading && tab === "plans" && (
        <div className="space-y-3">
          {plans.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div>
                <p className="text-sm font-semibold">{p.name} ({p.tier})</p>
                <p className="text-xs text-white/40">${p.priceCLP.toLocaleString("es-CL")} /mes — {p.maxSlots} cupos</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${p.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                {p.isActive ? "Activo" : "Inactivo"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Config */}
      {!loading && tab === "config" && (
        <div className="mx-auto max-w-md space-y-4">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-4">
            <h2 className="text-sm font-semibold">Configuración económica</h2>
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1">Payout por cupo (CLP)</label>
              <input
                type="number"
                value={payoutPerSlot}
                onChange={(e) => setPayoutPerSlot(parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white focus:border-rose-500/30 focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-white/30">Monto que recibe la creadora por cada suscripción activa</p>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1">Comisión plataforma (%)</label>
              <input
                type="number"
                value={platformCommPct}
                onChange={(e) => setPlatformCommPct(parseInt(e.target.value) || 0)}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white focus:border-rose-500/30 focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-white/30">0% = promoción sin comisión. Activar gradualmente.</p>
            </div>
            <button
              onClick={saveConfig}
              disabled={saving}
              className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Guardar configuración"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
