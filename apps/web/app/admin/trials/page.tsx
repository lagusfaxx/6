"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch } from "../../../lib/api";
import Avatar from "../../../components/Avatar";
import {
  ArrowLeft,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Hourglass,
  CreditCard,
  Sparkles,
} from "lucide-react";

type TrialProfile = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileType: string;
  isActive: boolean;
  isOnline: boolean;
  city: string | null;
  tier: string | null;
  role: string;
  shopTrialEndsAt: string | null;
  effectiveTrialEndsAt: string;
  membershipExpiresAt: string | null;
  trialActive: boolean;
  membershipActive: boolean;
  planActive: boolean;
  trialDaysRemaining: number;
  trialHoursRemaining: number;
  trialMsRemaining: number;
  membershipDaysRemaining: number;
  deactivatedByNonPayment: boolean;
  createdAt: string;
};

type Counts = { active: number; expired: number; paid: number; freeTrialDays: number };

const PAGE_SIZE = 30;

const PROFILE_TYPES = [
  { value: "", label: "Todos" },
  { value: "PROFESSIONAL", label: "Profesional" },
  { value: "ESTABLISHMENT", label: "Establecimiento" },
  { value: "SHOP", label: "Tienda" },
];

const TABS = [
  { value: "active" as const, label: "Pruebas activas", icon: Hourglass },
  { value: "expired" as const, label: "Desactivadas por no pago", icon: AlertTriangle },
  { value: "paid" as const, label: "Membresía pagada", icon: CheckCircle2 },
];

type Tab = (typeof TABS)[number]["value"];

function formatRemaining(p: TrialProfile): string {
  if (p.membershipActive) {
    return `${p.membershipDaysRemaining} día${p.membershipDaysRemaining === 1 ? "" : "s"}`;
  }
  if (!p.trialActive) return "Vencida";
  if (p.trialDaysRemaining >= 1) {
    return `${p.trialDaysRemaining} día${p.trialDaysRemaining === 1 ? "" : "s"}`;
  }
  return `${p.trialHoursRemaining} h`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AdminTrialsPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const isAdmin = useMemo(() => (user?.role ?? "").toUpperCase() === "ADMIN", [user?.role]);

  const [tab, setTab] = useState<Tab>("active");
  const [profiles, setProfiles] = useState<TrialProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [profileTypeFilter, setProfileTypeFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [extendOpen, setExtendOpen] = useState<string | null>(null);
  const [customDays, setCustomDays] = useState<Record<string, string>>({});

  const loadCounts = useCallback(async () => {
    try {
      const res = await apiFetch<Counts>("/admin/trials/counts");
      setCounts(res);
    } catch {
      /* ignore */
    }
  }, []);

  const loadProfiles = useCallback(async () => {
    setError(null);
    setLoadingProfiles(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));
      params.set("status", tab);
      if (searchQuery) params.set("q", searchQuery);
      if (profileTypeFilter) params.set("profileType", profileTypeFilter);

      const res = await apiFetch<{ profiles: TrialProfile[]; total: number }>(
        `/admin/trials?${params.toString()}`,
      );
      setProfiles(res?.profiles ?? []);
      setTotal(res?.total ?? 0);
    } catch {
      setError("No se pudieron cargar los perfiles.");
    } finally {
      setLoadingProfiles(false);
    }
  }, [page, tab, searchQuery, profileTypeFilter]);

  useEffect(() => {
    if (!loading && isAdmin) {
      loadProfiles();
      loadCounts();
    }
  }, [loading, isAdmin, loadProfiles, loadCounts]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    setSearchQuery(searchInput);
  }

  async function extendTrial(p: TrialProfile, days: number) {
    setBusy(p.id);
    setError(null);
    try {
      await apiFetch(`/admin/profiles/${p.id}/trial`, {
        method: "PUT",
        body: JSON.stringify({ addTrialDays: days, isActive: true }),
      });
      setSuccess(
        `Prueba extendida ${days} día${days === 1 ? "" : "s"} a ${p.displayName || p.username}.`,
      );
      setExtendOpen(null);
      await Promise.all([loadProfiles(), loadCounts()]);
    } catch {
      setError("No se pudo extender la prueba.");
    } finally {
      setBusy(null);
    }
  }

  async function grantMembership(p: TrialProfile, days: number) {
    setBusy(p.id);
    setError(null);
    try {
      await apiFetch(`/admin/profiles/${p.id}/trial`, {
        method: "PUT",
        body: JSON.stringify({ addMembershipDays: days, isActive: true }),
      });
      setSuccess(
        `Membresía activada ${days} día${days === 1 ? "" : "s"} a ${p.displayName || p.username}.`,
      );
      setExtendOpen(null);
      await Promise.all([loadProfiles(), loadCounts()]);
    } catch {
      setError("No se pudo activar la membresía.");
    } finally {
      setBusy(null);
    }
  }

  function changeTab(next: Tab) {
    if (next === tab) return;
    setTab(next);
    setPage(0);
    setExtendOpen(null);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading) return <div className="p-6 text-white/70">Cargando...</div>;
  if (!user) return <div className="p-6 text-white/70">Debes iniciar sesión.</div>;
  if (!isAdmin) return <div className="p-6 text-white/70">Acceso restringido.</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/10 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Pruebas y membresías</h1>
            <p className="text-xs text-white/40">
              {counts
                ? `${counts.active} activas • ${counts.expired} desactivadas • ${counts.paid} pagadas`
                : "Cargando..."}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isOn = tab === t.value;
          const count = counts ? counts[t.value] : null;
          return (
            <button
              key={t.value}
              onClick={() => changeTab(t.value)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                isOn
                  ? "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200"
                  : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {count !== null && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isOn ? "bg-fuchsia-500/30 text-fuchsia-100" : "bg-white/10 text-white/50"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search & filters */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            className="w-full rounded-xl border border-white/10 bg-black/20 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-fuchsia-500/30 transition placeholder:text-white/30"
            placeholder="Buscar por nombre, usuario o email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearchQuery("");
                setPage(0);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
        <select
          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-fuchsia-500/30 transition"
          value={profileTypeFilter}
          onChange={(e) => {
            setProfileTypeFilter(e.target.value);
            setPage(0);
          }}
        >
          {PROFILE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
          <button onClick={() => setSuccess(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* List */}
      <div className="mt-4 space-y-2">
        {loadingProfiles ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-fuchsia-400" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <Hourglass className="mx-auto h-10 w-10 text-white/20 mb-3" />
            <div className="text-sm text-white/50">No se encontraron perfiles.</div>
          </div>
        ) : (
          profiles.map((p) => {
            const remaining = formatRemaining(p);
            const customKey = `c-${p.id}`;
            return (
              <div
                key={p.id}
                className={`rounded-xl border bg-white/[0.02] p-3 sm:p-4 transition ${
                  p.deactivatedByNonPayment
                    ? "border-red-500/20 bg-red-500/[0.04]"
                    : p.membershipActive
                      ? "border-emerald-500/20"
                      : "border-amber-500/15"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <Avatar src={p.avatarUrl} alt={p.displayName || p.username} size={44} />
                    {p.isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0e0e12] bg-emerald-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold truncate">
                        {p.displayName || p.username}
                      </span>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px]">
                        {p.profileType}
                      </span>
                      {!p.isActive && (
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-300">
                          Desactivado
                        </span>
                      )}
                      {p.membershipActive ? (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Pagada
                        </span>
                      ) : p.trialActive ? (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-200 flex items-center gap-1">
                          <Hourglass className="h-3 w-3" /> Prueba
                        </span>
                      ) : (
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-300 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Sin plan
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-white/40">
                      <span>@{p.username}</span>
                      {p.email && (
                        <a
                          href={`mailto:${p.email}`}
                          className="truncate text-white/60 hover:text-fuchsia-300 transition"
                        >
                          {p.email}
                        </a>
                      )}
                      {p.city && <span>{p.city}</span>}
                    </div>
                  </div>

                  <div className="hidden sm:flex flex-col items-end shrink-0 text-right">
                    <div
                      className={`flex items-center gap-1 text-xs font-medium ${
                        p.deactivatedByNonPayment
                          ? "text-red-300"
                          : p.membershipActive
                            ? "text-emerald-300"
                            : "text-amber-200"
                      }`}
                    >
                      <Clock className="h-3 w-3" /> {remaining}
                    </div>
                    <div className="text-[10px] text-white/30">
                      {p.membershipActive
                        ? `Vence ${formatDate(p.membershipExpiresAt)}`
                        : `Vence ${formatDate(p.effectiveTrialEndsAt)}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link
                      href={`/profesional/${p.id}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 transition"
                      title="Ver perfil"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      disabled={busy === p.id}
                      onClick={() => setExtendOpen(extendOpen === p.id ? null : p.id)}
                      className="flex h-8 items-center gap-1 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/15 px-2.5 text-xs font-medium text-fuchsia-200 hover:bg-fuchsia-500/25 transition disabled:opacity-50"
                    >
                      {busy === p.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden sm:inline">
                        {p.deactivatedByNonPayment ? "Activar" : "Extender"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Mobile remaining row */}
                <div className="mt-2 flex items-center justify-between text-[11px] sm:hidden">
                  <span
                    className={`flex items-center gap-1 font-medium ${
                      p.deactivatedByNonPayment
                        ? "text-red-300"
                        : p.membershipActive
                          ? "text-emerald-300"
                          : "text-amber-200"
                    }`}
                  >
                    <Clock className="h-3 w-3" /> {remaining}
                  </span>
                  <span className="text-white/30">
                    Vence{" "}
                    {p.membershipActive
                      ? formatDate(p.membershipExpiresAt)
                      : formatDate(p.effectiveTrialEndsAt)}
                  </span>
                </div>

                {/* Extend / activate panel */}
                {extendOpen === p.id && (
                  <div className="mt-3 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-3">
                    <div className="text-[11px] uppercase tracking-wide text-fuchsia-200/70 mb-2 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Extender prueba gratuita
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[7, 15, 30, 90].map((d) => (
                        <button
                          key={`trial-${d}`}
                          disabled={busy === p.id}
                          onClick={() => extendTrial(p, d)}
                          className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/20 transition disabled:opacity-50"
                        >
                          +{d}d prueba
                        </button>
                      ))}
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-fuchsia-200/70 mt-3 mb-2 flex items-center gap-1">
                      <CreditCard className="h-3 w-3" /> Activar membresía pagada
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[30, 60, 90, 180, 365].map((d) => (
                        <button
                          key={`mem-${d}`}
                          disabled={busy === p.id}
                          onClick={() => grantMembership(p, d)}
                          className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-500/20 transition disabled:opacity-50"
                        >
                          +{d}d membresía
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={730}
                        placeholder="Días"
                        value={customDays[customKey] ?? ""}
                        onChange={(e) =>
                          setCustomDays((prev) => ({ ...prev, [customKey]: e.target.value }))
                        }
                        className="w-24 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs outline-none focus:border-fuchsia-400/40"
                      />
                      <button
                        disabled={busy === p.id}
                        onClick={() => {
                          const n = parseInt(customDays[customKey] || "0", 10);
                          if (n > 0) extendTrial(p, n);
                        }}
                        className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-100 hover:bg-amber-500/20 transition disabled:opacity-50"
                      >
                        Sumar a prueba
                      </button>
                      <button
                        disabled={busy === p.id}
                        onClick={() => {
                          const n = parseInt(customDays[customKey] || "0", 10);
                          if (n > 0) grantMembership(p, n);
                        }}
                        className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-100 hover:bg-emerald-500/20 transition disabled:opacity-50"
                      >
                        Sumar a membresía
                      </button>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => setExtendOpen(null)}
                        className="text-[11px] text-white/40 hover:text-white/70"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-xs text-white/40">
            Página {page + 1} de {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white/70 hover:bg-white/10 transition disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Anterior
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white/70 hover:bg-white/10 transition disabled:opacity-30"
            >
              Siguiente
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
